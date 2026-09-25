// Privacy-safe dashboard status for LUDIA's Naver booking bridge.
// No customer names, phone numbers, booking numbers, external ids or raw text are returned.
// Requires the signed-in Supabase user's JWT. The server resolves the user's active salon membership before returning data.
const json=(res,status,body)=>res.status(status).setHeader('content-type','application/json; charset=utf-8').end(JSON.stringify(body));

function config(){
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url&&key?{url,key,headers:{apikey:key,authorization:`Bearer ${key}`}}:null;
}
async function readJson(url,headers){const r=await fetch(url,{headers});if(!r.ok)throw new Error(`${r.status}: ${await r.text()}`);return r.json();}
async function resolveSalon(req,cfg){
  const auth=String(req.headers.authorization||'');
  if(!auth.startsWith('Bearer '))return null;
  const token=auth.slice(7).trim();if(!token)return null;
  const userRes=await fetch(`${cfg.url}/auth/v1/user`,{headers:{apikey:cfg.key,authorization:`Bearer ${token}`}});
  if(!userRes.ok)return null;
  const user=await userRes.json();if(!user?.id)return null;
  const rows=await readJson(`${cfg.url}/rest/v1/ludia_salon_members?user_id=eq.${encodeURIComponent(user.id)}&is_active=eq.true&select=salon_id,role&limit=1`,cfg.headers);
  const member=rows?.[0];return member?.salon_id?{salonId:member.salon_id,userId:user.id,role:member.role||'member'}:null;
}
function staleState(row){
  if(!row)return {state:'setup_required',freshness:'never'};
  if(row.state==='reauth_required'||row.state==='error')return {state:row.state,freshness:'attention'};
  if(!row.last_sync_at)return {state:'setup_required',freshness:'never'};
  const age=Math.max(0,Date.now()-new Date(row.last_sync_at).getTime());
  if(age>10*60*1000)return {state:'stale',freshness:'stale'};
  return {state:'connected',freshness:age<90*1000?'live':'recent'};
}
function safeBooking(row){return {status:String(row.status||'unknown').slice(0,24),bookingDate:row.booking_date||null,bookingTime:row.booking_time||null,customerLabel:row.phone?('고객 · '+String(row.phone).replace(/\D/g,'').slice(-4)): '네이버 고객'};}
function safeEvent(row){
  return {type:row.event_type==='created'?'created':'updated',status:String(row.status||'unknown').slice(0,24),bookingDate:row.booking_date||null,bookingTime:row.booking_time||null,receivedAt:row.received_at||null};
}
function safeReview(row){return {id:row.id,rating:row.rating==null?null:Number(row.rating),authorLabel:String(row.author_label||'네이버 고객').slice(0,40),reviewText:String(row.review_text||'').slice(0,500),replyState:String(row.reply_state||'pending').slice(0,24),detectedAt:row.detected_at||null};}
function safeConflict(row){
  return {id:Number(row.id),requestedStartsAt:row.requested_starts_at||null,requestedEndsAt:row.requested_ends_at||null,detectedAt:row.detected_at||null};
}
export default async function handler(req,res){
  if(req.method!=='GET')return json(res,405,{ok:false,error:'method_not_allowed'});
  const cfg=config();if(!cfg)return json(res,503,{ok:false,error:'server_not_configured'});
  let access;
  try{access=await resolveSalon(req,cfg);}catch(error){console.error('[LUDIA status auth]',error);return json(res,502,{ok:false,error:'auth_unavailable'});}
  if(!access)return json(res,401,{ok:false,error:'unauthorized'});
  const sid=access.salonId;
  try{
    const connection=(await readJson(`${cfg.url}/rest/v1/ludia_integration_connections?salon_id=eq.${encodeURIComponent(sid)}&provider=eq.NAVER&select=state,last_sync_at,last_error,metadata&limit=1`,cfg.headers))[0]||null;
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const [bookings,upcoming,events,conflicts,reviews]=await Promise.all([
      readJson(`${cfg.url}/rest/v1/ludia_external_bookings?salon_id=eq.${encodeURIComponent(sid)}&source=eq.NAVER&booking_date=eq.${encodeURIComponent(today)}&select=status`,cfg.headers),
      readJson(`${cfg.url}/rest/v1/ludia_external_bookings?salon_id=eq.${encodeURIComponent(sid)}&source=eq.NAVER&status=eq.requested&booking_date=gte.${encodeURIComponent(today)}&select=status,booking_date,booking_time,phone&order=booking_date.asc,booking_time.asc&limit=5`,cfg.headers),
      readJson(`${cfg.url}/rest/v1/ludia_booking_sync_events?salon_id=eq.${encodeURIComponent(sid)}&source=eq.NAVER&select=event_type,status,booking_date,booking_time,received_at&order=received_at.desc&limit=20`,cfg.headers),
      readJson(`${cfg.url}/rest/v1/ludia_naver_sync_conflicts?salon_id=eq.${encodeURIComponent(sid)}&resolved_at=is.null&select=id,requested_starts_at,requested_ends_at,detected_at&order=detected_at.desc&limit=20`,cfg.headers),
      readJson(`${cfg.url}/rest/v1/ludia_naver_reviews?salon_id=eq.${encodeURIComponent(sid)}&select=id,rating,author_label,review_text,reply_state,detected_at&order=detected_at.desc&limit=30`,cfg.headers)
    ]);
    const health=staleState(connection);
    return json(res,200,{ok:true,configured:true,...health,lastSyncAt:connection?.last_sync_at||null,lastError:connection?.last_error||null,today:{total:bookings.length,confirmed:bookings.filter(x=>x.status==='confirmed').length,cancelled:bookings.filter(x=>x.status==='cancelled').length,requested:bookings.filter(x=>x.status==='requested').length},approvalQueue:{count:upcoming.length,items:upcoming.map(safeBooking)},recentEvents:events.map(safeEvent),conflicts:conflicts.map(safeConflict),reviews:{pending:reviews.filter(x=>['pending','drafted','manual_review','failed'].includes(x.reply_state)).length,items:reviews.map(safeReview)}});
  }catch(error){console.error('[LUDIA status]',error);return json(res,502,{ok:false,error:'status_unavailable'});}
}
