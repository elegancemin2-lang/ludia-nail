(()=>{
  const STATUS_URL='/api/naver-status';
  const POLL_MS=60000;
  let timer=null;

  const labels={
    connected:['연결됨','네이버 예약을 자동 동기화하고 있어요.'],
    stale:['PC 브리지 확인','최근 동기화가 10분 넘게 없어요. Windows 브리지를 확인하세요.'],
    reauth_required:['네이버 로그인 필요','저장된 비밀번호 없이 기존 브라우저 세션을 사용합니다. PC에서 네이버에 다시 로그인하세요.'],
    error:['동기화 오류','마지막 동기화에서 오류가 발생했어요. PC 브리지 로그를 확인하세요.'],
    setup_required:['설정 필요','로컬 Windows 브리지와 Supabase 연결 설정이 필요해요.']
  };
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const relative=iso=>{
    if(!iso)return '동기화 기록 없음';
    const ms=Date.now()-new Date(iso).getTime();
    if(!Number.isFinite(ms))return '동기화 시각 확인 필요';
    const m=Math.max(0,Math.floor(ms/60000));
    if(m<1)return '방금 동기화';
    if(m<60)return `${m}분 전 동기화`;
    const h=Math.floor(m/60); return h<24?`${h}시간 전 동기화`:`${Math.floor(h/24)}일 전 동기화`;
  };
  function ensurePanel(){
    const more=document.querySelector('#moreScreen');
    if(!more)return null;
    let panel=document.querySelector('#naverBridgePanel');
    if(panel)return panel;
    const systemTitle=[...more.querySelectorAll('.native-group-title')].find(x=>x.textContent.trim()==='시스템');
    if(!systemTitle)return null;
    panel=document.createElement('section');
    panel.id='naverBridgePanel'; panel.className='naver-bridge-panel';
    panel.setAttribute('aria-live','polite');
    systemTitle.parentNode.insertBefore(panel,systemTitle);
    return panel;
  }
  function render(data){
    const panel=ensurePanel(); if(!panel)return;
    const state=data?.state||'setup_required', copy=labels[state]||labels.setup_required, today=data?.today||{};
    const attention=state!=='connected';
    panel.innerHTML=`<div class="nb-head"><div><span>예약 연동</span><h3>네이버 SmartPlace</h3></div><span class="nb-state ${esc(state)}"><i></i>${esc(copy[0])}</span></div>
      <p class="nb-copy">${esc(copy[1])}</p>
      <div class="nb-sync"><span>${esc(relative(data?.lastSyncAt))}</span>${data?.freshness==='live'?'<em>LIVE</em>':''}</div>
      <div class="nb-stats"><div><b>${Number(today.confirmed||0)}</b><span>확정</span></div><div><b>${Number(today.requested||0)}</b><span>신청</span></div><div><b>${Number(today.cancelled||0)}</b><span>취소</span></div></div>
      ${attention&&data?.lastError?`<div class="nb-error">${esc(data.lastError)}</div>`:''}
      <div class="nb-privacy">비밀번호 저장 안 함 · CAPTCHA/2단계 인증 우회 안 함 · 로컬 브라우저 세션 사용</div>`;
  }
  async function refresh(){
    try{
      const r=await fetch(STATUS_URL,{headers:{accept:'application/json'},cache:'no-store'});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      render(await r.json());
    }catch(_){render({state:'error',freshness:'attention',today:{},lastError:'연동 상태를 불러오지 못했어요.'});}
  }
  function start(){
    ensurePanel(); refresh();
    clearInterval(timer); timer=setInterval(()=>{if(!document.hidden)refresh();},POLL_MS);
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  document.addEventListener('click',e=>{if(e.target.closest('[data-nav="more"]'))setTimeout(refresh,60);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();