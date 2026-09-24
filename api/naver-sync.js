// Vercel serverless endpoint for the local LUDIA Naver Bridge.
// Required env: LUDIA_SYNC_TOKEN. Optional Supabase persistence: SUPABASE_URL + SUPABASE_SECRET_KEY (SERVICE_ROLE accepted as legacy fallback).
const json=(res,status,body)=>res.status(status).setHeader('content-type','application/json; charset=utf-8').end(JSON.stringify(body));
const clean=s=>String(s??'').slice(0,2000);
const allowedStatus=new Set(['cancelled','completed','no_show','requested','confirmed','unknown']);
const allowedType=new Set(['created','updated']);

function normalizeEvent(event){
  if(!event||!allowedType.has(event.type)||!event.booking?.externalId)return null;
  const b=event.booking;
  return {
    event_type:event.type,
    external_id:clean(b.externalId).slice(0,120),
    source:'NAVER',
    booking_no:b.bookingNo?clean(b.bookingNo).slice(0,120):null,
    booking_date:b.date?clean(b.date).slice(0,40):null,
    booking_time:b.time?clean(b.time).slice(0,40):null,
    phone:b.phone?clean(b.phone).slice(0,40):null,
    status:allowedStatus.has(b.status)?b.status:'unknown',
    raw_text:clean(b.rawText),
    received_at:new Date().toISOString()
  };
}

function salonId(){return process.env.LUDIA_SALON_ID||null;}
function supabaseConfig(){
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url&&key?{url,key,headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json'}}:null;
}

async function updateConnection(cfg,{state='connected',lastError=null,eventCount=0,appointmentCount=0}={}){
  if(!cfg)return;
  const now=new Date().toISOString();
  const sid=salonId();
  if(!sid)throw new Error('LUDIA_SALON_ID not configured');
  const body=[{salon_id:sid,provider:'NAVER',display_name:'네이버 예약',state,last_sync_at:now,last_error:lastError,metadata:{last_event_count:eventCount,last_appointment_count:appointmentCount,bridge:'windows-playwright'},updated_at:now}];
  const r=await fetch(`${cfg.url}/rest/v1/ludia_integration_connections?on_conflict=salon_id,provider`,{method:'POST',headers:{...cfg.headers,prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(body)});
  if(!r.ok)throw new Error(`integration_connections ${r.status}: ${await r.text()}`);
}

async function syncAppointment(cfg,sid,row){
  // Only normalized date/time/status data is projected into the live calendar. The local browser
  // profile, cookies and Naver credentials never leave the salon PC.
  if(!row.booking_date||!row.booking_time)return false;
  const payload={
    p_salon_id:sid,
    p_external_id:row.external_id,
    p_booking_no:row.booking_no,
    p_booking_date:row.booking_date,
    p_booking_time:row.booking_time,
    p_phone:row.phone,
    p_status:row.status,
    p_raw_text:row.raw_text
  };
  const r=await fetch(`${cfg.url}/rest/v1/rpc/ludia_sync_naver_booking_to_appointment`,{method:'POST',headers:{...cfg.headers,prefer:'return=representation'},body:JSON.stringify(payload)});
  if(!r.ok)throw new Error(`appointment projection ${r.status}: ${await r.text()}`);
  return true;
}

async function persistReviews(cfg,sid,reviews){
  if(!reviews.length)return 0;
  const payload=reviews.slice(0,200).filter(x=>x&&x.externalId).map(x=>({
    salon_id:sid,external_id:clean(x.externalId).slice(0,120),
    author_label:x.authorLabel?clean(x.authorLabel).slice(0,80):null,
    rating:Number.isFinite(Number(x.rating))?Math.max(0,Math.min(5,Number(x.rating))):null,
    review_text:clean(x.reviewText),updated_at:new Date().toISOString()
  }));
  if(!payload.length)return 0;
  const r=await fetch(`${cfg.url}/rest/v1/ludia_naver_reviews?on_conflict=salon_id,external_id`,{method:'POST',headers:{...cfg.headers,prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(payload)});
  if(!r.ok)throw new Error(`reviews ${r.status}: ${await r.text()}`);
  return payload.length;
}

async function persist(rows){
  const cfg=supabaseConfig();
  if(!cfg)return {persisted:false,reason:'supabase_not_configured',appointmentSynced:0};
  const sid=salonId();
  if(!sid)return {persisted:false,reason:'salon_not_configured',appointmentSynced:0};
  const bookings=rows.map(r=>({salon_id:sid,external_id:r.external_id,source:r.source,booking_no:r.booking_no,booking_date:r.booking_date,booking_time:r.booking_time,phone:r.phone,status:r.status,raw_text:r.raw_text,last_synced_at:r.received_at}));
  const bookingRes=await fetch(`${cfg.url}/rest/v1/ludia_external_bookings?on_conflict=salon_id,source,external_id`,{method:'POST',headers:{...cfg.headers,prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(bookings)});
  if(!bookingRes.ok)throw new Error(`external_bookings ${bookingRes.status}: ${await bookingRes.text()}`);
  const eventRes=await fetch(`${cfg.url}/rest/v1/ludia_booking_sync_events`,{method:'POST',headers:{...cfg.headers,prefer:'return=minimal'},body:JSON.stringify(rows.map(r=>({...r,salon_id:sid})))});
  if(!eventRes.ok)throw new Error(`booking_sync_events ${eventRes.status}: ${await eventRes.text()}`);

  let appointmentSynced=0;
  for(const row of rows){if(await syncAppointment(cfg,sid,row))appointmentSynced+=1;}
  await updateConnection(cfg,{eventCount:rows.length,appointmentCount:appointmentSynced});
  return {persisted:true,appointmentSynced};
}

export default async function handler(req,res){
  if(req.method==='GET')return json(res,200,{ok:true,service:'ludia-naver-sync',supabaseConfigured:Boolean(process.env.SUPABASE_URL&&(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)),salonConfigured:Boolean(process.env.LUDIA_SALON_ID),calendarProjection:true});
  if(req.method!=='POST')return json(res,405,{ok:false,error:'method_not_allowed'});
  const expected=process.env.LUDIA_SYNC_TOKEN;
  if(!expected)return json(res,503,{ok:false,error:'sync_token_not_configured'});
  if(req.headers.authorization!==`Bearer ${expected}`)return json(res,401,{ok:false,error:'unauthorized'});
  let body;
  try{body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});}catch{return json(res,400,{ok:false,error:'invalid_json'});}
  if(body.source!=='NAVER'||!Array.isArray(body.events)||!(body.reviews===undefined||Array.isArray(body.reviews)))return json(res,400,{ok:false,error:'invalid_payload'});
  if(body.events.length>200)return json(res,413,{ok:false,error:'too_many_events'});
  const rows=body.events.map(normalizeEvent).filter(Boolean);
  const reviews=Array.isArray(body.reviews)?body.reviews:[];
  const cfg=supabaseConfig();
  const sid=salonId();
  if((rows.length||reviews.length)&&!cfg)return json(res,503,{ok:false,error:'supabase_not_configured',retryable:true});
  if((rows.length||reviews.length)&&!sid)return json(res,503,{ok:false,error:'salon_not_configured',retryable:true});
  if(!rows.length&&!reviews.length){
    try{if(cfg&&sid)await updateConnection(cfg,{eventCount:0,appointmentCount:0});}catch(error){console.error('[LUDIA sync heartbeat]',error);return json(res,502,{ok:false,error:'heartbeat_persistence_failed'});}
    return json(res,200,{ok:true,accepted:0,persisted:Boolean(cfg&&sid),heartbeat:true});
  }
  try{
    const result=await persist(rows);
    if(!result.persisted)return json(res,503,{ok:false,error:result.reason||'persistence_unavailable',retryable:true});
    const reviewsSynced=await persistReviews(cfg,sid,reviews);
    return json(res,200,{ok:true,accepted:rows.length,reviewsSynced,...result});
  }
  catch(error){console.error('[LUDIA sync]',error);return json(res,502,{ok:false,error:'persistence_failed',retryable:true});}
}
