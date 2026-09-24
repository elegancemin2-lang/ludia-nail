/* LUDIA NAIL · post-checkout continuity sheet
 * Opens only after the checkout sheet closes following a successful completion.
 * Resolves the customer by the completed appointment id before prefilling a new booking.
 */
(()=>{
  'use strict';
  const $=s=>document.querySelector(s);
  let snapshot=null,watcher=null,client=null;

  function ensureSheet(){
    if($('#postCheckoutSheet'))return;
    document.body.insertAdjacentHTML('beforeend',`<div class="sheet post-checkout-sheet" id="postCheckoutSheet" aria-hidden="true">
      <div class="sheet-backdrop" data-post-close></div>
      <div class="sheet-card post-checkout-card">
        <div class="sheet-handle"></div>
        <button class="sheet-close" data-post-close aria-label="닫기">×</button>
        <div class="sheet-body post-checkout-body">
          <div class="post-checkout-check">✓</div>
          <span class="mini-label">SERVICE COMPLETE</span>
          <h2 id="postCheckoutTitle">시술을 마쳤어요</h2>
          <p id="postCheckoutMeta">결제와 매출이 저장되었습니다.</p>
          <div class="post-checkout-next"><b>다음 방문까지 이어서</b><span>최근 담당자와 시술을 그대로 불러와 시간만 고를 수 있어요.</span></div>
          <button class="post-checkout-primary" id="postCheckoutBook">다음 예약 잡기</button>
          <button class="post-checkout-secondary" data-post-close>지금은 완료</button>
        </div>
      </div>
    </div>`);
    document.querySelectorAll('[data-post-close]').forEach(x=>x.addEventListener('click',close));
    $('#postCheckoutBook').addEventListener('click',bookAgain);
  }

  function close(){const s=$('#postCheckoutSheet');if(!s)return;s.classList.remove('open');s.setAttribute('aria-hidden','true');document.body.style.overflow='';snapshot=null}
  function show(){if(!snapshot)return;ensureSheet();$('#postCheckoutTitle').textContent=`${snapshot.customer||'고객'} 시술을 마쳤어요`;$('#postCheckoutMeta').textContent=`${snapshot.service||'시술'} · 결제와 매출 저장 완료`;const s=$('#postCheckoutSheet');s.classList.add('open');s.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}

  async function getClient(){
    if(client)return client;
    const r=await fetch('/api/salon-config',{cache:'no-store'}),cfg=await r.json();
    if(!cfg?.configured||!window.supabase?.createClient)throw new Error('cloud unavailable');
    client=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'ludia-salon-auth'}});return client;
  }

  function capture(){
    const cloud=window.LudiaSalonCloud;if(!cloud?.isConnected?.())return null;
    const title=$('#opsDetailName')?.textContent||'',m=title.match(/^(\d{2}:\d{2})\s*·\s*(.+)$/);if(!m)return null;
    const a=(cloud.getLastPayload?.()?.appointments||[]).find(x=>x.time===m[1]&&x.customer===m[2]&&x.status!=='완료');
    return a?{cloudId:a.cloudId,customer:a.customer,service:a.service,staff:a.staff}:null;
  }

  function dispatchChange(el){if(el)el.dispatchEvent(new Event('change',{bubbles:true}))}
  async function resolveCustomer(){
    if(!snapshot?.cloudId)return null;const c=await getClient();
    const {data:a,error}=await c.from('ludia_appointments').select('customer_id').eq('id',snapshot.cloudId).single();if(error||!a?.customer_id)throw error||new Error('customer missing');
    const profile=await window.LudiaSalonCloud?.getCustomer360?.(a.customer_id);return profile?.customer?{id:a.customer_id,...profile.customer}:null;
  }

  async function bookAgain(){
    const btn=$('#postCheckoutBook');if(!btn||btn.disabled)return;btn.disabled=true;btn.textContent='고객 확인 중…';
    try{
      const customer=await resolveCustomer();if(!customer)throw new Error('customer unavailable');
      const keep={...snapshot};close();document.querySelector('[data-nav="booking"]')?.click();
      setTimeout(()=>{$('#quickAddBooking')?.click();setTimeout(()=>{
        const name=$('#qbCustomer'),phone=$('#qbPhone'),staff=$('#qbStaff'),service=$('#qbService'),duration=$('#qbDuration');
        if(name){name.value=customer.name||keep.customer||'';name.dataset.cloudCustomerId=customer.id;name.dataset.cloudCustomerName=name.value;name.addEventListener('input',function clear(){if(name.value!==name.dataset.cloudCustomerName){delete name.dataset.cloudCustomerId;delete name.dataset.cloudCustomerName;name.removeEventListener('input',clear)}})}
        if(phone)phone.value=customer.phone||'';
        if(staff&&[...staff.options].some(o=>o.value===keep.staff)){staff.value=keep.staff;dispatchChange(staff)}
        if(service&&[...service.options].some(o=>o.value===keep.service)){service.value=keep.service;dispatchChange(service)}
        const selected=window.LudiaSalonCloud?.getLastPayload?.()?.services?.find(s=>s.name===service?.value);if(selected?.duration_minutes&&duration){duration.value=String(selected.duration_minutes);dispatchChange(duration)}
        const note=$('#qbAvailabilityNote');if(note)note.textContent=`${keep.staff||'최근 담당자'} · ${keep.service||'최근 시술'} 기준으로 채웠어요. 추천 시간만 선택해 주세요.`;
      },100)},80);
    }catch(error){console.warn('[LUDIA post checkout]',error);alert('고객 정보를 안전하게 확인하지 못했어요. 고객 화면에서 다시 예약해 주세요.')}finally{if(btn){btn.disabled=false;btn.textContent='다음 예약 잡기'}}
  }

  document.addEventListener('click',e=>{
    if(!e.target.closest('#checkoutConfirm'))return;const captured=capture();if(!captured)return;snapshot=captured;
    const sheet=$('#checkoutSheet');if(!sheet)return;clearInterval(watcher);let ticks=0;
    watcher=setInterval(()=>{ticks++;if(!snapshot){clearInterval(watcher);return}if(!sheet.classList.contains('open')){clearInterval(watcher);setTimeout(show,120);return}if(ticks>100){clearInterval(watcher);snapshot=null}},100);
  },true);
})();