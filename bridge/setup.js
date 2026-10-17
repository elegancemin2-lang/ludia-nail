import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {randomBytes, createHash, timingSafeEqual} from 'node:crypto';
import {spawn} from 'node:child_process';
import {smartplaceUrl, pageMatches, editableConfig, publicConfig, selectorFingerprint, FIELD_KEYS, validateConfig} from './config.js';
import {checkServer, issueCopy} from './preflight.js';
import {readRenderedRows, maskedPreview} from './dom-reader.js';
import {buildChanges} from './booking-reader.js';
import {atomicJson} from './local-export.js';
import {installPicker, pickerSnapshot} from './picker.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = async (file, fallback) => {try{return JSON.parse(await fs.readFile(file, 'utf8'));}catch(error){if(error.code==='ENOENT')return fallback;throw Error('config_file_invalid');}};
const match = (a, b) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
const copy = {
  browser_not_open:'먼저 네이버 로그인 창을 여세요.', official_smartplace_url_required:'네이버 공식 예약관리 화면으로 이동한 뒤 다시 시도하세요.',
  booking_row_required:'먼저 예약 한 줄 전체를 선택하세요.', booking_fields_required:'예약번호·상태와 날짜·시간을 지정하세요.',
  no_booking_rows:'지정한 예약 행이 없어요. 실제 예약이 보이는 목록에서 다시 선택하세요.',
  ambiguous_rows:'일부 예약 항목을 정확히 읽지 못했어요. 선택 영역과 날짜·시간 형식을 다시 확인하세요.',
  booking_screen_changed:'현재 매장·주소·조회 기간이 달라졌어요. 현재 화면을 다시 확인하세요.',
  preview_required:'미리보기를 다시 확인한 뒤 저장하세요.', owner_confirmation_required:'실제 예약 내용과 조회 기간을 확인한 뒤 체크해 주세요.',
  server_not_ready:'서버 연결 준비가 끝나지 않았어요. 연결 검사의 안내를 확인하세요.',
  operation_busy:'앞선 작업이 끝난 뒤 다시 시도하세요.', invalid_request:'요청을 처리하지 못했어요.',
  sync_key_required:'서버와 같은 매장 PC 연결 키를 입력하세요.', config_file_invalid:'기존 설정 파일을 읽지 못했어요. 파일을 보존한 채 JSON 문법을 확인하세요.',
  setup_failed:'작업을 완료하지 못했어요. 브리지가 이미 실행 중이면 먼저 종료하고 다시 시도하세요.'
};

export async function createSetupServer({configPath = path.join(HERE, 'config.local.json'), browserFactory, fetcher = fetch, onStart, lifetimeMs = 3600000} = {}) {
  let config = await read(configPath, await read(path.join(HERE,'config.example.json'), {}));
  let context = null, busy = false, verification = null, started = false;
  const token = randomBytes(32).toString('base64url');
  const makeBrowser = browserFactory || (async profile => {
    const {chromium} = await import('playwright');
    return chromium.launchPersistentContext(profile, {headless:false, viewport:{width:1280,height:900}, locale:'ko-KR'});
  });
  const currentPage = () => {
    const page = context?.pages().filter(p=>!p.isClosed()).at(-1);
    if (!page) throw Error('browser_not_open');
    return page;
  };
  const officialPage = () => {const page=currentPage();smartplaceUrl(page.url());return page;};
  const state = async () => {
    let page = null, picked = null;
    try {page=officialPage();picked=await page.evaluate(pickerSnapshot);}catch{}
    return {config:publicConfig(config), browserOpen:Boolean(context), pageState:page?'smartplace':context?'login_required':'closed',
      currentUrl:page?.url()||'', selection:picked, verified:Boolean(verification), started, attachmentsSupported:false};
  };
  const inspect = async next => {
    const page=officialPage();
    if(!pageMatches(page.url(), next.smartplaceUrl))throw Error('booking_screen_changed');
    if(!next.bookingRowSelector)throw Error('booking_row_required');
    const f=next.bookingFields||{};
    if(!f.bookingNo||!f.status||!(f.dateTime||(f.date&&f.time)))throw Error('booking_fields_required');
    const rows=await readRenderedRows(page,next);
    if(!rows.length)throw Error('no_booking_rows');
    const changes=buildChanges(rows,{bookings:{}});
    if(changes.rejectedCount||!changes.parsedCount)throw Error('ambiguous_rows');
    return {rowCount:rows.length,parsedCount:changes.parsedCount,preview:maskedPreview(Object.values(changes.next).map(x=>x.row))};
  };
  const server=http.createServer(async(req,res)=>{
    const host='127.0.0.1:'+server.address().port;
    res.setHeader('cache-control','no-store');res.setHeader('x-content-type-options','nosniff');res.setHeader('x-frame-options','DENY');res.setHeader('referrer-policy','no-referrer');
    res.setHeader('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    const json=(status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    if(req.headers.host!==host||req.headers.origin&&req.headers.origin!=='http://'+host)return json(403,{ok:false,error:'forbidden'});
    let pathname;try{pathname=new URL(req.url,'http://'+host).pathname;}catch{return json(400,{ok:false,error:'invalid_request'});}
    const assets={'/':['setup.html','text/html; charset=utf-8'],'/setup-client.js':['setup-client.js','text/javascript; charset=utf-8'],'/setup.css':['setup.css','text/css; charset=utf-8']};
    if(req.method==='GET'&&assets[pathname]){
      const [file,type]=assets[pathname];res.writeHead(200,{'content-type':type});res.end(await fs.readFile(path.join(HERE,file)));return;
    }
    if(!pathname.startsWith('/api/'))return json(404,{ok:false,error:'not_found'});
    const received=req.headers['x-ludia-setup-token'];
    if(typeof received!=='string'||received.length>1024||!match(received,token))return json(401,{ok:false,error:'unauthorized'});
    if(req.method==='GET'&&pathname==='/api/state'){try{return json(200,{ok:true,...await state()});}catch{return json(500,{ok:false,error:'setup_failed'});}}
    if(req.method!=='POST')return json(405,{ok:false,error:'method_not_allowed'});
    if(req.headers['content-type']!=='application/json')return json(415,{ok:false,error:'invalid_request'});
    if(busy||started)return json(409,{ok:false,error:'operation_busy',message:copy.operation_busy});
    busy=true;
    try{
      const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>16384)throw Error('invalid_request');chunks.push(chunk);}
      let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{throw Error('invalid_request');}
      if(!input||typeof input!=='object'||Array.isArray(input))throw Error('invalid_request');
      if(pathname==='/api/open'){
        if(!context){context=await makeBrowser(path.resolve(path.dirname(configPath),config.profileDir||'./.naver-profile'));context.once?.('close',()=>{context=null;verification=null;});}
        const page=context.pages().filter(p=>!p.isClosed()).at(-1)||await context.newPage();
        if(page.url()==='about:blank')await page.goto(smartplaceUrl(config.smartplaceUrl||'https://new.smartplace.naver.com/'),{waitUntil:'domcontentloaded'});
        return json(200,{ok:true,...await state()});
      }
      if(pathname==='/api/pick'){
        if(!['row',...FIELD_KEYS].includes(input.field))throw Error('invalid_request');
        verification=null;const page=officialPage();
        await page.evaluate(installPicker,{field:input.field,rowSelector:input.bookingRowSelector||config.bookingRowSelector||'',fields:input.bookingFields||config.bookingFields||{}});
        return json(200,{ok:true,...await state()});
      }
      if(pathname==='/api/server'){
        const result=await checkServer({syncUrl:input.syncUrl||config.syncUrl,syncToken:input.syncToken||config.syncToken},fetcher);
        return json(200,{ok:true,result:{...result,messages:result.issues.map(code=>issueCopy[code]||copy[code]||copy.server_not_ready)}});
      }
      if(pathname==='/api/verify'){
        verification=null;const next=editableConfig(config,input),result=await inspect(next);
        verification={fingerprint:selectorFingerprint(next),verifiedAt:new Date().toISOString(),...result};
        return json(200,{ok:true,...result,note:'지금 화면에 표시된 조회 기간의 예약만 확인했습니다. 목록에서 사라진 예약은 취소로 처리하지 않습니다.'});
      }
      if(pathname==='/api/save'){
        if(input.confirmed!==true)throw Error('owner_confirmation_required');
        const next=editableConfig(config,input);
        if(!verification||verification.fingerprint!==selectorFingerprint(next))throw Error('preview_required');
        const result=await inspect(next);
        if(next.deliveryMode==='server'&&!(await checkServer(next,fetcher)).ok)throw Error('server_not_ready');
        next.selectorsVerified=true;next.selectorVerification={fingerprint:selectorFingerprint(next),verifiedAt:new Date().toISOString(),rowCount:result.rowCount,source:'owner-reviewed-rendered-dom'};
        validateConfig(next);await atomicJson(configPath,next);config=next;
        return json(200,{ok:true,...await state()});
      }
      if(pathname==='/api/start'){
        validateConfig(config);
        if(!verification||verification.fingerprint!==selectorFingerprint(config))throw Error('preview_required');
        await inspect(config);
        if(config.deliveryMode==='server'&&!(await checkServer(config,fetcher)).ok)throw Error('server_not_ready');
        if(!onStart)throw Error('setup_failed');
        started=true;await context?.close();context=null;
        await onStart(configPath);json(200,{ok:true,started:true,message:'브리지를 실행했습니다. 정상 동기화 여부는 LUDIA에서 확인하세요.'});
        clearTimeout(lifetime);setImmediate(()=>server.close());return;
      }
      return json(404,{ok:false,error:'not_found'});
    }catch(error){const code=Object.hasOwn(copy,error.message)||Object.hasOwn(issueCopy,error.message)?error.message:'setup_failed';return json(400,{ok:false,error:code,message:copy[code]||issueCopy[code]});}
    finally{busy=false;}
  });
  const close=async()=>{clearTimeout(lifetime);await context?.close().catch(()=>{});context=null;server.close();};
  const lifetime=setTimeout(()=>{void close();},lifetimeMs);lifetime.unref();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  return{server,token,url:'http://127.0.0.1:'+server.address().port+'/#'+token,close};
}

export async function runSetup(){
  const setup=await createSetupServer({configPath:path.resolve(process.env.LUDIA_BRIDGE_CONFIG||path.join(HERE,'config.local.json')),
    onStart:async configPath=>{const child=spawn(process.execPath,[path.join(HERE,'bridge.js')],{cwd:HERE,stdio:'inherit',env:{...process.env,LUDIA_BRIDGE_CONFIG:configPath}});child.on('error',()=>{console.error('[LUDIA] Bridge start failed. Run START_NAVER_BRIDGE.cmd again.');process.exitCode=1;});child.on('exit',code=>{if(code)process.exitCode=code;});}});
  console.log('[LUDIA] PC setup (this PC only, valid for 60 minutes):\n'+setup.url);
  console.log('[LUDIA] Do not share this local setup URL. Sign in only on Naver.');
  if(process.platform==='win32')spawn('cmd.exe',['/c','start','',setup.url],{stdio:'ignore'}).on('error',()=>{});
  process.once('SIGINT',()=>{void setup.close();});process.once('SIGTERM',()=>{void setup.close();});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)runSetup().catch(()=>{console.error('[LUDIA] Setup could not start. Preserve config.local.json and check the Node/browser installation.');process.exitCode=1;});
