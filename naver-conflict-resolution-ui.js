/* LUDIA NAIL · progressive enhancement for the Naver conflict sheet */
(()=>{
  let busy=false;
  const enhance=async()=>{
    const list=document.querySelector('.nb-conflict-list');if(!list||list.dataset.actionsReady)return;
    try{
      const r=await fetch('/api/naver-status',{headers:{accept:'application/json'},cache:'no-store'}),data=await r.json();
      const conflicts=Array.isArray(data?.conflicts)?data.conflicts:[];
      [...list.querySelectorAll('.nb-conflict-row')].forEach((row,index)=>{
        const conflict=conflicts[index];if(!conflict?.id)return;
        row.dataset.conflictId=String(conflict.id);
        const actions=document.createElement('div');actions.className='nb-conflict-actions';
        actions.innerHTML='<button type="button" data-nb-resolution="keep_ludia">LUDIA 일정 유지</button><button type="button" class="primary" data-nb-resolution="accept_naver">네이버 시간 수용</button>';
        row.appendChild(actions);
      });
      const help=document.querySelector('.nb-conflict-help');if(help)help.textContent='네이버 시간 수용은 서버에서 현재 일정을 다시 검사한 뒤에만 적용됩니다. 여전히 겹치면 변경하지 않습니다.';
      list.dataset.actionsReady='1';
    }catch(error){console.warn('[LUDIA Naver conflict UI]',error);}
  };
  const resolve=async button=>{
    if(busy)return;const row=button.closest('[data-conflict-id]'),id=Number(row?.dataset.conflictId),action=button.dataset.nbResolution;if(!id||!action)return;
    busy=true;row.querySelectorAll('button').forEach(x=>x.disabled=true);row.classList.add('is-busy');
    try{
      if(!window.LudiaNaverConflicts)throw new Error('resolver unavailable');
      await window.LudiaNaverConflicts.resolve(id,action);
      row.remove();
      const left=document.querySelectorAll('.nb-conflict-row').length;
      if(!left){document.querySelector('.nb-sheet-close')?.click();setTimeout(()=>document.querySelector('[data-nav="more"]')?.click(),40);}
    }catch(error){
      console.warn('[LUDIA Naver conflict resolution]',error);row.classList.remove('is-busy');row.querySelectorAll('button').forEach(x=>x.disabled=false);
      const help=document.querySelector('.nb-conflict-help');if(help)help.textContent=String(error?.message||'').toLowerCase().includes('manager')?'원장 또는 관리자 계정으로 로그인해야 해결할 수 있어요.':'현재 일정과 다시 충돌하거나 처리할 수 없는 예약입니다. 캘린더를 확인해 주세요.';
    }finally{busy=false;}
  };
  document.addEventListener('click',event=>{
    if(event.target.closest('.nb-conflict-btn'))setTimeout(enhance,30);
    const button=event.target.closest('[data-nb-resolution]');if(button){event.preventDefault();resolve(button);}
  });
})();
