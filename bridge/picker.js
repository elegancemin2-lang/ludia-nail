// Installed only after an explicit action, on the official SmartPlace page (never the login page).
// This selects DOM elements. It never reads inputs, cookies, browser storage, or credentials.
export function installPicker(initial = {}) {
  const marker = '__ludiaNaverPicker';
  if (window[marker]) { window[marker].selection(initial); window[marker].begin(initial.field || 'row'); return; }
  const labels = {row:'예약 한 줄 전체', bookingNo:'예약번호', date:'날짜', time:'시간', dateTime:'날짜와 시간', status:'예약상태',
    phone:'전화번호', customerName:'고객명', serviceName:'시술·상품명', staffName:'담당자', duration:'소요시간'};
  let rowSelector = initial.rowSelector || '', fields = {...(initial.fields || {})}, field = initial.field || 'row', candidate = null, manual = false, message = '', picked = 0;
  const bar = document.createElement('div'); bar.id = 'ludia-dom-picker';
  bar.style.cssText = 'position:fixed;z-index:2147483647;top:8px;left:8px;right:8px;padding:14px 16px;border:1px solid #b9cfff;border-radius:12px;background:#fff;color:#1c1c1e;box-shadow:0 3px 20px #0002;font:15px/1.5 system-ui;display:flex;align-items:center;gap:12px;flex-wrap:wrap';
  const copy = document.createElement('span'); copy.style.cssText='flex:1;min-width:220px';
  const parent = document.createElement('button'); parent.textContent='상위 영역 ↑';
  const accept = document.createElement('button'); accept.textContent='선택 Enter';
  const pause = document.createElement('button'); pause.textContent='선택 일시중지';
  for (const button of [parent, accept, pause]) button.style.cssText='min-height:40px;padding:8px 12px;border:1px solid #c7c7cc;border-radius:8px;background:#f2f2f7;color:#0067dc;font:inherit;cursor:pointer';
  const outline = document.createElement('div');
  outline.style.cssText='position:fixed;z-index:2147483646;border:3px solid #007aff;background:#007aff12;pointer-events:none;display:none;box-sizing:border-box';
  document.body.append(bar, outline); bar.append(copy, parent, accept, pause);
  const esc = value => CSS.escape(value);
  function segment(el) {
    for (const name of ['data-testid','data-test','role']) {
      const value=el.getAttribute(name);
      if(value && /^[A-Za-z][A-Za-z0-9_-]{0,60}$/.test(value) && !/\d{5}|[a-f0-9]{12}/i.test(value)) return el.localName+'['+name+'="'+value+'"]';
    }
    const classes=[...el.classList].filter(c=>/^[A-Za-z_][A-Za-z0-9_-]{0,60}$/.test(c) && !/^(?:css-|sc-|active$|selected$|hover$|focus$)|\d{5}|[a-f0-9]{12}/i.test(c)).slice(0,3);
    return el.localName+classes.map(c=>'.'+esc(c)).join('');
  }
  function rowPath(el) {
    let selector=segment(el);
    if(el.parentElement&&el.parentElement!==document.body) selector=segment(el.parentElement)+' > '+selector;
    return selector;
  }
  function relativePath(el, row) {
    if (el === row) return ':scope';
    const path=[]; let current=el;
    for(let level=0;current && current!==row && level<16;level++,current=current.parentElement) {
      let part=segment(current); let siblings=current.parentElement ? [...current.parentElement.children].filter(x=>x.matches(part)) : [];
      if(siblings.length>1) part+=':nth-of-type('+([...current.parentElement.children].filter(x=>x.localName===current.localName).indexOf(current)+1)+')';
      path.unshift(part);
      const selector=path.join(' > '), matches=[...row.querySelectorAll(selector)];
      if(matches.length===1 && matches[0]===el) return selector;
    }
    throw Error('선택한 항목이 예약 한 줄 안에 있어야 합니다.');
  }
  function update() {
    copy.textContent=field ? 'LUDIA · '+labels[field]+' 선택: 요소를 가리키고 클릭하세요. 한 줄 전체는 ↑로 영역을 넓힌 뒤 Enter.' : 'LUDIA · '+(message||'설정 창에서 다음 항목을 선택하세요.');
    if(!candidate||!field){outline.style.display='none';return;}
    const r=candidate.getBoundingClientRect();Object.assign(outline.style,{display:'block',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
  }
  function choose() {
    if(!field||!candidate)return;
    try{
      if(['BODY','HTML','INPUT','TEXTAREA'].includes(candidate.tagName))throw Error('예약의 표시 요소를 선택하세요.');
      if(field==='row') {rowSelector=rowPath(candidate); fields={}; message='예약 한 줄을 지정했습니다. 설정 창에서 예약번호부터 지정하세요.';}
      else {const row=candidate.closest(rowSelector);if(!row)throw Error('지정한 예약 한 줄 안의 항목을 선택하세요.');fields[field]=relativePath(candidate,row);if(field==='dateTime'){delete fields.date;delete fields.time;}if(field==='date'||field==='time')delete fields.dateTime;message=labels[field]+' 선택 완료 · 설정 창에서 다음 항목을 선택하세요.';}
      picked++;field=null;candidate=null;update();
    }catch(error){message=error.message;copy.textContent='LUDIA · '+message;}
  }
  const move=e=>{if(!field||bar.contains(e.target)||e.target===outline)return;if(!manual||!candidate?.contains(e.target)){candidate=e.target;manual=false;}update();};
  const up=()=>{if(candidate?.parentElement && candidate.parentElement!==document.body){candidate=candidate.parentElement;manual=true;update();}};
  const click=e=>{if(!field||bar.contains(e.target))return;e.preventDefault();e.stopImmediatePropagation();choose();};
  const key=e=>{if(!field||bar.contains(e.target))return;if(e.key==='ArrowUp'){e.preventDefault();e.stopImmediatePropagation();up();}else if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();choose();}else if(e.key==='Escape'){field=null;candidate=null;message='선택을 중지했습니다.';update();}};
  parent.onclick=up;accept.onclick=choose;pause.onclick=()=>{field=null;candidate=null;message='일시중지 · 네이버 화면을 이동할 수 있어요.';update();};
  document.addEventListener('mousemove',move,true);document.addEventListener('click',click,true);document.addEventListener('keydown',key,true);
  window[marker]={selection(value){rowSelector=value.rowSelector||'';fields={...(value.fields||{})};},begin(next){if(next!=='row'&&!rowSelector)throw Error('먼저 예약 한 줄을 선택하세요.');field=next;candidate=null;manual=false;update();},
    snapshot(){return{rowSelector,fields:{...fields},field,message,picked};},
    dispose(){document.removeEventListener('mousemove',move,true);document.removeEventListener('click',click,true);document.removeEventListener('keydown',key,true);bar.remove();outline.remove();delete window[marker];}};
  update();
}

export function pickerSnapshot() { return window.__ludiaNaverPicker?.snapshot() || null; }
export function removePicker() { window.__ludiaNaverPicker?.dispose(); }
