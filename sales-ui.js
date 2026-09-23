/* LUDIA NAIL · native sales dashboard
 * Reads only the authenticated salon through ludia_sales_summary().
 * No revenue totals are calculated from appointment cards in the browser.
 */
(()=>{
  'use strict';
  let client=null,salonId=null,range='today',busy=false;
  const $=s=>document.querySelector(s);
  const won=n=>`${Number(n||0).toLocaleString('ko-KR')}원`;
  const labels={card:'카드',cash:'현금',transfer:'이체',membership:'회원권',other:'기타'};

  function ensureSheet(){
    if($('#salesSheet'))return;
    document.body.insertAdjacentHTML('beforeend',`<div class="sheet sales-sheet" id="salesSheet" aria-hidden="true">
      <div class="sheet-backdrop" data-close-sales></div><div class="sheet-card sales-card"><div class="sheet-handle"></div>
      <button class="sheet-close" data-close-sales aria-label="닫기">×</button><div class="sheet-body sales-body">
        <div class="sales-head"><div><span class="mini-label">SALES</span><h2>매출</h2><p id="salesRangeLabel">오늘 결제 기준</p></div><button class="sales-refresh" id="salesRefresh" aria-label="새로고침">↻</button></div>
        <div class="sales-range" id="salesRange"><button data-range="today" class="active">오늘</button><button data-range="week">이번 주</button><button data-range="month">이번 달</button></div>
        <div id="salesContent"><div class="sales-loading">매출을 불러오는 중…</div></div>
      </div></div></div>`);
    document.querySelectorAll('[data-close-sales]').forEach(x=>x.addEventListener('click',close));
    $('#salesRange').addEventListener('click',e=>{const b=e.target.closest('[data-range]');if(!b||busy)return;range=b.dataset.range;document.querySelectorAll('#salesRange [data-range]').forEach(x=>x.classList.toggle('active',x===b));load()});
    $('#salesRefresh').addEventListener('click',()=>load());
  }
  async function getClient(){
    if(client)return client;
    const r=await fetch('/api/salon-config',{cache:'no-store'}),cfg=await r.json();
    if(!cfg?.configured||!window.supabase?.createClient)throw new Error('cloud_unavailable');
    client=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'ludia-salon-auth'}});
    return client;
  }
  async function resolveSalon(){
    if(salonId)return salonId;const c=await getClient();const {data:{session}}=await c.auth.getSession();if(!session?.user)throw new Error('login_required');
    const {data,error}=await c.from('ludia_salon_members').select('salon_id').eq('user_id',session.user.id).eq('is_active',true).limit(1);if(error)throw error;
    salonId=data?.[0]?.salon_id||null;if(!salonId)throw new Error('salon_required');return salonId;
  }
  function bounds(){
    const now=new Date(),parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).reduce((a,p)=>(a[p.type]=p.value,a),{});
    const y=+parts.year,m=+parts.month-1,d=+parts.day;let start;
    if(range==='month')start=new Date(Date.UTC(y,m,1,-9));
    else if(range==='week'){const base=new Date(Date.UTC(y,m,d,-9)),day=(base.getUTCDay()+6)%7;start=new Date(base.getTime()-day*86400000)}
    else start=new Date(Date.UTC(y,m,d,-9));
    const end=range==='today'?new Date(start.getTime()+86400000):range==='week'?new Date(start.getTime()+7*86400000):new Date(Date.UTC(y,m+1,1,-9));
    return{start,end};
  }
  function render(data){
    const methods=data.methods||[],staff=data.staff||[],daily=data.daily||[];const maxDay=Math.max(1,...daily.map(x=>Number(x.amount||0)));
    $('#salesContent').innerHTML=`<section class="sales-hero"><span>총 매출</span><strong>${won(data.grossSales)}</strong><div><b>${data.paymentCount||0}건</b><i></i><b>객단가 ${won(data.averageTicket)}</b></div></section>
      <section class="sales-metrics"><div><span>고객</span><b>${data.customerCount||0}명</b></div><div><span>완료 시술</span><b>${data.appointmentCount||0}건</b></div></section>
      <section class="sales-section"><h3>결제수단</h3><div class="sales-list">${methods.length?methods.map(x=>`<div><span>${labels[x.method]||x.method}</span><b>${won(x.amount)}</b><small>${x.count}건</small></div>`).join(''):'<p class="sales-empty">결제 내역이 없어요.</p>'}</div></section>
      <section class="sales-section"><h3>담당자</h3><div class="sales-list staff">${staff.length?staff.map(x=>`<div><span>${x.staffName}</span><b>${won(x.amount)}</b><small>${x.count}건 · 객단가 ${won(x.averageTicket)}</small></div>`).join(''):'<p class="sales-empty">담당자 매출이 없어요.</p>'}</div></section>
      ${range==='today'?'':`<section class="sales-section"><h3>일별 흐름</h3><div class="sales-bars">${daily.map(x=>`<div title="${x.date} ${won(x.amount)}"><i style="height:${Math.max(5,Math.round(Number(x.amount||0)/maxDay*100))}%"></i><span>${String(x.date).slice(5)}</span></div>`).join('')}</div></section>`}`;
  }
  async function load(){
    if(busy)return;busy=true;const content=$('#salesContent');if(content)content.innerHTML='<div class="sales-loading">매출을 불러오는 중…</div>';
    try{const c=await getClient(),sid=await resolveSalon(),{start,end}=bounds();const {data,error}=await c.rpc('ludia_sales_summary',{p_salon_id:sid,p_from:start.toISOString(),p_to:end.toISOString()});if(error)throw error;$('#salesRangeLabel').textContent=range==='today'?'오늘 결제 기준':range==='week'?'이번 주 결제 기준':'이번 달 결제 기준';render(data||{})}
    catch(error){console.warn('[LUDIA sales]',error);content.innerHTML=`<div class="sales-error"><b>매출을 불러오지 못했어요.</b><span>${error?.message?.includes('function')?'sales_reporting.sql 적용 상태를 확인해 주세요.':'클라우드 로그인과 연결 상태를 확인해 주세요.'}</span><button id="salesRetry">다시 시도</button></div>`;$('#salesRetry')?.addEventListener('click',load)}finally{busy=false}
  }
  function open(){ensureSheet();const s=$('#salesSheet');s.classList.add('open');s.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';load()}
  function close(){const s=$('#salesSheet');if(!s)return;s.classList.remove('open');s.setAttribute('aria-hidden','true');document.body.style.overflow=''}
  document.addEventListener('click',e=>{const b=e.target.closest('.native-settings-group button');if(!b||b.querySelector('b')?.textContent.trim()!=='매출')return;e.preventDefault();open()});
})();
