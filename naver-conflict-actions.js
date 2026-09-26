/* LUDIA NAIL · authenticated manager actions for Naver schedule conflicts */
window.LudiaNaverConflicts=(()=>{
  let clientPromise=null;
  async function client(){
    if(clientPromise)return clientPromise;
    clientPromise=(async()=>{
      const r=await fetch('/api/salon-config',{cache:'no-store'}),cfg=await r.json();
      if(!cfg?.configured||!window.supabase?.createClient)throw new Error('cloud unavailable');
      return await window.LudiaSalonCloud.getClient();
    })();
    return clientPromise;
  }
  async function resolve(conflictId,action){
    if(!Number.isFinite(Number(conflictId)))throw new Error('invalid conflict');
    if(!['keep_ludia','accept_naver'].includes(action))throw new Error('invalid action');
    const c=await client();
    const {data:{session}}=await c.auth.getSession();
    if(!session?.user)throw new Error('login required');
    const {data,error}=await c.rpc('ludia_resolve_naver_conflict',{p_conflict_id:Number(conflictId),p_action:action});
    if(error)throw error;
    return data;
  }
  return{resolve};
})();

