/* LUDIA NAIL · calendar availability shading
 * Preflights visible hourly cells against the same server RPC used by quick booking.
 * The database trigger remains authoritative when an appointment is saved.
 */
(()=>{
  const $=s=>document.querySelector(s);
  let client=null,salonId=null,staff=[],refreshSeq=0,timer=null;
  const labels={outside_work_hours:'근무시간 외',time_off:'휴무',appointment_conflict:'예약 있음',inactive_staff:'비활성 직원'};

  function selectedDate(){
    const text=$('#bookingCountLabel')?.textContent||'';
    const m=text.match(/(\d{1,2})월\s*(\d{1,2})일/),now=new Date();
    if(!m)return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(now);
    let y=now.getFullYear(),mo=Number(m[1]),d=Number(m[2]);
    if(now.getMonth()===11&&mo===1)y++;
    if(now.getMonth()===0&&mo===12)y--;
    return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }

  async function cloud(){
    if(client&&salonId)return client;
    if(!window.supabase?.createClient)return null;
    if(!client){
      const r=await fetch('/api/salon-config',{cache:'no-store'}),cfg=await r.json();
      if(!cfg?.configured)return null;
      client=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'ludia-salon-auth'}});
    }
    const {data:{session}}=await client.auth.getSession();
    if(!session?.user)return null;
    const {data:mine}=await client.from('ludia_salon_members').select('salon_id').eq('user_id',session.user.id).eq('is_active',true).limit(1);
    salonId=mine?.[0]?.salon_id||null;
    if(salonId){
      const {data}=await client.from('ludia_salon_members').select('user_id,display_name').eq('salon_id',salonId).eq('is_active',true);
      staff=data||[];
    }
    return salonId?client:null;
  }

  function clearState(){
    document.querySelectorAll('#bookingList .booking-slot').forEach(el=>{
      el.classList.remove('availability-blocked','availability-open','availability-loading');
      el.removeAttribute('data-availability-reason');
      el.disabled=false;
    });
    document.querySelectorAll('#bookingStaffHeader .staff-availability-badge').forEach(el=>el.remove());
  }

  function addHeaderBadge(name,text,kind='open'){
    document.querySelectorAll('#bookingStaffHeader .booking-staff-person').forEach(el=>{
      if(el.querySelector('b')?.textContent.trim()!==name)return;
      let badge=el.querySelector('.staff-availability-badge');
      if(!badge){badge=document.createElement('span');badge.className='staff-availability-badge';el.appendChild(badge)}
      badge.className=`staff-availability-badge ${kind}`;badge.textContent=text;
    });
  }

  function applyRows(name,rows){
    const byHour=new Map();
    rows.forEach(row=>{
      if(!row.slot_start)return;
      const hour=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',hour12:false}).format(new Date(row.slot_start));
      byHour.set(Number(hour),row);
    });
    let open=0,blocked=0;
    document.querySelectorAll('#bookingList .booking-slot').forEach(slot=>{
      const m=(slot.getAttribute('aria-label')||'').match(/^(.*?)\s+(\d{1,2})시\s+빈 시간 예약$/);
      if(!m||m[1]!==name)return;
      const row=byHour.get(Number(m[2]));if(!row)return;
      slot.classList.remove('availability-loading');
      if(row.available){slot.classList.add('availability-open');open++;return}
      slot.classList.add('availability-blocked');slot.disabled=true;blocked++;
      const reason=labels[row.reason]||'예약 불가';slot.dataset.availabilityReason=reason;
      slot.setAttribute('aria-label',`${name} ${m[2]}시 ${reason}`);
    });
    addHeaderBadge(name,open?`가능 ${open}`:(blocked?'예약 마감':'확인'),'open');
  }

  async function refresh(){
    const screen=$('#bookingScreen');if(!screen?.classList.contains('active'))return;
    const seq=++refreshSeq;clearState();
    const slots=[...document.querySelectorAll('#bookingList .booking-slot')];if(!slots.length)return;
    slots.forEach(x=>x.classList.add('availability-loading'));
    try{
      const c=await cloud();if(seq!==refreshSeq)return;
      if(!c){slots.forEach(x=>x.classList.remove('availability-loading'));return}
      const names=[...new Set(slots.map(x=>(x.getAttribute('aria-label')||'').match(/^(.*?)\s+\d{1,2}시/)?.[1]).filter(Boolean))];
      await Promise.all(names.map(async name=>{
        const person=staff.find(x=>x.display_name===name);if(!person)return addHeaderBadge(name,'직원 확인','muted');
        const {data,error}=await c.rpc('ludia_staff_day_slots',{p_salon_id:salonId,p_staff_user_id:person.user_id,p_local_date:selectedDate(),p_duration_minutes:60,p_step_minutes:60});
        if(error)throw error;if(seq===refreshSeq)applyRows(name,data||[]);
      }));
    }catch(error){
      console.warn('[LUDIA calendar availability]',error);
      if(seq===refreshSeq){slots.forEach(x=>x.classList.remove('availability-loading'));document.querySelectorAll('#bookingStaffHeader .booking-staff-person').forEach(el=>addHeaderBadge(el.querySelector('b')?.textContent||'','근무 확인 실패','muted'))}
    }
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(refresh,90)}
  function bind(){
    const list=$('#bookingList'),screen=$('#bookingScreen');if(!list||!screen)return;
    new MutationObserver(schedule).observe(list,{childList:true});
    new MutationObserver(schedule).observe(screen,{attributes:true,attributeFilter:['class']});
    $('#bookingWeekStrip')?.addEventListener('click',schedule);
    $('#staffTabs')?.addEventListener('click',schedule);
    schedule();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
