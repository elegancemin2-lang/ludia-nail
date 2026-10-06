import {json,config,readJson,resolveAccess,salonExists} from '../server/naver-access.mjs';
export function staleState(row){
 if(!row)return {state:'bridge_waiting',freshness:'never'};
 if(['login_required','reauth_required','error','selector_required','bridge_waiting','setup_required'].includes(row.state))return {state:row.state,freshness:'attention'};
 const at=Date.parse(row.last_sync_at||''),age=Date.now()-at;
 if(!Number.isFinite(at)||row.metadata?.diagnostics?.parser_verified!==true)return {state:'selector_required',freshness:'never'};
 if(age>600000)return {state:'stale',freshness:'stale'};
 if(age < -60000)return {state:'error',freshness:'attention'};
 return {state:'connected',freshness:age<90000?'live':'recent'};
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
  const cfg=config();if(!cfg)return json(res,200,{ok:true,configured:false,publicHealth:true,state:'setup_required',freshness:'never',lastSyncAt:null});
  const auth=Boolean(req.headers.authorization||req.headers['x-ludia-integration-token']);
  let access=null;
  if(auth){
    try{access=await resolveAccess(req,cfg);}catch(error){console.error('[LUDIA status auth]',error);return json(res,502,{ok:false,error:'auth_unavailable'});}
    if(!access)return json(res,401,{ok:false,error:'unauthorized'});
  }
  const sid=access?.salonId||process.env.LUDIA_SALON_ID||null;
  let exists=false;try{exists=Boolean(sid)&&await salonExists(cfg,sid)}catch{return json(res,502,{ok:false,error:'status_unavailable'})}
  if(!exists)return json(res,200,{ok:true,configured:false,publicHealth:!access,state:'setup_required',freshness:'never',lastSyncAt:null,today:{},approvalQueue:{count:0,items:[]},recentEvents:[],conflicts:[],reviews:{pending:0,items:[]}});
  if(!access){
    try{
      const connection=(await readJson(`${cfg.url}/rest/v1/ludia_integration_connections?salon_id=eq.${encodeURIComponent(sid)}&provider=eq.NAVER&select=state,last_sync_at,metadata&limit=1`,cfg.headers))[0]||null;
      const health=staleState(connection);
      return json(res,200,{ok:true,configured:true,publicHealth:true,adminConfigured:Boolean(process.env.LUDIA_INTEGRATION_ADMIN_TOKEN?.length>=32&&process.env.LUDIA_INTEGRATION_ADMIN_TOKEN!==process.env.LUDIA_SYNC_TOKEN),...health,lastSyncAt:connection?.last_sync_at||null,today:{},approvalQueue:{count:0,items:[]},recentEvents:[],conflicts:[],reviews:{pending:0,items:[]}});
    }catch(error){console.error('[LUDIA public Naver status]',error);return json(res,502,{ok:false,error:'status_unavailable'});}
  }
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
    return json(res,200,{ok:true,configured:true,publicHealth:false,canResolve:['owner','manager','integration_admin'].includes(access.role),...health,lastSyncAt:connection?.last_sync_at||null,lastError:connection?.state==='error'?'브리지 동기화 오류 · PC 로그를 확인하세요':null,today:{total:bookings.length,confirmed:bookings.filter(x=>x.status==='confirmed').length,cancelled:bookings.filter(x=>x.status==='cancelled').length,requested:bookings.filter(x=>x.status==='requested').length},approvalQueue:{count:upcoming.length,items:upcoming.map(safeBooking)},recentEvents:events.map(safeEvent),conflicts:conflicts.map(safeConflict),reviews:{pending:reviews.filter(x=>['pending','drafted','manual_review','failed'].includes(x.reply_state)).length,items:reviews.map(safeReview)}});
  }catch(error){console.error('[LUDIA status]',error);return json(res,502,{ok:false,error:'status_unavailable'});}
}
