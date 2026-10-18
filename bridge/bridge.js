import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {buildChanges,stageChanges,commitPending,parseCandidate} from './booking-reader.js';
import {atomicJson,localExport,enrichLocalRows} from './local-export.js';
import {pageMatches,selectorsReady,verifiedViews,smartplaceUrl,syncUrl as officialSyncUrl} from './config.js';
import {readRenderedRows} from './dom-reader.js';
import {checkServer,issueCopy} from './preflight.js';
import {deliverToApp,notifyApp} from './app-delivery.js';

const read=async(file,fallback)=>{try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')return fallback;throw Error('local_file_unreadable');}};
export function effectiveConfig(raw,env=process.env){
  return {...raw,deliveryMode:env.LUDIA_BRIDGE_MODE||raw.deliveryMode||'server',
    syncUrl:env.LUDIA_SYNC_URL||raw.syncUrl||'',syncToken:env.LUDIA_SYNC_TOKEN||raw.syncToken||'',
    smartplaceUrl:env.LUDIA_SMARTPLACE_URL||raw.smartplaceUrl||'',
    bookingRowSelector:env.LUDIA_BOOKING_ROW_SELECTOR||raw.bookingRowSelector||'',
    profileDir:env.LUDIA_NAVER_PROFILE||raw.profileDir||'./.naver-profile',stateFile:env.LUDIA_BRIDGE_STATE||raw.stateFile||'./.bridge-state.json',
    pollMs:Math.max(30000,Number(env.LUDIA_POLL_MS||raw.pollMs)||60000)};
}

export async function sendServer(config,events,state,diagnostics={parserVerified:false},fetcher=fetch){
  const endpoint=officialSyncUrl(config.syncUrl);
  const response=await fetcher(endpoint,{method:'POST',headers:{authorization:'Bearer '+config.syncToken,'content-type':'application/json'},
    body:JSON.stringify({source:'NAVER',events,bridgeState:state,diagnostics}),signal:AbortSignal.timeout(20000),redirect:'error'});
  let data;try{data=await response.json();}catch{throw Error('invalid_sync_response');}
  if(!response.ok||!data.ok||!data.persisted||data.accepted!==events.length)throw Error('sync_not_acknowledged');
}

export async function readViews(pages,views,{refreshFailures=new Set()}={}){
  const rows=[];let authenticated=false;
  for(const [i,view] of views.entries()){
    const page=pages[i];if(!page||page.isClosed())return{state:'selector_required'};
    const body=(await page.locator('body').innerText()).slice(0,20000);
    if(/nid\.naver\.com|\/login/.test(page.url())||/로그인이 필요|로그인해 주세요|로그인해주세요|2단계 인증|보안문자|자동입력 방지/.test(body))return{state:'login_required',authenticated};
    if(!view.bookingRowSelector||!pageMatches(page.url(),view.smartplaceUrl))return{state:'selector_required'};
    if(refreshFailures.has(i))throw Error('booking_refresh_failed');
    const found=await readRenderedRows(page,view);
    if(found.length&&found.every(parseCandidate))authenticated=true;
    if(!found.length&&!(view.emptyStateSelector&&await page.locator(view.emptyStateSelector).isVisible()))return{state:'selector_required'};
    rows.push(...found);
  }
  return{state:'connected',rows,viewCount:views.length};
}

export async function runBridge(){
  const configFile=path.resolve(process.env.LUDIA_BRIDGE_CONFIG||'./config.local.json');
  const config=effectiveConfig(await read(configFile,{}));
  if(!['local','server'].includes(config.deliveryMode))throw Error('invalid_delivery_mode');
  const local=config.deliveryMode==='local',bookingUrl=config.smartplaceUrl,verified=selectorsReady(config);
  const views=verified?verifiedViews(config):[{smartplaceUrl:bookingUrl||'https://new.smartplace.naver.com/'}];
  const initial=smartplaceUrl(bookingUrl||'https://new.smartplace.naver.com/');
  if(!local){
    officialSyncUrl(config.syncUrl);
    const result=await checkServer(config);
    if(!result.ok){console.error('[LUDIA] '+result.issues.map(code=>issueCopy[code]||'Server setup required.').join(' '));throw Error('server_not_ready');}
  }
  const stateFile=path.resolve(config.stateFile),profile=path.resolve(config.profileDir),exportDir=path.resolve(config.exportDir||'./exports');
  const state=await read(stateFile,{bookings:{},lastSyncAt:null});
  if(!state.bookings||typeof state.bookings!=='object'||Array.isArray(state.bookings))throw Error('local_state_invalid');
  if(state.deliveryMode&&state.deliveryMode!==config.deliveryMode)throw Error('separate_state_file_required');
  if(!state.bridgeId)state.bridgeId=randomUUID();state.deliveryMode=config.deliveryMode;await atomicJson(stateFile,state);
  const {chromium}=await import('playwright');
  const context=await chromium.launchPersistentContext(profile,{headless:false,viewport:{width:1280,height:900},locale:'ko-KR'});
  const pages=[],controller=new AbortController(),refreshFailures=new Set();let failures=0;
  const stop=()=>controller.abort();process.once('SIGINT',stop);process.once('SIGTERM',stop);
  const push=async(events,status,diagnostics={parserVerified:false})=>{
    if(local){await atomicJson(path.join(exportDir,'ludia-naver-status.json'),{schema:'ludia-naver-local-status/v1',state:status,checkedAt:new Date().toISOString(),parserVerified:diagnostics.parserVerified===true});if(status!=='connected')await notifyApp(context,status).catch(()=>{});}
    else await sendServer(config,events,status,diagnostics);
  };
  async function flushPending(){
    if(!state.pending)return;
    await atomicJson(stateFile,state);
    const committed=commitPending(state);
    if(local)await atomicJson(path.join(exportDir,'ludia-naver-bookings.json'),localExport(committed));
    else for(let i=0;i<state.pending.events.length;i+=200)await push(state.pending.events.slice(i,i+200),'connected',state.pending.diagnostics);
    await atomicJson(stateFile,committed);Object.assign(state,committed);delete state.pending;
  }
  try{
    for(const [i,view] of views.entries()){
      const url=i===0?initial:smartplaceUrl(view.smartplaceUrl);
      const page=context.pages().find(p=>!p.isClosed()&&pageMatches(p.url(),url))||await context.newPage();
      if(!pageMatches(page.url(),url))await page.goto(url,{waitUntil:'domcontentloaded'});pages.push(page);
    }
    console.log('[LUDIA] Sign in only on Naver. Never put the Naver password in LUDIA.');
    console.log('[LUDIA] '+(verified?'Only the verified shop/view will be collected.':'Open SETUP_NAVER_BRIDGE.cmd to check the actual booking fields. No bookings are collected yet.'));
    while(!controller.signal.aborted){
      try{
        if(verified&&state.pending)await flushPending();
        const read=await readViews(pages,views,{refreshFailures});
        if(read.state==='login_required'){
          // Another reviewed view has already yielded valid bookings after the owner signed in.
          // Refresh leftover login tabs only after that evidence; never interrupt the initial 2FA.
          if(read.authenticated)for(const [i,page] of pages.entries())if(!page.isClosed()&&/nid\.naver\.com|\/login/.test(page.url()))await page.goto(views[i].smartplaceUrl,{waitUntil:'domcontentloaded',timeout:30000});
          await push([],state.lastSyncAt?'reauth_required':'login_required');
        }
        else if(!verified||read.state!=='connected')await push([],'selector_required');
        else{
          const rows=read.rows;
            const changes=buildChanges(rows,state),diag={parserVerified:true,visibleCount:rows.length,parsedCount:changes.parsedCount,viewCount:read.viewCount,selectorMode:'verified-fields'};
            if(changes.rejectedCount)await push([],'selector_required',{...diag,parserVerified:false});
            else{
              if(changes.events.length){state.pending=stageChanges(rows,state,diag).state.pending;await flushPending();}
              else{state.lastSyncAt=new Date().toISOString();await atomicJson(stateFile,state);}
              if(local){Object.assign(state,enrichLocalRows(rows,state));const exported=localExport(state);await atomicJson(path.join(exportDir,'ludia-naver-bookings.json'),exported);await atomicJson(stateFile,state);
                if(config.openLocalApp!==false)await deliverToApp(context,{exported,status:{schema:'ludia-naver-local-status/v1',state:'connected',checkedAt:new Date().toISOString(),parserVerified:true}});
              }
              await push([],'connected',diag);console.log('[LUDIA] '+(local?'exported ':'accepted ')+changes.events.length+' verified changes');
            }
        }
        failures=0;
      }catch{
        failures++;console.error('[LUDIA] Cycle failed; pending events are retained. Check the PC setup diagnostic.');
        await push([],'error').catch(()=>{});
      }
      if(controller.signal.aborted)break;
      try{await delay(Math.min(300000,config.pollMs*2**Math.min(failures,3)),undefined,{signal:controller.signal});}catch{break;}
      for(const [i,page] of pages.entries())if(!controller.signal.aborted&&!page.isClosed()&&pageMatches(page.url(),views[i].smartplaceUrl)){
        try{await page.reload({waitUntil:'domcontentloaded',timeout:30000});refreshFailures.delete(i);}catch{refreshFailures.add(i);}
      }
    }
  }finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);await context.close();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)runBridge().catch(error=>{
  const known={local_file_unreadable:'Local config/state could not be read. Preserve the files and check JSON syntax.',local_state_invalid:'Local state is invalid. Preserve it; do not delete pending bookings.',separate_state_file_required:'Use a separate state file for local and server delivery.',server_not_ready:'Server is not ready. Open the PC setup and run the connection check.'};
  console.error('[LUDIA] '+(known[error.message]||'Bridge could not start. Open SETUP_NAVER_BRIDGE.cmd and check configuration/browser installation.'));process.exitCode=1;
});
