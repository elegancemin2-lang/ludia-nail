// Public browser configuration for LUDIA Salon OS.
// Safe to expose: Supabase URL + anon/publishable key are designed for browser clients.
// Never expose SUPABASE_SERVICE_ROLE_KEY here.
const json=(res,status,body)=>res.status(status).setHeader('content-type','application/json; charset=utf-8').setHeader('cache-control','no-store').end(JSON.stringify(body));

export default function handler(req,res){
  if(req.method!=='GET')return json(res,405,{ok:false,error:'method_not_allowed'});
  const url=process.env.SUPABASE_URL||'https://kcwahwlhzlgpzuxjqbqu.supabase.co';
  const anonKey=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||'sb_publishable_s1pEA3miO6gMfAuquy033Q_kqitiP6C';
  if(!url||!anonKey)return json(res,200,{ok:true,configured:false});
  return json(res,200,{ok:true,configured:true,url,anonKey});
}
