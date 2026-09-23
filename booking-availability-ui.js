/* LUDIA NAIL · booking availability preflight
 * Uses the authenticated Supabase browser session only. DB trigger remains authoritative.
 */
(()=>{
  const $=s=>document.querySelector(s);
  let client=null,salonId=null,staff=[],requestSeq=0;
  const reasonLabel={outside_work_hours:'근무시간 외',time_off:'휴무',appointment_conflict:'예약 있음',inactive_staff:'비활성 직원'};
  function localDate(){
    const text=$('#quickBookingContext')?.textContent||'';
    const m=text.match(/(\d{1,2})월\s*(\d{1,2})일/),now=new Date();
    if(!m)return now.toISOString().slice(0,10);
    let year=now.getFullYear(),month=Number(m[1]),day=Number(m[2]);
    if(now.getMonth()===11&&month===1)year++;
    if(now.getMonth()===0&&month===12)year--;
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  async function cloud(){
    if(client&&salonId)return client;
    if(!window.supabase?.createClient)return null;
    if(!client){
      const r=await fetch('/api/salon-config',{cache:'no-store'}),cfg=await r.json();
      if(!cfg?.configured)return null;
      client=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'ludia-salon-auth'}});
    }
    const {data:{session}}=await client.auth.getSession();if(!session?.user)return null;
    const {data:mine}=await client.from('ludia_salon_members').select('salon_id').eq('user_id',session.user.id).eq('is_active',true).limit(1);
    salonId=mine?.[0]?.salon_id||null;
    if(salonId){const {data}=await client.from('ludia_salon_members').select('user_id,display_name').eq('salon_id',salonId).eq('is_active',true);staff=data||[]}
    return salonId?client:null;
  }
  function ensureUI(){
    const ctx=$('#quickBookingContext');if(!ctx||$('#qbAvailability'))return;
    const wrap=document.createElement('section');wrap.id='qbAvailability';wrap.className='qb-availability';wrap.innerHTML='<div class="qb-availability-head"><div><b>예약 가능 시간</b><small id="qbAvailabilityMeta">담당자와 시술시간 기준</small></div><span id="qbAvailabilityState">확인 중</span></div><div class="qb-slot-strip" id="qbSlotStrip"></div><p class="qb-availability-note" id="qbAvailabilityNote">회색 시간은 선택할 수 없어요.</p>';
    ctx.insertAdjacentElement('afterend',wrap);
  }
  function renderLoading(){ensureUI();const strip=$('#qbSlotStrip');if(strip)strip.innerHTML='<span class="qb-slot-loading">가능 시간을 확인하고 있어요…</span>';if($('#qbAvailabilityState'))$('#qbAvailabilityState').textContent='확인 중'}
  async function refresh(){
    const sheet=$('#quickBookingSheet');if(!sheet?.classList.contains('open'))return;
    ensureUI();const seq=++requestSeq,staffName=$('#qbStaff')?.value,duration=Number($('#qbDuration')?.value)||90;
    if(!staffName)return;renderLoading();
    try{
      const c=await cloud();if(seq!==requestSeq)return;
      if(!c){$('#qbAvailabilityState').textContent='오프라인';$('#qbSlotStrip').innerHTML='<span class="qb-slot-loading">클라우드 연결 후 근무·휴무 시간을 확인할 수 있어요.</span>';return}
      const person=staff.find(x=>x.display_name===staffName);if(!person){$('#qbAvailabilityState').textContent='담당자 확인';return}
      const {data,error}=await c.rpc('ludia_staff_day_slots',{p_salon_id:salonId,p_staff_user_id:person.user_id,p_local_date:localDate(),p_duration_minutes:duration,p_step_minutes:30});
      if(error)throw error;if(seq!==requestSeq)return;
      const rows=data||[],strip=$('#qbSlotStrip');strip.innerHTML='';
      rows.forEach(row=>{
        if(!row.slot_start)return;const d=new Date(row.slot_start),time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);
        const b=document.createElement('button');b.type='button';b.className='qb-slot '+(row.available?'available':'blocked');b.disabled=!row.available;b.dataset.time=time;b.textContent=time;b.title=row.available?'예약 가능':(reasonLabel[row.reason]||'예약 불가');
        if(row.available)b.onclick=()=>{if($('#qbTime'))$('#qbTime').value=time;markSelected(rows);};strip.appendChild(b)
      });
      $('#qbAvailabilityState').textContent=`가능 ${rows.filter(x=>x.available).length}`;
      $('#qbAvailabilityMeta').textContent=`${staffName} · ${duration}분 기준`;
      markSelected(rows);
    }catch(error){console.warn('[LUDIA availability]',error);$('#qbAvailabilityState').textContent='확인 실패';$('#qbSlotStrip').innerHTML='<span class="qb-slot-loading">시간 확인에 실패했어요. 저장 시 서버가 다시 검증합니다.</span>';const save=$('#qbSaveBtn');if(save)save.disabled=false}
  }
  function markSelected(rows=[]){
    const time=$('#qbTime')?.value||'';document.querySelectorAll('.qb-slot').forEach(b=>b.classList.toggle('selected',b.dataset.time===time));
    const fmt=v=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v));
    const exact=rows.find(r=>r.slot_start&&fmt(r.slot_start)===time),save=$('#qbSaveBtn');if(save)save.disabled=Boolean(exact&&!exact.available);
    const note=$('#qbAvailabilityNote');if(note&&exact&&!exact.available)note.textContent=reasonLabel[exact.reason]||'선택한 시간은 예약할 수 없어요.';else if(note)note.textContent='회색 시간은 근무·휴무·기존 예약 기준으로 선택할 수 없어요.';
  }
  function bind(){
    ensureUI();['qbStaff','qbDuration','qbService'].forEach(id=>$('#'+id)?.addEventListener('change',()=>setTimeout(refresh,0)));
    $('#qbTime')?.addEventListener('change',refresh);
    const sheet=$('#quickBookingSheet');if(sheet)new MutationObserver(()=>{if(sheet.classList.contains('open'))setTimeout(refresh,40)}).observe(sheet,{attributes:true,attributeFilter:['class']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
