import {chromium} from 'playwright';
import fs from 'node:fs/promises';import path from 'node:path';import {randomUUID} from 'node:crypto';import {buildChanges,stageChanges,commitPending} from './booking-reader.js';
import {atomicJson,localExport,enrichLocalRows} from './local-export.js';
const read=async(file,fallback)=>{try{return JSON.parse(await fs.readFile(file,'utf8'))}catch{return fallback}};
const cfg=await read(path.resolve(process.env.LUDIA_BRIDGE_CONFIG||'./config.local.json'),{});
const deliveryMode=process.env.LUDIA_BRIDGE_MODE||cfg.deliveryMode||'server';
if(!['local','server'].includes(deliveryMode))throw Error('invalid_delivery_mode');
const localMode=deliveryMode==='local',exportDir=path.resolve(cfg.exportDir||'./exports');
const profile=path.resolve(process.env.LUDIA_NAVER_PROFILE||cfg.profileDir||'./.naver-profile'),stateFile=path.resolve(process.env.LUDIA_BRIDGE_STATE||cfg.stateFile||'./.bridge-state.json');
const syncUrl=process.env.LUDIA_SYNC_URL||cfg.syncUrl||'',token=process.env.LUDIA_SYNC_TOKEN||cfg.syncToken||'',bookingUrl=process.env.LUDIA_SMARTPLACE_URL||cfg.smartplaceUrl||'';
const poll=Math.max(30000,Number(process.env.LUDIA_POLL_MS||cfg.pollMs)||60000),rowSelector=process.env.LUDIA_BOOKING_ROW_SELECTOR||cfg.bookingRowSelector||'',fields=cfg.bookingFields||{};
const verified=cfg.selectorsVerified===true&&Boolean(rowSelector)&&['bookingNo','date','time','status'].every(key=>typeof fields[key]==='string'&&fields[key].trim());
const save=async state=>{await fs.writeFile(stateFile+'.tmp',JSON.stringify(state,null,2),{encoding:'utf8',mode:0o600});await fs.rename(stateFile+'.tmp',stateFile)};
function pageMatches(url){if(!bookingUrl)return false;try{const a=new URL(url),b=new URL(bookingUrl);return a.protocol==='https:'&&a.origin===b.origin&&a.pathname===b.pathname}catch{return false}}
async function push(events,state,diagnostics={parserVerified:false}){if(localMode){await atomicJson(path.join(exportDir,'ludia-naver-status.json'),{schema:'ludia-naver-local-status/v1',state,checkedAt:new Date().toISOString(),parserVerified:diagnostics.parserVerified===true});return}const r=await fetch(syncUrl,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({source:'NAVER',events,bridgeState:state,diagnostics}),signal:AbortSignal.timeout(20000)});let d;try{d=await r.json()}catch{throw Error('invalid_sync_response')}if(!r.ok||!d.ok||!d.persisted||d.accepted!==events.length)throw Error('sync_not_acknowledged_'+r.status)}
async function extract(page){return page.locator('body').evaluate(({selector,fields})=>{const clean=v=>String(v||'').replace(/\s+/g,' ').trim();return[...document.querySelectorAll(selector)].filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden').map(el=>{const out={};for(const [key,selector] of Object.entries(fields)){if(!selector)continue;const nodes=[...el.querySelectorAll(selector)].filter(n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden');out[key]=nodes.length===1?clean(nodes[0].textContent):''}return{text:clean(el.textContent).slice(0,2000),fields:out}})},{selector:rowSelector,fields})}
async function main(){
 if(!localMode&&(!token||token.length<32||/^PASTE_/i.test(token)))throw Error('Set the matching long LUDIA_SYNC_TOKEN in config.local.json');
 const initial=new URL(bookingUrl||'https://new.smartplace.naver.com/');if(!localMode){const target=new URL(syncUrl);if(target.protocol!=='https:'||target.pathname!=='/api/naver-sync'||target.username||target.password)throw Error('Use the official LUDIA HTTPS sync endpoint')}if(initial.protocol!=='https:'||!/(^|\.)smartplace\.naver\.com$/.test(initial.hostname))throw Error('Use the official HTTPS SmartPlace booking URL');
 const state=await read(stateFile,{bookings:{},lastSyncAt:null});if(!state.bookings||typeof state.bookings!=='object')state.bookings={};if(!state.bridgeId){state.bridgeId=randomUUID();await save(state)}
 const mode=localMode?'local':'server';if(state.deliveryMode&&state.deliveryMode!==mode)throw Error('Use a separate stateFile for local and server delivery');if(!state.deliveryMode){state.deliveryMode=mode;await save(state)}
 const context=await chromium.launchPersistentContext(profile,{headless:false,viewport:{width:1280,height:900},locale:'ko-KR'}),page=context.pages()[0]||await context.newPage();await page.goto(initial.href,{waitUntil:'domcontentloaded'});
 console.log('[LUDIA] Complete official Naver login/CAPTCHA/2FA yourself. Unverified selectors send status only; no bookings.');
 async function flushPending(){if(!state.pending)return;await save(state);const committed=commitPending(state);if(localMode){await atomicJson(path.join(exportDir,'ludia-naver-bookings.json'),localExport(committed))}else for(let i=0;i<state.pending.events.length;i+=200)await push(state.pending.events.slice(i,i+200),'connected',state.pending.diagnostics);await save(committed);Object.assign(state,committed);delete state.pending}
 let stopping=false,failures=0;process.once('SIGINT',()=>{stopping=true});process.once('SIGTERM',()=>{stopping=true});
 while(!stopping){try{if(verified&&state.pending)await flushPending();const body=(await page.locator('body').innerText()).slice(0,20000),login=/nid\.naver\.com|\/login/.test(page.url())||/로그인이 필요|로그인해 주세요|로그인해주세요|2단계 인증|보안문자|자동입력 방지/.test(body);
  if(login)await push([],state.lastSyncAt?'reauth_required':'login_required');
  else if(!verified||!pageMatches(page.url()))await push([],'selector_required');
  else{const rows=await extract(page),empty=cfg.emptyStateSelector&&await page.locator(cfg.emptyStateSelector).isVisible();
   if(!rows.length&&!empty)await push([],'selector_required');
   else{const changes=buildChanges(rows,state),diag={parserVerified:true,visibleCount:rows.length,parsedCount:changes.parsedCount,selectorMode:'verified-fields'};
    if(changes.rejectedCount)await push([],'selector_required',{...diag,parserVerified:false});
    else{if(changes.events.length){state.pending=stageChanges(rows,state,diag).state.pending;await flushPending()}else{state.lastSyncAt=new Date().toISOString();await save(state)}if(localMode){Object.assign(state,enrichLocalRows(rows,state));await atomicJson(path.join(exportDir,'ludia-naver-bookings.json'),localExport(state));await save(state)}await push([],'connected',diag);console.log('[LUDIA] '+(localMode?'exported ':'accepted ')+changes.events.length+' verified events')}
   }
  }failures=0
 }catch(error){failures++;console.error('[LUDIA] '+error.message);await push([],'error').catch(()=>{})}
 if(stopping)break;await new Promise(r=>setTimeout(r,Math.min(300000,poll*Math.pow(2,Math.min(failures,3)))));if(!stopping&&pageMatches(page.url()))try{await page.reload({waitUntil:'domcontentloaded',timeout:30000})}catch{}
 }await context.close();
}
main().catch(error=>{console.error('[LUDIA] '+error.message);process.exitCode=1});
