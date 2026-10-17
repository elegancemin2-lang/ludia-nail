(()=>{'use strict';
  const DOWNLOAD='/downloads/ludia-naver-bridge-0.4.0.zip';
  let previousFocus=null,sequence=0;
  const element=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  function mount(){const actions=document.querySelector('#naverBridgePanel .nb-local-actions');if(!actions||actions.querySelector('[data-nb-setup]'))return;const button=element('button','PC 연결 시작');button.type='button';button.dataset.nbSetup='';button.className='nb-setup-start';actions.prepend(button);}
  function close(){sequence++;document.querySelector('#naverSetupSheet')?.remove();document.body.classList.remove('nb-sheet-open');previousFocus?.focus?.();}
  async function check(root){
    const seq=++sequence,box=root.querySelector('[data-setup-health]');box.replaceChildren(element('p','서버 준비 상태를 확인하고 있어요.'));
    try{
      const response=await fetch('/api/naver-sync',{headers:{accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(15000)}),data=await response.json();
      if(seq!==sequence||!root.isConnected)return;
      if(!response.ok||data.service!=='ludia-naver-sync')throw Error('health_unavailable');
      const list=element('dl');list.className='nb-setup-checks';
      for(const [name,status] of [['서버 저장 연결',data.supabaseConfigured?'준비됨':'설정 대기'],['실제 매장 확인',data.salonConfigured?'확인됨':data.supabaseConfigured?'확인 필요':'서버 준비 후 확인'],['PC 전송 권한',data.tokenConfigured?'설정됨':'설정 대기']]){list.append(element('dt',name),element('dd',status));}
      const note=element('p',data.ready?'서버 준비 상태를 확인했습니다. PC에서 매장 전송 키와 실제 예약 화면을 확인해야 수집을 시작합니다.':'휴대폰 자동 공유는 아직 준비되지 않았어요. PC 저장은 별도로 설정할 수 있습니다.');
      box.replaceChildren(list,note);
    }catch{if(seq===sequence&&root.isConnected)box.replaceChildren(element('p','서버 상태를 확인하지 못했어요. 연결됨으로 표시하지 않습니다. 잠시 후 다시 확인하세요.'));}
  }
  function open(){
    if(document.querySelector('#naverSetupSheet'))return;
    previousFocus=document.activeElement;
    const root=element('div');root.id='naverSetupSheet';root.className='nb-sheet-root';
    root.innerHTML='<button class="nb-sheet-backdrop" type="button" aria-label="PC 연결 안내 닫기" data-setup-close></button><section class="nb-sheet nb-setup-sheet" role="dialog" aria-modal="true" aria-labelledby="nbSetupTitle" tabindex="-1"><div class="nb-grabber"></div><header><div><span>네이버 SmartPlace</span><h3 id="nbSetupTitle">매장 PC 연결</h3></div><button class="nb-sheet-close" type="button" data-setup-close>완료</button></header><p>매장 PC에서 네이버에 로그인하고 실제 예약 항목을 지정합니다. PC가 켜져 있는 동안 약 60초마다 확인합니다.</p><ol class="nb-setup-steps"><li><b>Windows PC에서 프로그램 받기</b><span>압축을 풀고 START_NAVER_BRIDGE.cmd를 실행하세요. 처음 실행하면 PC 전용 설정 화면이 열립니다. Node.js 20 이상이 필요합니다.</span></li><li><b>네이버 로그인 · 예약 항목 확인</b><span>네이버 창에서 직접 로그인한 뒤 예약관리 목록으로 이동합니다. 예약 한 줄과 예약번호·날짜·시간·상태를 클릭으로 지정하고 미리보기를 확인하세요.</span></li><li><b>저장 위치 선택 · 실행</b><span>PC 저장은 exports 폴더를 아래 PC 폴더 연결로 지정합니다. 휴대폰 공유는 서버 준비 검사와 매장 전송 키가 필요하고, 휴대폰 조회 권한은 별도입니다.</span></li></ol><a class="nb-setup-download" download href="'+DOWNLOAD+'">Windows PC 연결 프로그램 받기</a><p class="nb-setup-small">이 PC 저장은 다른 기기로 자동 공유되지 않습니다. 서버 전송도 실제 예약 저장에 성공하기 전에는 연결됨으로 표시하지 않습니다.</p><div class="nb-setup-health" data-setup-health role="status"></div><button class="nb-setup-refresh" type="button" data-setup-refresh>서버 준비 상태 다시 확인</button><p class="nb-setup-small">현재 화면의 조회 기간·페이지에 표시된 예약만 수집합니다. 초기 방향은 네이버 → LUDIA이며, LUDIA 예약이 네이버 빈 시간을 자동으로 막지는 않습니다. 첨부사진 자동 수집은 실계정 확인이 남아 있습니다.</p></section>';
    document.body.append(root);document.body.classList.add('nb-sheet-open');requestAnimationFrame(()=>{root.classList.add('open');root.querySelector('[role="dialog"]').focus();});void check(root);
  }
  document.addEventListener('click',e=>{if(e.target.closest('[data-nb-setup]'))open();if(e.target.closest('[data-setup-close]'))close();if(e.target.closest('[data-setup-refresh]')){const root=document.querySelector('#naverSetupSheet');if(root)void check(root);}});
  document.addEventListener('keydown',e=>{const root=document.querySelector('#naverSetupSheet');if(!root)return;if(e.key==='Escape'){e.preventDefault();close();return;}if(e.key==='Tab'){const controls=[...root.querySelectorAll('section button,section a[href]')];const first=controls[0],last=controls.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===root.querySelector('section'))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
  mount();new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});
})();
