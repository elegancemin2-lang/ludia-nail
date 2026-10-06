/* LUDIA NAIL · booking availability preflight
 * Local preflight works without login; connected Supabase sessions use the authoritative DB slots.
 */
(()=>{
  const $=s=>document.querySelector(s);
  let client=null,salonId=null,staff=[],requestSeq=0,lastRows=[];
  const reasonLabel={outside_work_hours:'근무시간 외',time_off:'휴무',appointment_conflict:'같은 담당자 예약 있음',inactive_staff:'담당자 확인 필요',invalid_time:'시간 확인 필요'};
  function localDate(){return $('#quickBookingContext')?.dataset.date||new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
  async function cloud(){
    if(!window.LudiaSalonCloud?.isConnected?.())return null;
    if(client&&salonId)return client;
    if(!window.supabase?.createClient)return null;
    if(!client){
      const r=await fetch('/api/salon-config',{cache:'no-store'}),cfg=await r.json();
      if(!cfg?.configured)return null;
      client=await window.LudiaSalonCloud.getClient();
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
      let rows;
      if(!c){rows=window.LudiaBookingAvailability?.localRows(staffName,duration)||[];$('#qbSlotStrip').dataset.verification='local'}
      else{
        const person=staff.find(x=>x.display_name===staffName);if(!person){$('#qbAvailabilityState').textContent='담당자 확인';$('#qbSlotStrip').innerHTML='';return}
        const {data,error}=await c.rpc('ludia_staff_day_slots',{p_salon_id:salonId,p_staff_user_id:person.user_id,p_local_date:localDate(),p_duration_minutes:duration,p_step_minutes:window.LudiaBookingAvailability?.getStep?.()||30});
        if(error)throw error;if(seq!==requestSeq)return;rows=data||[];$('#qbSlotStrip').dataset.verification='server';
      }
      lastRows=rows;const strip=$('#qbSlotStrip');strip.innerHTML='';
      rows.forEach(row=>{
        const time=row.time||(row.slot_start?new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(row.slot_start)):null);if(!time)return;
        const b=document.createElement('button');b.type='button';b.className='qb-slot '+(row.available?'available':'blocked');b.disabled=!row.available;b.dataset.time=time;b.textContent=time;b.title=row.available?'예약 가능':(reasonLabel[row.reason]||'예약 불가');
        if(row.available)b.onclick=()=>{if($('#qbTime'))$('#qbTime').value=time;markSelected(rows);};strip.appendChild(b)
      });
      $('#qbAvailabilityState').textContent=`가능 ${rows.filter(x=>x.available).length}`;
      $('#qbAvailabilityMeta').textContent=`${staffName} · ${duration}분 기준`;
      markSelected(rows);
    }catch(error){if(seq!==requestSeq)return;console.warn('[LUDIA availability]',error.message);$('#qbAvailabilityState').textContent='확인 실패';$('#qbSlotStrip').innerHTML='<span class="qb-slot-loading">시간 확인에 실패했어요. 저장 시 서버가 다시 검증합니다.</span>';const save=$('#qbSaveBtn');if(save)save.disabled=false}
  }
  function markSelected(rows=[]){
    const time=$('#qbTime')?.value||'';document.querySelectorAll('.qb-slot').forEach(b=>b.classList.toggle('selected',b.dataset.time===time));
    const fmt=v=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v));
    const exact=rows.find(r=>(r.time||(r.slot_start?fmt(r.slot_start):null))===time),save=$('#qbSaveBtn');if(save)save.disabled=Boolean(exact&&!exact.available);
    const note=$('#qbAvailabilityNote');if(note&&exact&&!exact.available)note.textContent=reasonLabel[exact.reason]||'선택한 시간은 예약할 수 없어요.';else if(note)note.textContent=($('#qbSlotStrip')?.dataset.verification==='local'?'이 기기에 저장된 예약과 샵 영업시간 기준이에요.':'서버 근무·휴무·예약 기준이에요.');
  }
  function bind(){
    ensureUI();['qbStaff','qbDuration','qbService'].forEach(id=>$('#'+id)?.addEventListener('change',()=>setTimeout(refresh,0)));
    $('#qbTime')?.addEventListener('change',()=>{markSelected(lastRows);refresh()});
    const sheet=$('#quickBookingSheet');if(sheet)new MutationObserver(()=>{if(sheet.classList.contains('open'))setTimeout(refresh,40)}).observe(sheet,{attributes:true,attributeFilter:['class']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();

