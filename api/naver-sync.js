import {json,config,salonExists,readJson,tokenMatches} from '../server/naver-access.mjs';
const states=new Set(['connected','bridge_waiting','login_required','reauth_required','selector_required','error','setup_required']),statuses=new Set(['cancelled','completed','no_show','requested','confirmed']);
const clean=value=>String(value??'').slice(0,2000);
function validDate(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v||''))return false;const d=new Date(v+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v}
export function normalizeEvent(e){const b=e?.booking;if(!['created','updated'].includes(e?.type)||!b||!/^[a-f0-9]{64}$/.test(e.eventId||'')||!b.bookingNo||b.externalId!==b.bookingNo||!/^[A-Za-z0-9_-]{1,120}$/.test(b.externalId)||!validDate(b.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.time||'')||!statuses.has(b.status))return null;return{event_key:e.eventId,event_type:e.type,external_id:b.externalId,source:'NAVER',booking_no:b.bookingNo,booking_date:b.date,booking_time:b.time,phone:b.phone?clean(b.phone).replace(/\D/g,'').slice(0,20):null,status:b.status,raw_text:clean(b.rawText),received_at:new Date().toISOString()}}
function diagnostics(v={}){return{visible_count:Math.max(0,Math.min(9999,+v.visibleCount||0)),parsed_count:Math.max(0,Math.min(9999,+v.parsedCount||0)),selector_mode:String(v.selectorMode||'unverified').slice(0,40),parser_verified:v.parserVerified===true}}
async function connection(cfg,sid,state,diag,count){const now=new Date().toISOString(),row={salon_id:sid,provider:'NAVER',display_name:'네이버 예약',state,last_error:state==='error'?'bridge_cycle_failed':null,metadata:{last_event_count:count,last_received_at:now,bridge:'windows-playwright',diagnostics:diag},updated_at:now};if(state==='connected'&&diag.parser_verified)row.last_sync_at=now;const r=await fetch(cfg.url+'/rest/v1/ludia_integration_connections?on_conflict=salon_id,provider',{method:'POST',headers:{...cfg.headers,prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([row]),signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('connection_persistence_failed')}
export default async function handler(req,res){
 const cfg=config(),sid=process.env.LUDIA_SALON_ID;
 if(req.method==='GET'){let exists=false;try{exists=Boolean(cfg&&sid)&&await salonExists(cfg,sid)}catch{return json(res,503,{ok:false,ready:false,error:'configuration_unavailable'})}return json(res,200,{ok:true,service:'ludia-naver-sync',ready:Boolean(cfg&&exists&&process.env.LUDIA_SYNC_TOKEN?.length>=32),supabaseConfigured:Boolean(cfg),salonConfigured:exists,tokenConfigured:Boolean(process.env.LUDIA_SYNC_TOKEN?.length>=32),requiresVerifiedSelectors:true,attachmentsSupported:false})}
 if(req.method!=='POST')return json(res,405,{ok:false,error:'method_not_allowed'});
 const expected=process.env.LUDIA_SYNC_TOKEN;if(!expected||expected.length<32)return json(res,503,{ok:false,error:'sync_token_not_configured'});
 if(!tokenMatches(String(req.headers.authorization||'').replace(/^Bearer /,''),expected))return json(res,401,{ok:false,error:'unauthorized'});
 if(!cfg)return json(res,503,{ok:false,error:'supabase_not_configured',retryable:true});
 let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body}catch{return json(res,400,{ok:false,error:'invalid_json'})}
 if(body?.source!=='NAVER'||!Array.isArray(body.events)||body.reviews&&(!Array.isArray(body.reviews)||body.reviews.length))return json(res,400,{ok:false,error:'invalid_or_unverified_payload'});
 if(body.events.length>200)return json(res,413,{ok:false,error:'too_many_events'});
 const diag=diagnostics(body.diagnostics),rows=body.events.map(normalizeEvent);if(rows.some(x=>!x))return json(res,400,{ok:false,error:'ambiguous_booking_rejected'});
 if(rows.length&&!diag.parser_verified)return json(res,409,{ok:false,error:'selectors_not_verified'});
 let state=states.has(body.bridgeState)?body.bridgeState:'selector_required';if(state==='connected'&&!diag.parser_verified)state='selector_required';if(rows.length&&state!=='connected')return json(res,409,{ok:false,error:'booking_screen_not_verified'});
 try{if(!await salonExists(cfg,sid))return json(res,503,{ok:false,error:'salon_not_configured',retryable:true});let synced=0;
  for(const row of rows){const result=await readJson(cfg.url+'/rest/v1/rpc/ludia_ingest_naver_bridge_event',cfg.headers,{method:'POST',body:JSON.stringify({p_salon_id:sid,p_event:row})});if(!result?.ok)throw Error('projection_not_acknowledged');synced++}
  await connection(cfg,sid,state,diag,rows.length);return json(res,200,{ok:true,accepted:rows.length,persisted:true,appointmentSynced:synced,heartbeat:!rows.length,bridgeState:state})
 }catch(error){console.error('[LUDIA sync]',error.message);return json(res,502,{ok:false,error:'persistence_failed',retryable:true})}
}
