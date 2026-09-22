// Vercel serverless endpoint for the local LUDIA Naver Bridge.
// Required env: LUDIA_SYNC_TOKEN. Optional Supabase persistence: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
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

async function persist(rows){
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return {persisted:false,reason:'supabase_not_configured'};
  const headers={apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json',prefer:'resolution=merge-duplicates,return=minimal'};
  const bookings=rows.map(r=>({external_id:r.external_id,source:r.source,booking_no:r.booking_no,booking_date:r.booking_date,booking_time:r.booking_time,phone:r.phone,status:r.status,raw_text:r.raw_text,last_synced_at:r.received_at}));
  const bookingRes=await fetch(`${url}/rest/v1/external_bookings?on_conflict=source,external_id`,{method:'POST',headers,body:JSON.stringify(bookings)});
  if(!bookingRes.ok)throw new Error(`external_bookings ${bookingRes.status}: ${await bookingRes.text()}`);
  const eventRes=await fetch(`${url}/rest/v1/booking_sync_events`,{method:'POST',headers:{...headers,prefer:'return=minimal'},body:JSON.stringify(rows)});
  if(!eventRes.ok)throw new Error(`booking_sync_events ${eventRes.status}: ${await eventRes.text()}`);
  return {persisted:true};
}

export default async function handler(req,res){
  if(req.method==='GET')return json(res,200,{ok:true,service:'ludia-naver-sync',supabaseConfigured:Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY)});
  if(req.method!=='POST')return json(res,405,{ok:false,error:'method_not_allowed'});
  const expected=process.env.LUDIA_SYNC_TOKEN;
  if(!expected)return json(res,503,{ok:false,error:'sync_token_not_configured'});
  if(req.headers.authorization!==`Bearer ${expected}`)return json(res,401,{ok:false,error:'unauthorized'});
  const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
  if(body.source!=='NAVER'||!Array.isArray(body.events))return json(res,400,{ok:false,error:'invalid_payload'});
  if(body.events.length>200)return json(res,413,{ok:false,error:'too_many_events'});
  const rows=body.events.map(normalizeEvent).filter(Boolean);
  if(!rows.length)return json(res,200,{ok:true,accepted:0,persisted:false});
  try{const result=await persist(rows);return json(res,200,{ok:true,accepted:rows.length,...result});}
  catch(error){console.error('[LUDIA sync]',error);return json(res,502,{ok:false,error:'persistence_failed'});}
}
