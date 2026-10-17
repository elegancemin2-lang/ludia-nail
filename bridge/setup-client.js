(()=>{'use strict';
  const $=id=>document.getElementById(id),token=location.hash.slice(1);history.replaceState(null,'',location.pathname);
  const labels={row:'예약 한 줄 전체',bookingNo:'예약번호',date:'날짜',time:'시간',dateTime:'날짜·시간 함께',status:'예약상태',phone:'전화번호',customerName:'고객명',serviceName:'시술·상품명',staffName:'담당자',duration:'소요시간'};
  const optional=['customerName','serviceName','staffName','phone','duration'],keys=Object.keys(labels).filter(x=>x!=='row');
  const statuses={confirmed:'확정',requested:'신청',cancelled:'취소',completed:'완료',no_show:'노쇼'};
  let current=null,busy=false,previewOK=false,saved=false,lastPick=0,stopped=false,lastServer=null,lastPreviewCount=0;
  function node(tag,text){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;}
  for(const key of optional){const b=node('button',labels[key]);b.type='button';b.dataset.pick=key;const s=node('span','선택사항');s.id='picked-'+key;b.append(s);$('optionalFields').append(b);}
  for(const key of ['row',...keys]){const label=node('label',labels[key]),input=node('input');input.id='selector-'+key;input.spellcheck=false;input.autocomplete='off';label.append(input);$('selectorInputs').append(label);}
  const notice=(message,error=false)=>{$('notice').textContent=message;$('notice').classList.toggle('error',error);};
  const form=()=>({smartplaceUrl:$('smartplaceUrl').value.trim(),deliveryMode:$('deliveryMode').value,syncUrl:$('syncUrl').value.trim(),syncToken:$('syncToken').value,
    bookingRowSelector:$('selector-row').value.trim(),bookingFields:Object.fromEntries(keys.map(k=>[k,$('selector-'+k).value.trim()])),confirmed:$('confirmed').checked});
  function controls(){document.querySelectorAll('button').forEach(b=>{b.disabled=busy||stopped;});$('save').disabled=busy||stopped||!previewOK||!$('confirmed').checked;$('run').disabled=busy||stopped||!saved;}
  async function api(route,body){const response=await fetch('/api/'+route,{method:body===undefined?'GET':'POST',headers:{'x-ludia-setup-token':token,...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});const result=await response.json();if(!response.ok||!result.ok)throw Error(result.message||(result.error==='unauthorized'?'설정 주소가 만료됐어요. 시작 파일을 다시 실행하세요.':'작업을 완료하지 못했어요.'));return result;}
  async function action(fn){if(busy)return;busy=true;controls();try{await fn();}catch(error){notice(error.message,true);}finally{busy=false;controls();}}
  function badges(selection){for(const key of ['row',...keys]){const selected=key==='row'?$('selector-row').value:$('selector-'+key).value;const badge=$('picked-'+key);if(badge){badge.textContent=selected?'지정됨':optional.includes(key)||key==='dateTime'?'선택사항':'미지정';badge.parentElement.classList.toggle('ready',Boolean(selected));badge.parentElement.classList.toggle('selecting',selection?.field===key);}}}
  function invalidate(){previewOK=false;saved=false;$('confirmed').checked=false;controls();badges();}
  function delivery(){const remote=$('deliveryMode').value==='server';$('serverSettings').hidden=!remote;$('deliveryNote').textContent=remote?'매장 PC가 켜져 있는 동안 서버로 전달합니다. 휴대폰에서는 별도의 매장 조회 권한으로 확인합니다.':'이 PC의 exports 폴더에 저장합니다. LUDIA의 PC 폴더 연결이 필요하며 휴대폰으로 자동 공유하지 않습니다.';}
  function applyState(data,initial=false){current=data;const config=data.config||{};
    if(initial){$('smartplaceUrl').value=config.smartplaceUrl||'';$('deliveryMode').value=config.deliveryMode||'local';$('syncUrl').value=config.syncUrl||'https://ludianail.vercel.app/api/naver-sync';$('selector-row').value=config.bookingRowSelector||'';keys.forEach(k=>$('selector-'+k).value=config.bookingFields?.[k]||'');if(config.hasSyncKey)$('syncToken').placeholder='저장된 PC 연결 키 사용 · 입력하면 교체';delivery();}
    $('browserState').textContent=({closed:'아직 창을 열지 않았어요.',login_required:'네이버 창에서 직접 로그인을 완료하세요.',smartplace:'네이버 창이 열려 있어요. 실제 예약관리 목록으로 이동하세요.'})[data.pageState]||'';
    const p=data.selection;
    if(p&&p.picked!==lastPick){lastPick=p.picked;$('selector-row').value=p.rowSelector||'';keys.forEach(k=>$('selector-'+k).value=p.fields?.[k]||'');if(data.currentUrl)$('smartplaceUrl').value=data.currentUrl;invalidate();if(p.message)notice(p.message);}
    badges(p);controls();
  }
  $('openBrowser').onclick=()=>action(async()=>{lastPick=0;applyState(await api('open',{}));notice('네이버 창에서 로그인 후 예약관리 목록으로 이동하세요.');});
  $('useCurrent').onclick=()=>action(async()=>{const data=await api('state');applyState(data);if(!data.currentUrl)throw Error('네이버 공식 예약관리 화면으로 먼저 이동하세요.');$('smartplaceUrl').value=data.currentUrl;invalidate();notice('현재 화면 주소를 사용합니다. 매장과 조회 기간을 확인하세요.');});
  document.addEventListener('click',e=>{const b=e.target.closest('[data-pick]');if(!b)return;action(async()=>{invalidate();applyState(await api('pick',{field:b.dataset.pick,bookingRowSelector:$('selector-row').value,bookingFields:form().bookingFields}));notice('네이버 창에서 '+labels[b.dataset.pick]+' 항목을 지정하세요.');});});
  $('verify').onclick=()=>action(async()=>{previewOK=false;saved=false;const result=await api('verify',form());lastPreviewCount=result.rowCount;const container=$('preview');container.replaceChildren(node('p',''));container.firstChild.className='preview-count';container.firstChild.textContent=result.parsedCount+'건의 예약을 읽었습니다.';
    for(const r of result.preview){const row=node('div');row.className='preview-row';row.append(node('b',r.date+' '+r.time),node('span',r.staff+' · '+r.service),node('small',r.bookingNo+' · '+(statuses[r.status]||'확인 필요')),node('small',r.customer+' · '+(r.duration?r.duration+'분':'소요시간 미확인')));container.append(row);}
    container.append(node('p',result.note));previewOK=true;notice('미리보기와 실제 예약이 같은지 확인한 뒤 저장하세요.');});
  $('checkServer').onclick=()=>action(async()=>{const result=await api('server',{syncUrl:$('syncUrl').value,syncToken:$('syncToken').value});lastServer=result.result;$('serverResult').replaceChildren(...(lastServer.ok?['서버 설정과 PC 전송 권한을 확인했습니다.']:lastServer.messages).map(s=>node('p',s)));notice(lastServer.ok?'서버 검사 통과 · 실제 예약 수집은 별도로 확인합니다.':'서버 연결 준비가 필요합니다.',!lastServer.ok);});
  $('save').onclick=()=>action(async()=>{const data=await api('save',form());applyState(data);saved=true;$('syncToken').value='';$('savedState').textContent='확인한 설정을 이 PC에 저장했습니다. 예약 연결 실행을 누르세요.';notice('설정을 저장했습니다. 아직 동기화를 시작하지 않았습니다.');});
  $('run').onclick=()=>action(async()=>{await api('start',{});stopped=true;notice('브리지를 실행했습니다. LUDIA에서 정상 수집·저장 결과를 확인하세요. 이 설정 창은 닫아도 됩니다.');});
  document.querySelectorAll('input:not(#confirmed),select').forEach(el=>el.addEventListener('input',()=>{invalidate();if(el.id==='deliveryMode')delivery();}));$('confirmed').onchange=controls;
  $('downloadReport').onclick=()=>{const data={schema:'ludia-naver-setup-diagnostic/v1',bridgeVersion:'0.4.0',checkedAt:new Date().toISOString(),deliveryMode:$('deliveryMode').value,pageState:current?.pageState||'closed',fieldsConfigured:Object.fromEntries(['row',...keys].map(k=>[k,Boolean($('selector-'+k).value)])),previewChecked:previewOK,previewRows:lastPreviewCount,server:lastServer?{ok:lastServer.ok,issues:lastServer.issues}:null,attachmentsSupported:false};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=node('a');a.href=url;a.download='LUDIA_PC_연결진단.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  if(!token){notice('시작 파일에 표시된 이 PC 전용 설정 주소로 다시 열어 주세요.',true);stopped=true;controls();return;}
  action(async()=>{applyState(await api('state'),true);notice('1번부터 순서대로 진행하세요. 실제 예약 화면을 확인하기 전에는 수집하지 않습니다.');});
  setInterval(async()=>{if(busy||stopped||document.hidden)return;try{applyState(await api('state'));}catch{}},2500);
})();
