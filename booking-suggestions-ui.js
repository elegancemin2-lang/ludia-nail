/* LUDIA NAIL · nearest booking suggestions
 * Progressive enhancement over booking-availability-ui.js.
 * Never invents availability: suggestions are cloned only from server-verified available slots.
 */
(()=>{
  const $=s=>document.querySelector(s);
  let observer=null;
  const style=document.createElement('style');
  style.textContent=`.qb-suggestions{margin:0 0 11px}.qb-suggestions-label{display:flex;align-items:center;justify-content:space-between;margin:0 1px 7px;font:600 11px/1.2 -apple-system,BlinkMacSystemFont,"SF Pro Text","Pretendard",sans-serif;color:#8e8e93}.qb-suggestions-list{display:flex;gap:7px}.qb-suggestion{flex:1;min-width:0;height:42px;border:0;border-radius:12px;background:#f2f2f7;color:#1c1c1e;font:700 14px/1 -apple-system,BlinkMacSystemFont,"SF Pro Text","Pretendard",sans-serif}.qb-suggestion:first-child{background:rgba(0,122,255,.1);color:#007aff}.qb-suggestion:active{transform:scale(.97)}.qb-suggestion small{display:block;margin-top:4px;font-size:9px;font-weight:600;color:#8e8e93}.qb-suggestion:first-child small{color:#007aff}.qb-suggestions-empty{font-size:12px;color:#8e8e93;padding:4px 1px 8px}`;
  document.head.appendChild(style);

  function minutes(time){const [h,m]=(time||'').split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:1e9}
  function render(){
    const strip=$('#qbSlotStrip'),host=$('#qbAvailability');if(!strip||!host)return;
    let box=$('#qbSuggestions');
    if(!box){box=document.createElement('div');box.id='qbSuggestions';box.className='qb-suggestions';strip.insertAdjacentElement('beforebegin',box)}
    const available=[...strip.querySelectorAll('.qb-slot.available:not(:disabled)')]
      .filter(b=>/^\d{2}:\d{2}$/.test(b.dataset.time||b.textContent.trim()))
      .sort((a,b)=>minutes(a.dataset.time||a.textContent)-minutes(b.dataset.time||b.textContent));
    const selected=$('#qbTime')?.value||'';
    const selectedMin=minutes(selected);
    const future=available.filter(b=>minutes(b.dataset.time||b.textContent)>=selectedMin);
    const picks=(future.length?future:available).slice(0,3);
    if(!picks.length){box.innerHTML='<div class="qb-suggestions-label"><span>가까운 추천 시간</span></div><div class="qb-suggestions-empty">현재 조건에서 바로 예약 가능한 시간이 없어요.</div>';return}
    box.innerHTML='<div class="qb-suggestions-label"><span>가까운 추천 시간</span><span>서버 확인 완료</span></div><div class="qb-suggestions-list"></div>';
    const list=box.querySelector('.qb-suggestions-list');
    picks.forEach((source,i)=>{const time=source.dataset.time||source.textContent.trim(),button=document.createElement('button');button.type='button';button.className='qb-suggestion';button.innerHTML=`${time}<small>${i===0?'가장 빠름':'예약 가능'}</small>`;button.addEventListener('click',()=>source.click());list.appendChild(button)});
  }
  function bind(){
    const strip=$('#qbSlotStrip');if(!strip){setTimeout(bind,250);return}
    observer?.disconnect();observer=new MutationObserver(()=>requestAnimationFrame(render));observer.observe(strip,{childList:true,subtree:true,attributes:true,attributeFilter:['class','disabled']});
    $('#qbTime')?.addEventListener('change',()=>requestAnimationFrame(render));
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
