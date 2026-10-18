// Inspect actual rendered headings; unknown or ambiguous layouts use the owner picker.
export function detectRenderedTable() {
  const visible=el=>Boolean(el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
  const canon=v=>String(v||'').replace(/\s+/g,'').trim();
  const labels={bookingNo:['예약번호'],date:['이용일','예약일','예약날짜'],time:['이용시간','예약시간','시작시간'],dateTime:['이용일시','예약일시'],status:['예약상태','상태'],customerName:['예약자명','고객명'],phone:['전화번호','예약자연락처'],serviceName:['예약상품','상품명','시술명'],staffName:['담당자','담당직원'],duration:['소요시간(분)','시술시간(분)']};
  const cssPath=el=>{const parts=[];for(let n=el;n&&n!==document.documentElement;n=n.parentElement){const tag=n.tagName.toLowerCase(),siblings=[...n.parentElement.children].filter(s=>s.tagName===n.tagName);parts.unshift(tag+':nth-of-type('+(siblings.indexOf(n)+1)+')');}return 'html > '+parts.join(' > ');};
  const candidates=[];
  for(const table of [...document.querySelectorAll('table')].filter(visible)){
    const heads=[...table.querySelectorAll(':scope > thead > tr')].filter(visible);
    if(heads.length!==1)continue;
    const cells=[...heads[0].children];if(!cells.length||cells.some(c=>c.tagName!=='TH'||c.colSpan!==1||c.rowSpan!==1))continue;
    const values=cells.map(c=>canon(c.textContent)),fields={};let ambiguous=false;
    for(const [key,names] of Object.entries(labels)){const hits=values.flatMap((v,i)=>names.includes(v)?[i]:[]);if(hits.length>1)ambiguous=true;else if(hits.length===1)fields[key]=':scope > td:nth-child('+(hits[0]+1)+')';}
    if(ambiguous||!fields.bookingNo||!fields.status||!(fields.dateTime||(fields.date&&fields.time)))continue;
    const rows=[...table.querySelectorAll(':scope > tbody > tr')].filter(visible);
    if(!rows.length||rows.length>1000||rows.some(r=>r.children.length!==cells.length||[...r.children].some(c=>c.tagName!=='TD'||c.colSpan!==1||c.rowSpan!==1)))continue;
    candidates.push({bookingRowSelector:cssPath(table)+' > tbody > tr',bookingFields:fields});
  }
  return candidates.length===1?candidates[0]:null;
}
