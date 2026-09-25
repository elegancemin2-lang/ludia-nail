/* LUDIA NAIL · Supabase Salon OS adapter
 * Browser uses only the public anon/publishable key plus the authenticated user's JWT.
 * RLS remains the authority. Passwords are sent directly to Supabase Auth by the SDK and are never stored by LUDIA.
 */
window.LudiaSalonCloud=(()=>{
  let client=null,salonId=null,user=null,member=null,channel=null,callbacks={},reloadTimer=null;
  let staffRecords=[],serviceRecords=[],lastPayload=null;
  const state={configured:false,connected:false,loading:false,salonName:'',email:'',realtime:'offline',error:null};
  const $=s=>document.querySelector(s);
  const kstDateKey=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(value instanceof Date?value:new Date(value));
  const kstTime=value=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
  const shortDate=value=>value?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric'}).format(new Date(value)).replace(/\s/g,''):'신규';
  const normalizePhone=value=>String(value||'').replace(/\D/g,'');
  const uiStatus=status=>({completed:'완료',in_service:'진행중',arrived:'대기',confirmed:'대기',pending:'대기',cancelled:'취소',no_show:'노쇼'}[status]||'대기');
  const dbStatus=status=>status==='완료'?'completed':status==='진행중'?'in_service':status==='취소'?'cancelled':'confirmed';
  const membershipText=row=>{if(!row)return'없음';if(row.kind==='amount')return `${row.name_snapshot} ${Math.max(0,row.remaining_amount||0).toLocaleString('ko-KR')}원`;return `${row.name_snapshot} ${Math.max(0,row.remaining_count||0)}회`;};
  function emitStatus(patch={}){Object.assign(state,patch);callbacks.onStatus?.({...state});renderAuthSheet()}
  function fail(message,error){console.error('[LUDIA Salon Cloud]',error||message);emitStatus({loading:false,error:message,realtime:'offline'})}
  async function init(nextCallbacks={}){
    callbacks=nextCallbacks;bindUi();emitStatus({loading:true,error:null});let cfg;
    try{const r=await fetch('/api/salon-config',{cache:'no-store'});cfg=await r.json()}catch(error){return fail('클라우드 설정을 확인할 수 없어요',error)}
    state.configured=Boolean(cfg?.configured);if(!state.configured)return emitStatus({loading:false,connected:false,error:null,realtime:'offline'});
    if(!window.supabase?.createClient)return fail('Supabase 클라이언트를 불러오지 못했어요');
    client=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'ludia-salon-auth'}});
    client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'){resetCloudData();emitStatus({connected:false,loading:false,email:'',salonName:'',realtime:'offline',error:null});callbacks.onSignedOut?.();return}if(session?.user)setTimeout(()=>activateSession(session),0)});
    const {data:{session},error}=await client.auth.getSession();if(error)return fail('로그인 세션을 확인하지 못했어요',error);if(session?.user)await activateSession(session);else emitStatus({loading:false,connected:false,error:null,realtime:'offline'});
  }
  async function activateSession(session){user=session.user;state.email=user.email||'';emitStatus({loading:true,connected:false,error:null});await loadData()}
  async function loadData(){
    if(!client||!user)return;
    try{
      const {data:mine,error:mineError}=await client.from('ludia_salon_members').select('salon_id,user_id,display_name,role,is_active').eq('user_id',user.id).eq('is_active',true).limit(1);if(mineError)throw mineError;
      member=mine?.[0]||null;if(!member){salonId=null;resetCloudData(false);emitStatus({loading:false,connected:false,salonName:'',realtime:'offline',error:'salon_required'});return}salonId=member.salon_id;
      const today=new Date(),from=new Date(today),to=new Date(today);from.setDate(from.getDate()-14);to.setDate(to.getDate()+45);
      const [salonQ,staffQ,serviceQ,customerQ,membershipQ,appointmentQ]=await Promise.all([
        client.from('ludia_salons').select('id,name,timezone').eq('id',salonId).single(),
        client.from('ludia_salon_members').select('user_id,display_name,role,is_active,color_key').eq('salon_id',salonId).eq('is_active',true).order('created_at'),
        client.from('ludia_services').select('id,name,duration_minutes,price,is_active,sort_order').eq('salon_id',salonId).eq('is_active',true).order('sort_order'),
        client.from('ludia_customers').select('id,name,phone,memo,tags,visit_count,last_visit_at,preferences').eq('salon_id',salonId).order('last_visit_at',{ascending:false,nullsFirst:false}).limit(1000),
        client.from('ludia_customer_memberships').select('id,customer_id,kind,name_snapshot,remaining_amount,remaining_count,status,expires_at').eq('salon_id',salonId).eq('status','active'),
        client.from('ludia_appointments').select('id,customer_id,staff_user_id,service_id,source,external_source_id,customer_name_snapshot,customer_phone_snapshot,service_name_snapshot,starts_at,ends_at,status,price,memo').eq('salon_id',salonId).gte('starts_at',from.toISOString()).lt('starts_at',to.toISOString()).order('starts_at')
      ]);
      const firstError=[salonQ,staffQ,serviceQ,customerQ,membershipQ,appointmentQ].find(x=>x.error)?.error;if(firstError)throw firstError;
      staffRecords=staffQ.data||[];serviceRecords=serviceQ.data||[];const staffMap=new Map(staffRecords.map(x=>[x.user_id,x.display_name]));const membershipMap=new Map();(membershipQ.data||[]).forEach(x=>{if(!membershipMap.has(x.customer_id))membershipMap.set(x.customer_id,x)});
      const customersRaw=customerQ.data||[],customerMap=new Map(customersRaw.map(x=>[x.id,x])),todayKey=kstDateKey(new Date());const keyDay=key=>Math.round((Date.parse(key+'T00:00:00Z')-Date.parse(todayKey+'T00:00:00Z'))/86400000);
      const customers=customersRaw.map((c,i)=>({cloudId:c.id,name:c.name,phone:c.phone||'연락처 없음',visit:c.visit_count||0,last:shortDate(c.last_visit_at),tags:Array.isArray(c.tags)?c.tags:[],membership:membershipText(membershipMap.get(c.id)),note:c.memo||'',img:`assets/nail_${i%5+1}.jpg`,preferences:c.preferences||{}}));
      const appointments=(appointmentQ.data||[]).map(a=>{const customer=customerMap.get(a.customer_id),start=new Date(a.starts_at),end=new Date(a.ends_at);return{id:a.id,cloudId:a.id,dayOffset:keyDay(kstDateKey(start)),time:kstTime(start),customer:a.customer_name_snapshot||customer?.name||'고객',service:a.service_name_snapshot||'시술',staff:staffMap.get(a.staff_user_id)||'미지정',staffUserId:a.staff_user_id,serviceId:a.service_id,duration:Math.max(5,Math.round((end-start)/60000)),amount:a.price||0,status:uiStatus(a.status),dbStatus:a.status,source:a.source||'manual',note:a.memo||'',membership:membershipText(membershipMap.get(a.customer_id)),last:shortDate(customer?.last_visit_at)}});
      const payload={appointments,customers,staffNames:staffRecords.map(x=>x.display_name),staffRecords:[...staffRecords],services:[...serviceRecords],salonName:salonQ.data?.name||'',email:user.email||''};lastPayload=payload;callbacks.applyData?.(payload);emitStatus({loading:false,connected:true,salonName:payload.salonName,email:user.email||'',error:null});subscribeRealtime();
    }catch(error){fail('샵 데이터를 불러오지 못했어요',error)}
  }
  function subscribeRealtime(){if(!client||!salonId)return;if(channel)client.removeChannel(channel).catch(()=>{});channel=client.channel('ludia-salon-'+salonId).on('postgres_changes',{event:'*',schema:'public',table:'ludia_appointments',filter:`salon_id=eq.${salonId}`},queueReload).on('postgres_changes',{event:'*',schema:'public',table:'ludia_customers',filter:`salon_id=eq.${salonId}`},queueReload).on('postgres_changes',{event:'*',schema:'public',table:'ludia_customer_memberships',filter:`salon_id=eq.${salonId}`},queueReload).on('postgres_changes',{event:'*',schema:'public',table:'ludia_payments',filter:`salon_id=eq.${salonId}`},queueReload).subscribe(status=>emitStatus({realtime:status==='SUBSCRIBED'?'live':status==='CHANNEL_ERROR'?'error':'connecting'}))}
  function queueReload(){clearTimeout(reloadTimer);reloadTimer=setTimeout(()=>loadData(),220)}
  function resetCloudData(clearIdentity=true){salonId=null;member=null;staffRecords=[];serviceRecords=[];lastPayload=null;if(channel&&client)client.removeChannel(channel).catch(()=>{});channel=null;if(clearIdentity)user=null}
  async function signIn(email){if(!client)return fail('Supabase 설정이 필요해요');emitStatus({loading:true,error:null});const clean=email.trim();const {error}=await client.auth.signInWithOtp({email:clean,options:{emailRedirectTo:window.location.origin+window.location.pathname}});if(error){emitStatus({loading:false,connected:false,error:'login_failed'});throw error}emitStatus({loading:false,connected:false,error:null});callbacks.toast?.('이메일로 인증 링크를 보냈어요. 링크를 누르면 연결됩니다.')}
  async function signOut(){if(client)await client.auth.signOut()}
  async function createSalon({name,displayName,phone}){if(!client||!user)throw new Error('authentication required');const {data,error}=await client.rpc('ludia_create_salon_with_owner',{salon_name:name,owner_display_name:displayName,salon_phone:phone||null});if(error)throw error;salonId=data;await loadData();return data}
  async function saveAppointment(payload){
    if(!client||!salonId)return false;const phone=normalizePhone(payload.phone);let customerId=null;
    const prefilledId=payload.customerId||document.querySelector('#qbCustomer')?.dataset?.cloudCustomerId||null;
    if(prefilledId){const {data:exact,error}=await client.from('ludia_customers').select('id,name').eq('salon_id',salonId).eq('id',prefilledId).limit(1);if(error)throw error;if(exact?.[0]&&exact[0].name===payload.customer)customerId=exact[0].id}
    if(!customerId&&phone){const {data:found,error}=await client.from('ludia_customers').select('id').eq('salon_id',salonId).eq('phone_normalized',phone).limit(1);if(error)throw error;customerId=found?.[0]?.id||null}else if(!customerId&&!phone){const {data:found,error}=await client.from('ludia_customers').select('id').eq('salon_id',salonId).eq('name',payload.customer).limit(2);if(error)throw error;if(found?.length===1)customerId=found[0].id}
    if(!customerId){const {data:created,error}=await client.from('ludia_customers').insert({salon_id:salonId,name:payload.customer,phone:payload.phone||null,phone_normalized:phone||null}).select('id').single();if(error)throw error;customerId=created.id}
    const staff=staffRecords.find(x=>x.display_name===payload.staff)||null,service=serviceRecords.find(x=>x.name===payload.service)||null,[hour,minute]=payload.time.split(':').map(Number),d=payload.date,startsAt=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate(),hour-9,minute||0,0)),endsAt=new Date(startsAt.getTime()+payload.duration*60000),price=service?.price??payload.amount??0;
    const {error}=await client.from('ludia_appointments').insert({salon_id:salonId,customer_id:customerId,staff_user_id:staff?.user_id||null,service_id:service?.id||null,source:'manual',customer_name_snapshot:payload.customer,customer_phone_snapshot:payload.phone||null,service_name_snapshot:payload.service,starts_at:startsAt.toISOString(),ends_at:endsAt.toISOString(),status:'confirmed',price,memo:payload.note||''});if(error)throw error;await loadData();return true;
  }
  async function updateAppointmentStatus(id,nextStatus){if(!client||!salonId||!id)return false;const {error}=await client.from('ludia_appointments').update({status:dbStatus(nextStatus)}).eq('id',id).eq('salon_id',salonId);if(error)throw error;await loadData();return true}
  async function getCustomer360(customerId){if(!client||!salonId||!customerId)throw new Error('customer context unavailable');const {data,error}=await client.rpc('ludia_customer_360',{p_salon_id:salonId,p_customer_id:customerId});if(error)throw error;return data}
  async function refresh(){if(client&&user)await loadData()}
  function renderAuthSheet(){const sheet=$('#cloudAuthSheet');if(!sheet)return;const signed=$('#cloudSignedIn'),login=$('#cloudLoginPane'),setup=$('#cloudSetupPane');if(signed)signed.classList.toggle('hidden',!state.connected);if(login)login.classList.toggle('hidden',state.connected||Boolean(user));if(setup)setup.classList.toggle('hidden',!user||state.connected);if($('#cloudAuthEmail'))$('#cloudAuthEmail').textContent=state.email||'';if($('#cloudSalonLabel'))$('#cloudSalonLabel').textContent=state.salonName||'샵 미연결';if($('#cloudRealtimeLabel'))$('#cloudRealtimeLabel').textContent=state.realtime==='live'?'실시간 동기화 중':state.realtime==='connecting'?'실시간 연결 중':'동기화 대기';const err=$('#cloudAuthError');if(err){err.textContent=state.error==='login_failed'?'인증 링크를 보내지 못했어요. 이메일을 확인해 주세요':state.error==='salon_required'?'로그인은 완료됐어요. 사용할 샵을 만들어 주세요.':state.error&&state.error!=='salon_required'?state.error:'';err.classList.toggle('hidden',!err.textContent)}}
  function bindUi(){
    $('#cloudAccountBtn')?.addEventListener('click',openAuthSheet);document.querySelectorAll('[data-close-cloud]').forEach(x=>x.addEventListener('click',closeAuthSheet));
    $('#cloudLoginBtn')?.addEventListener('click',async()=>{const email=$('#cloudEmail')?.value||'';if(!email)return callbacks.toast?.('이메일을 입력해 주세요');try{await signIn(email)}catch(error){console.warn(error)}});
    $('#cloudLogoutBtn')?.addEventListener('click',()=>signOut());$('#cloudRefreshBtn')?.addEventListener('click',()=>refresh());
    $('#cloudCreateSalonBtn')?.addEventListener('click',async()=>{const name=$('#cloudSalonName')?.value.trim(),displayName=$('#cloudOwnerName')?.value.trim(),phone=$('#cloudSalonPhone')?.value.trim();if(!name||!displayName)return callbacks.toast?.('샵 이름과 내 표시 이름을 입력해 주세요');try{emitStatus({loading:true,error:null});await createSalon({name,displayName,phone});callbacks.toast?.('샵을 만들고 실시간 동기화를 시작했어요')}catch(error){fail('샵 생성에 실패했어요',error)}});
  }
  function openAuthSheet(){renderAuthSheet();const sheet=$('#cloudAuthSheet');sheet?.classList.add('open');sheet?.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}
  function closeAuthSheet(){const sheet=$('#cloudAuthSheet');sheet?.classList.remove('open');sheet?.setAttribute('aria-hidden','true');document.body.style.overflow=''}
  async function getAccessToken(){if(!client)return null;const {data}=await client.auth.getSession();return data?.session?.access_token||null}
  async function loadArtDesigns(){
    if(!client||!salonId)return [];
    const {data:projects,error:pErr}=await client.from('ludia_art_projects').select('id,title,status,tags,created_at,updated_at').eq('salon_id',salonId).order('updated_at',{ascending:false}).limit(300);
    if(pErr)throw pErr;if(!projects?.length)return [];
    const ids=projects.map(x=>x.id);
    const {data:snaps,error:sErr}=await client.from('ludia_art_design_snapshots').select('project_id,design_json,preview_image_url,estimated_price,estimated_duration_min,created_at').in('project_id',ids).order('created_at',{ascending:false});
    if(sErr)throw sErr;
    const firstSnap=new Map();(snaps||[]).forEach(x=>{if(!firstSnap.has(x.project_id))firstSnap.set(x.project_id,x)});
    const out=[];
    for(const p of projects){
      const s=firstSnap.get(p.id)||{},meta=s.design_json||{};let img=null;
      if(s.preview_image_url){
        const {data}=await client.storage.from('ludia-art').createSignedUrl(s.preview_image_url,3600);
        img=data?.signedUrl||null;
      }
      out.push({id:p.id,name:p.title,status:p.status==='monthly'?'이달의아트':p.status==='favorite'?'즐겨찾기':'후보',tags:p.tags||[],img,price:s.estimated_price||meta.price||0,time:s.estimated_duration_min||meta.time||0,diff:meta.difficulty||'보통',materials:Array.isArray(meta.materials)?meta.materials:[],tech:meta.tech||'',desc:meta.description||'',category:meta.category||'',savedAt:p.updated_at||p.created_at,cloudArt:true});
    }
    return out;
  }
  async function saveArtDesign({name,photoFile,price,time,tags=[],category='',materials=[],difficulty='보통',tech='',description='',status='draft'}){
    if(!client||!user||!salonId)throw new Error('salon authentication required');
    const title=String(name||'').trim();if(!title)throw new Error('design name required');
    const {data:project,error:pErr}=await client.from('ludia_art_projects').insert({salon_id:salonId,title,purpose:'salon_library',status,tags,created_by:user.id}).select('id,title,status,tags,created_at,updated_at').single();
    if(pErr)throw pErr;
    let path=null;
    try{
      if(photoFile){
        const ext=(photoFile.name?.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
        path=`${salonId}/designs/${project.id}/cover-${Date.now()}.${ext}`;
        const {error:uErr}=await client.storage.from('ludia-art').upload(path,photoFile,{cacheControl:'3600',upsert:false,contentType:photoFile.type||'image/jpeg'});
        if(uErr)throw uErr;
      }
      const meta={price:Number(price)||0,time:Number(time)||0,category,materials,difficulty,tech,description};
      const {error:sErr}=await client.from('ludia_art_design_snapshots').insert({project_id:project.id,source_type:'manual',design_json:meta,preview_image_url:path,render_status:'ready',estimated_price:Number(price)||null,estimated_duration_min:Number(time)||null});
      if(sErr)throw sErr;
      const designs=await loadArtDesigns();return designs.find(x=>x.id===project.id)||{...project,name:title,img:null,price:Number(price)||0,time:Number(time)||0,tags,materials,tech,desc:description,cloudArt:true};
    }catch(error){
      try{await client.from('ludia_art_projects').delete().eq('id',project.id)}catch(_){}
      if(path)try{await client.storage.from('ludia-art').remove([path])}catch(_){}
      throw error;
    }
  }
  return{init,refresh,signIn,signOut,saveAppointment,updateAppointmentStatus,getCustomer360,loadArtDesigns,saveArtDesign,openAuthSheet,getAccessToken,getState:()=>({...state}),getLastPayload:()=>lastPayload,isConnected:()=>state.connected};
})();