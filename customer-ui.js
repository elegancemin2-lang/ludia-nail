/* LUDIA NAIL · Customer 360 native sheet */
(()=>{
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const won=v=>`${Number(v||0).toLocaleString('ko-KR')}원`;
  const date=v=>v?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'short',day:'numeric',weekday:'short'}).format(new Date(v)):'-';
  const statusLabel=s=>({completed:'완료',in_service:'진행중',arrived:'도착',confirmed:'예약',pending:'대기',cancelled:'취소',no_show:'노쇼'}[s]||s||'예약');
  let sheet=null,activeCustomer=null;

  function ensureSheet(){
    if(sheet)return sheet;
    sheet=document.createElement('div');sheet.className='sheet customer-360-sheet';sheet.id='customer360Sheet';sheet.setAttribute('aria-hidden','true');
    sheet.innerHTML='<div class="sheet-backdrop" data-c360-close></div><div class="sheet-card customer-360-card"><div class="sheet-handle"></div><button class="sheet-close" data-c360-close aria-label="닫기">×</button><div class="sheet-body" id="customer360Body"></div></div>';
    document.body.appendChild(sheet);sheet.querySelectorAll('[data-c360-close]').forEach(x=>x.addEventListener('click',close));return sheet;
  }
  function close(){ensureSheet().classList.remove('open');sheet.setAttribute('aria-hidden','true');document.body.style.overflow='';}
  function openShell(customer){activeCustomer=customer;ensureSheet();sheet.classList.add('open');sheet.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';renderLoading(customer);}
  function renderLoading(c){$('#customer360Body').innerHTML=`<div class="c360-kicker">CUSTOMER</div><div class="c360-head"><div><h2>${esc(c.name)}</h2><p>${esc(c.phone||'연락처 없음')}</p></div><span class="c360-live">불러오는 중</span></div><div class="c360-skeleton"><i></i><i></i><i></i></div>`;}
  function membershipText(m){if(m.kind==='amount')return won(m.remainingAmount);if(m.kind==='count')return `${Number(m.remainingCount||0)}회`;return '사용중';}
  function renderProfile(data,fallback){
    const c=data.customer||fallback||{};const memberships=data.memberships||[];const appointments=data.appointments||[];
    const tags=(c.tags||[]).map(t=>`<span>${esc(t)}</span>`).join('');
    const pref=c.preferences&&typeof c.preferences==='object'?Object.entries(c.preferences).filter(([,v])=>v!==null&&v!==''&&v!==false).slice(0,5):[];
    const active=memberships.filter(m=>m.status==='active');
    $('#customer360Body').innerHTML=`
      <div class="c360-kicker">CUSTOMER 360</div>
      <div class="c360-head"><div><h2>${esc(c.name)}</h2><p>${esc(c.phone||'연락처 없음')}</p></div><span class="c360-live">LIVE</span></div>
      ${tags?`<div class="c360-tags">${tags}</div>`:''}
      <div class="c360-metrics"><div><b>${won(data.lifetimeSales)}</b><span>누적 매출</span></div><div><b>${Number(c.visitCount||0)}회</b><span>방문</span></div><div><b>${won(data.averageTicket)}</b><span>객단가</span></div></div>
      <section class="c360-section"><div class="c360-title"><b>회원권</b><span>${active.length?`사용중 ${active.length}`:'없음'}</span></div>${active.length?`<div class="c360-list">${active.map(m=>`<div class="c360-row"><div><b>${esc(m.name||'회원권')}</b><small>${m.expiresAt?`${date(m.expiresAt)} 만료`:'만료일 없음'}</small></div><strong>${membershipText(m)}</strong></div>`).join('')}</div>`:'<p class="c360-empty">사용 중인 회원권이 없습니다.</p>'}</section>
      <section class="c360-section"><div class="c360-title"><b>고객 메모</b><span>시술 전 확인</span></div><div class="c360-note">${esc(c.memo||'등록된 주의사항이나 메모가 없습니다.')}</div>${pref.length?`<div class="c360-prefs">${pref.map(([k,v])=>`<span><b>${esc(k)}</b> ${esc(Array.isArray(v)?v.join(' · '):v)}</span>`).join('')}</div>`:''}</section>
      <section class="c360-section"><div class="c360-title"><b>최근 시술</b><span>${appointments.length}건</span></div>${appointments.length?`<div class="c360-timeline">${appointments.slice(0,8).map(a=>`<div class="c360-visit"><i></i><div><b>${esc(a.service||'시술')}</b><small>${date(a.startsAt)} · ${esc(a.staffName||'미지정')}${a.source==='naver'?' · 네이버':''}</small>${a.memo?`<p>${esc(a.memo)}</p>`:''}</div><span class="state-${esc(a.status)}">${esc(statusLabel(a.status))}</span></div>`).join('')}</div>`:'<p class="c360-empty">아직 시술 이력이 없습니다.</p>'}</section>
      <div class="c360-actions"><button class="soft-btn" data-c360-call ${c.phone?'':'disabled'}>전화</button><button class="primary-btn" data-c360-book>바로 예약</button></div>`;
    $('[data-c360-call]')?.addEventListener('click',()=>{if(c.phone)location.href='tel:'+String(c.phone).replace(/[^0-9+]/g,'')});
    $('[data-c360-book]')?.addEventListener('click',()=>{close();document.querySelector('[data-nav="booking"]')?.click();setTimeout(()=>document.querySelector('#quickAddBooking')?.click(),120)});
  }
  function renderFallback(c){renderProfile({customer:{...c,visitCount:c.visit||0,memo:c.note||'',preferences:c.preferences||{}},lifetimeSales:0,averageTicket:0,memberships:[],appointments:[]},c);}
  async function openCustomer(c){openShell(c);if(!c.cloudId||!window.LudiaSalonCloud?.isConnected()){renderFallback(c);return}try{const data=await window.LudiaSalonCloud.getCustomer360(c.cloudId);renderProfile(data,c)}catch(error){console.error('[LUDIA Customer 360]',error);renderFallback(c)}}
  function customerFromCard(card){const payload=window.LudiaSalonCloud?.getLastPayload?.();const name=card.querySelector('.customer-top b')?.textContent?.trim();const phone=card.querySelector('.customer-top small')?.textContent?.split('·')[0]?.trim();return payload?.customers?.find(c=>c.name===name&&(phone==='연락처 없음'||!phone||c.phone===phone))||payload?.customers?.find(c=>c.name===name)||null;}
  document.addEventListener('click',e=>{const card=e.target.closest('#customerGrid .customer-card');if(!card)return;const c=customerFromCard(card);if(!c)return;e.preventDefault();e.stopImmediatePropagation();openCustomer(c)},true);
})();