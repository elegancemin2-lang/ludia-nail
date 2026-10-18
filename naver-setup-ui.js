(()=>{'use strict';
  const DOWNLOAD='/downloads/ludia-naver-bridge-0.5.0.zip';
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
    root.innerHTML='<button class="nb-sheet-backdrop" type="button" aria-label="PC 연결 안내 닫기" data-setup-close></button><section class="nb-sheet nb-setup-sheet" role="dialog" aria-modal="true" aria-labelledby="nbSetupTitle" tabindex="-1"><div class="nb-grabber"></div><header><div><span>네이버 SmartPlace</span><h3 id="nbSetupTitle">매장 PC 연결</h3></div><button class="nb-sheet-close" type="button" data-setup-close>완료</button></header><p>처음 한 번 예약 내용을 확인하면 저장한 설정으로 시작합니다. 매장 PC가 켜져 있는 동안 약 60초마다 확인합니다.</p><ol class="nb-setup-steps"><li><b>Windows PC에서 프로그램 받기</b><span>압축을 풀고 START_NAVER_BRIDGE.cmd를 실행하세요. 필요한 실행 환경을 자동 설치하고 네이버 로그인 창을 엽니다. 별도 Node.js 설치나 관리자 권한은 필요 없어요.</span></li><li><b>네이버 로그인 · 예약 내용 확인</b><span>네이버 창에서 직접 로그인한 뒤 전체 상태·취소 포함 예약 목록을 여세요. 표의 제목으로 항목을 자동 확인합니다. 자동 확인이 안 되면 최초 한 번 직접 선택합니다.</span></li><li><b>확인하고 자동연동 시작</b><span>미리보기를 확인하고 연결하면 프로그램이 여는 LUDIA 창에 바로 반영합니다. 폴더 선택은 필요 없어요. 기존 일반 브라우저·휴대폰의 데이터와는 별도입니다.</span></li></ol><a class="nb-setup-download" download href="'+DOWNLOAD+'">Windows PC 연결 프로그램 받기</a><p class="nb-setup-small">이 PC 저장은 다른 기기로 자동 공유되지 않습니다. 서버 전송도 실제 예약 저장에 성공하기 전에는 연결됨으로 표시하지 않습니다.</p><div class="nb-setup-health" data-setup-health role="status"></div><button class="nb-setup-refresh" type="button" data-setup-refresh>서버 준비 상태 다시 확인</button><p class="nb-setup-small">확인한 목록·조회 기간에 표시된 신규·변경·명시적 취소를 반영합니다. 취소가 별도 목록이면 최초 설정에서 추가로 확인하세요. 네이버 → LUDIA 단방향이며, 전체 날짜 자동 순회와 첨부사진 수집은 지원하지 않습니다. 실계정 검증이 남아 있습니다.</p></section>';
    document.body.append(root);document.body.classList.add('nb-sheet-open');requestAnimationFrame(()=>{root.classList.add('open');root.querySelector('[role="dialog"]').focus();});void check(root);
  }
  document.addEventListener('click',e=>{if(e.target.closest('[data-nb-setup]'))open();if(e.target.closest('[data-setup-close]'))close();if(e.target.closest('[data-setup-refresh]')){const root=document.querySelector('#naverSetupSheet');if(root)void check(root);}});
  document.addEventListener('keydown',e=>{const root=document.querySelector('#naverSetupSheet');if(!root)return;if(e.key==='Escape'){e.preventDefault();close();return;}if(e.key==='Tab'){const controls=[...root.querySelectorAll('section button,section a[href]')];const first=controls[0],last=controls.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===root.querySelector('section'))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
  mount();new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});
})();
