/* LUDIA NAIL · progressive enhancement for the Naver conflict sheet */
(()=>{
  let busy=false;
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
      const help=document.querySelector('.nb-conflict-help');if(help)help.textContent=String(error?.message||'').toLowerCase().includes('manager')?'매장 전용 연동 관리자 연결에서 처리해 주세요.':'현재 일정과 다시 충돌하거나 처리할 수 없는 예약입니다. 캘린더를 확인해 주세요.';
    }finally{busy=false;}
  };
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-nb-resolution]');if(button){event.preventDefault();resolve(button);}
  });
})();
