const $=(s)=>document.querySelector(s);const $$=(s)=>[...document.querySelectorAll(s)];
const htmlText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
window.LudiaEscapeHTML=htmlText;
const img=(n)=>`assets/nail_${n}.jpg`;
const DNA=[
 {name:'청순 시럽',desc:'맑은 핑크·누드·얇은 포인트',score:88},
 {name:'자석 시크',desc:'은은한 캣아이·실버 포인트',score:84},
 {name:'성수 무드',desc:'절제된 뉴트럴·미니멀',score:81},
 {name:'강남 화려',desc:'반짝임·스톤·정돈된 포인트',score:76},
 {name:'웨딩/여리',desc:'화이트·오팔·맑은 광',score:79},
 {name:'오마카세',desc:'손가락별 변주·시그니처',score:73}
];
const conditions=['더 심플','파츠 2개 이하','자석 강하게','숏네일','오로라','실버 포인트','누드톤','실물시술 쉽게'];
const editOptions=['원본으로','더 연하게','더 진하게','더 심플','파츠 줄이기','포인트 추가','자석감 강하게','오로라감 추가','성수 무드','강남 무드','청순하게','화려하게','실물시술 쉽게','가격 낮춰서','이달의 아트용','오마카세용'];
const inventory=[
 {name:'밀키 핑크 시럽젤',state:'보유',qty:'충분'}, {name:'실버 캣아이 젤',state:'보유',qty:'충분'},
 {name:'미니 실버볼',state:'부족',qty:'약 18ea'}, {name:'오팔 리본 파츠',state:'품절',qty:'대체 추천'},
 {name:'오로라 필름',state:'보유',qty:'충분'}, {name:'진주 2mm',state:'보유',qty:'보통'}
];
const baseDesigns=[
 {id:1,name:'Soft Blush Magnet',desc:'밀키 핑크 시럽에 얇은 자석광을 넣은 데일리 디자인.',img:img(1),diff:'보통',time:70,price:69000,fit:96,stock:'보유재료 100%',tags:['자석','시럽','베스트'],status:'베스트',materials:['밀키 핑크 시럽젤','실버 캣아이 젤','미니 실버볼'],tech:'시럽 2코트 → 캣아이 얇게 → 포인트 2ea → 탑'},
 {id:2,name:'Micro Silver French',desc:'누디 베이스와 초슬림 실버 프렌치로 깔끔한 인상.',img:img(2),diff:'쉬움',time:60,price:59000,fit:98,stock:'보유재료 100%',tags:['심플','오피스','실버'],status:'실시술완료',materials:['누드 베이스','실버 라인젤'],tech:'베이스 → 누드 2코트 → 0.5mm 프렌치 → 탑'},
 {id:3,name:'Ludia Ribbon Pearl',desc:'리본은 엄지·약지만, 나머지는 투명감 있게 눌러준 코켓.',img:img(3),diff:'보통',time:85,price:79000,fit:89,stock:'리본 대체 필요',tags:['리본','오마카세','즐겨찾기'],status:'즐겨찾기',materials:['밀키 젤','미니 진주','오팔 리본'],tech:'시럽 → 포인트 손가락 리본/진주 → 탑'},
 {id:4,name:'Nuance Gray Drop',desc:'펄 그레이와 투명 드롭을 섞은 성수 느낌의 절제된 포인트.',img:img(4),diff:'보통',time:75,price:72000,fit:94,stock:'보유재료 100%',tags:['성수','드롭','뉴트럴'],status:'후보',materials:['그레이 시럽','클리어 젤','실버볼'],tech:'그레이 베이스 → 투명 드롭 볼륨 → 실버 1ea → 탑'},
 {id:5,name:'Mini Dot Jelly',desc:'시럽 핑크에 잔도트와 글리터를 넣어 귀엽지만 담백하게.',img:img(5),diff:'쉬움',time:65,price:65000,fit:97,stock:'보유재료 100%',tags:['시럽','도트','데일리'],status:'이달의아트',materials:['핑크 시럽','미니 도트','잔글리터'],tech:'시럽 2코트 → 도트 배치 → 글리터 얇게 → 탑'},
 {id:6,name:'Aurora Glass',desc:'클리어 핑크와 오로라 필름, 초소형 스톤으로 유리알 느낌.',img:img(2),diff:'보통',time:80,price:79000,fit:91,stock:'보유재료 88%',tags:['오로라','웨딩','글라스'],status:'후보',materials:['클리어 핑크','오로라 필름','미니 스톤'],tech:'클리어 컬러 → 필름 조각 → 볼륨젤 → 미니 스톤 → 탑'}
];
let state={view:'opsHome',dna:'성수 무드',conditions:new Set(['더 심플','파츠 2개 이하','실물시술 쉽게']),designs:[...baseDesigns],library:baseDesigns.slice(0,5),collection:new Set(),monthlyMenuMonth:'',active:null,fingers:new Set(['전체']),filter:'전체',start:Date.now(),draft:{concept:'',homePrompt:'',maxTime:'90',targetPrice:'69000',stockFirst:true,refDataUrl:null},outputMode:'feed'};
const DB_NAME='ludia-art-studio';const DB_VERSION=1;const DB_STORE='app';const BACKUP_MAGIC='LUDIA_ART_STUDIO_BACKUP';let storageMode='IndexedDB';let saveTimer=null;let lastSavedAt=null;
function openDB(){return new Promise((resolve,reject)=>{if(!('indexedDB'in window))return reject(new Error('IndexedDB unavailable'));const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(DB_STORE))db.createObjectStore(DB_STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function idbGet(key){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readonly');const req=tx.objectStore(DB_STORE).get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function idbSet(key,value){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
function localDateKey(d=new Date()){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function snapshot(){return{magic:BACKUP_MAGIC,schema:4,savedAt:new Date().toISOString(),data:{salonLocal:salonCloudMode==='demo'?{date:localDateKey(),appointments:salonAppointments,customers:salonCustomers}:null,dna:state.dna,conditions:[...state.conditions],designs:state.designs,library:state.library,collection:[...state.collection],monthlyMenuMonth:state.monthlyMenuMonth,draft:state.draft,outputMode:state.outputMode}}}
function applySnapshot(snap){if(!snap?.data)return false;const d=snap.data;state.dna=d.dna||state.dna;state.conditions=new Set(Array.isArray(d.conditions)?d.conditions:[...state.conditions]);state.designs=Array.isArray(d.designs)&&d.designs.length?d.designs:[...baseDesigns];state.library=Array.isArray(d.library)?d.library.filter(x=>!x.cloudArt):baseDesigns.slice(0,5);state.collection=new Set(Array.isArray(d.collection)?d.collection:[]);state.monthlyMenuMonth=d.monthlyMenuMonth||'';state.draft={...state.draft,...(d.draft||{})};state.outputMode=d.outputMode||'feed';lastSavedAt=snap.savedAt?new Date(snap.savedAt):null;if(d.salonLocal&&salonCloudMode==='demo'){const old=d.salonLocal,shift=Math.round((Date.parse(old.date+'T12:00:00Z')-Date.parse(localDateKey()+'T12:00:00Z'))/86400000);if(Number.isFinite(shift)&&Array.isArray(old.appointments))salonAppointments=old.appointments.filter(x=>!x.cloudId).map(x=>({...x,dayOffset:Number(x.dayOffset||0)+shift}));if(Array.isArray(old.customers))salonCustomers=old.customers.filter(x=>!x.cloudId)}return true}
function setSaveStatus(mode,text){const el=$('#saveStatus');if(!el)return;el.classList.remove('saving','saved','error');if(mode)el.classList.add(mode);$('#saveStatusText').textContent=text}
function schedulePersist(){if(salonCloudMode!=='demo'){setSaveStatus('saved','샵 연결 · 저장 버튼 사용');return}setSaveStatus('saving','저장 중…');clearTimeout(saveTimer);saveTimer=setTimeout(()=>persistNow(),650)}
async function persistNow(){if(salonCloudMode!=='demo')return;const snap=snapshot();try{await idbSet('snapshot',snap);storageMode='IndexedDB';localStorage.removeItem('ludiaLibrary');lastSavedAt=new Date(snap.savedAt);setSaveStatus('saved','자동저장됨')}catch(err){storageMode='localStorage';try{const fallback={...snap,data:{...snap.data,draft:{...snap.data.draft,refDataUrl:null}}};localStorage.setItem('ludiaStudioFallback',JSON.stringify(fallback));lastSavedAt=new Date();setSaveStatus('saved','기기저장됨')}catch(e){setSaveStatus('error','저장 오류')}}updateStorageStats()}
async function loadPersisted(){let snap=null;try{snap=await idbGet('snapshot');storageMode='IndexedDB'}catch(err){storageMode='localStorage';try{snap=JSON.parse(localStorage.getItem('ludiaStudioFallback')||'null')}catch(e){}}
 if(!snap){try{const legacy=JSON.parse(localStorage.getItem('ludiaLibrary')||'null');if(Array.isArray(legacy)&&legacy.length){state.library=legacy;await persistNow();return 'migrated'}}catch(e){}return 'new'}
 applySnapshot(snap);return 'restored'}
function formatBytes(n){if(!Number.isFinite(n))return '확인 불가';if(n<1024)return n+' B';if(n<1024*1024)return (n/1024).toFixed(1)+' KB';return (n/1024/1024).toFixed(1)+' MB'}
async function updateStorageStats(){if($('#savedDesignCount'))$('#savedDesignCount').textContent=`${state.library.length}개`;if($('#lastSavedText'))$('#lastSavedText').textContent=lastSavedAt?lastSavedAt.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}):'아직 없음';if($('#storageEngine'))$('#storageEngine').textContent=storageMode;try{if(navigator.storage?.estimate){const e=await navigator.storage.estimate();$('#storageUsage').textContent=`${formatBytes(e.usage||0)} / ${formatBytes(e.quota||0)}`}}catch(e){if($('#storageUsage'))$('#storageUsage').textContent='확인 불가'}try{if(navigator.storage?.persisted&&await navigator.storage.persisted())$('#storageEngine').textContent=storageMode+' · 보호됨'}catch(e){}}
async function requestPersistentStorage(){if(!navigator.storage?.persist){toast('이 브라우저는 저장 보호 요청을 지원하지 않아요');return}const ok=await navigator.storage.persist();toast(ok?'기기 저장 보호가 적용됐어요':'브라우저 정책상 자동 보호되지 않았어요');updateStorageStats()}
function downloadJson(name,obj){const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function exportBackup(){downloadJson(`LUDIA_ART_STUDIO_backup_${new Date().toISOString().slice(0,10)}.json`,snapshot());toast('전체 백업 파일을 만들었어요')}
async function importBackupFile(file){try{const raw=await file.text();const snap=JSON.parse(raw);if(snap.magic!==BACKUP_MAGIC||!snap.data)throw new Error('invalid');applySnapshot(snap);hydrateFromState();renderAll();await persistNow();toast('백업을 복원했어요')}catch(e){toast('LUDIA 백업 파일을 확인해 주세요')}}
function optimizeImageFile(file,max=1600,quality=.84){return new Promise((resolve,reject)=>{if(!file.type.startsWith('image/'))return reject(new Error('not image'));const reader=new FileReader();reader.onerror=()=>reject(reader.error);reader.onload=()=>{const im=new Image();im.onerror=()=>reject(new Error('image load'));im.onload=()=>{let w=im.naturalWidth,h=im.naturalHeight;const scale=Math.min(1,max/Math.max(w,h));w=Math.round(w*scale);h=Math.round(h*scale);const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.drawImage(im,0,0,w,h);resolve(c.toDataURL('image/jpeg',quality))};im.src=reader.result};reader.readAsDataURL(file)})}

function money(v){return (v/10000).toFixed(v%10000?1:0)+'만원'}
function toast(t){const n=$('#toast');n.textContent=t;n.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>n.classList.remove('show'),1700)}

const DEMO_APPOINTMENTS=[
 {id:1,time:'10:00',customer:'김서연',service:'젤 원컬러 + 제거',staff:'루디아',amount:49000,status:'완료',note:'밀키핑크 선호',membership:'금액권 8.1만',last:'8/29 자석 시럽'},
 {id:2,time:'11:30',customer:'박지민',service:'이달의 아트',staff:'루디아',amount:79000,status:'완료',note:'짧은 손톱 · 파츠 적게',membership:'없음',last:'8/26 프렌치'},
 {id:3,time:'13:00',customer:'이유나',service:'젤 아트',staff:'루디아',amount:89000,status:'대기',note:'리본/진주 좋아함',membership:'금액권 12.4만',last:'9/02 오로라'},
 {id:4,time:'14:30',customer:'최하린',service:'오마카세 아트',staff:'지안',amount:99000,status:'대기',note:'사진 참고 후 변형',membership:'횟수권 2회',last:'8/30 글리터'},
 {id:5,time:'16:00',customer:'정민서',service:'젤 원컬러',staff:'루디아',amount:45000,status:'대기',note:'오피스톤',membership:'없음',last:'8/24 누드'},
 {id:6,time:'17:00',customer:'한소희',service:'이달의 아트',staff:'지안',amount:79000,status:'대기',note:'자석 선호',membership:'금액권 5.0만',last:'8/27 자석'},
 {id:7,time:'18:30',customer:'윤아름',service:'젤 아트 + 제거',staff:'루디아',amount:89000,status:'대기',note:'화려한 포인트 2손',membership:'없음',last:'8/20 파츠'},
 {id:8,time:'20:00',customer:'송나경',service:'젤 원컬러',staff:'지안',amount:45000,status:'대기',note:'늦지 않게 60분',membership:'없음',last:'신규'}
]; 
let salonAppointments=DEMO_APPOINTMENTS.map(x=>({...x}));
const DEMO_CUSTOMERS=[
 {name:'이유나',phone:'010-••••-3481',visit:18,last:'9/02',tags:['VIP','리본','여리'],membership:'금액권 12.4만',note:'리본/진주, 맑은 베이스 선호',img:img(3)},
 {name:'김서연',phone:'010-••••-8214',visit:11,last:'9/22',tags:['시럽','자석'],membership:'금액권 8.1만',note:'밀키핑크, 파츠 적게',img:img(1)},
 {name:'박지민',phone:'010-••••-0952',visit:7,last:'9/22',tags:['숏네일','심플'],membership:'없음',note:'짧은 손톱, 실버 프렌치 선호',img:img(2)},
 {name:'최하린',phone:'010-••••-7740',visit:4,last:'8/30',tags:['오마카세','사진참고'],membership:'횟수권 2회',note:'참고사진을 가져오고 변형 요청',img:img(4)},
 {name:'한소희',phone:'010-••••-5317',visit:9,last:'8/27',tags:['자석','베스트'],membership:'금액권 5.0만',note:'자석 강도는 은은하게',img:img(5)}
]; 
let salonCustomers=DEMO_CUSTOMERS.map(x=>({...x}));
let salonStaffNames=['루디아','지안'],salonServices=[],salonCloudMode='demo';
let localSalonSession=null,activeSalonId=null,artLoadSequence=0;
let bookingStaff='전체', bookingDayOffset=0, activeAppointment=null;
let customerPage=1;const CUSTOMER_PAGE_SIZE=8;
let monthlyMenuOffset=0,monthlyEditingId=null,quickSelectedMonthlyArt=null;

function won(v){return Math.round(v/10000*10)/10+'만'}
function renderOpsToday(){
 const today=new Date(),todayAppointments=salonAppointments.filter(x=>(x.dayOffset||0)===0&&x.status!=='취소');
 const dateLabel=$('#todayDateLabel');
 if(dateLabel)dateLabel.textContent=`${today.getMonth()+1}월 ${today.getDate()}일 ${['일','월','화','수','목','금','토'][today.getDay()]}요일`;
 const done=todayAppointments.filter(x=>x.status==='완료').length;
 const total=todayAppointments.reduce((s,x)=>s+x.amount,0);
 const completedSales=todayAppointments.filter(x=>x.status==='완료').reduce((s,x)=>s+x.amount,0);
 const waiting=Math.max(0,todayAppointments.length-done);
 const stats=[
   ['오늘 예약',todayAppointments.length+'건',waiting?'남은 '+waiting+'건':'모두 완료'],
   ['예상 매출',won(total)+'원',done?'완료 '+won(completedSales)+'원':'정산 전'],
   ['완료',done+'건',todayAppointments.length?Math.round(done/todayAppointments.length*100)+'% 진행':'일정 없음'],
   ['데이터',salonCloudMode==='cloud'?'LIVE':'LOCAL',salonCloudMode==='cloud'?'자동 저장':'이 기기 저장']
 ];
 const box=$('#todayStats');if(box)box.replaceChildren(...stats.map(([k,v,s])=>{const a=document.createElement('article');a.className='native-stat';a.innerHTML=`<span>${k}</span><b>${v}</b><small>${s}</small>`;return a}));
 if($('#todayProgress'))$('#todayProgress').textContent=`${done}/${todayAppointments.length} 완료`;
 const timeline=$('#opsTimeline');if(timeline){timeline.innerHTML='';const focus=[...todayAppointments].sort((a,b)=>String(a.time).localeCompare(String(b.time))).filter(a=>a.status!=='완료').slice(0,3);const visible=focus.length?focus:[...todayAppointments].sort((a,b)=>String(b.time).localeCompare(String(a.time))).slice(0,3);visible.forEach(a=>{
   const cls=a.status==='완료'?'done ':a.status==='진행중'?'progress ':a.status==='노쇼'?'cancelled ':'waiting ';
   const row=document.createElement('button');row.className='ops-appointment '+cls;
   row.innerHTML=`<time>${htmlText(a.time)}</time><span class="agenda-dot"></span><div><b>${htmlText(a.customer)}</b><small>${htmlText(a.service)} · ${htmlText(a.staff)}${a.source==='naver'?' · NAVER':''}</small></div><i>›</i>`;
   row.onclick=()=>openOpsDetail(a);timeline.appendChild(row);
 });if(todayAppointments.length>visible.length){const more=document.createElement('button');more.className='home-agenda-more';more.type='button';more.innerHTML=`전체 일정 ${todayAppointments.length}건 보기 <span>›</span>`;more.onclick=()=>{bookingDayOffset=0;showScreen('booking')};timeline.appendChild(more)}}
 const next=todayAppointments.find(x=>x.status!=='완료'&&x.status!=='노쇼')||todayAppointments[0];
 const n=$('#nextCard');if(n)n.innerHTML=next?`<button class="next-open" id="nextOpenBtn"><span class="next-kicker">다음 예약</span><div class="next-main"><div><time>${htmlText(next.time)}</time><h3>${htmlText(next.customer)}</h3><p>${htmlText(next.service)} · ${htmlText(next.staff)}${next.source==='naver'?' · NAVER':''}</p></div><i>›</i></div><div class="next-meta"><span>${htmlText(next.note||'메모 없음')}</span><span>${htmlText(next.membership||'회원권 없음')}</span></div></button>`:'<div class="native-empty-next"><b>오늘 남은 예약이 없어요</b><span>캘린더에서 새 예약을 추가할 수 있어요.</span></div>';
 const nextBtn=$('#nextOpenBtn');if(nextBtn)nextBtn.onclick=()=>openOpsDetail(next);
}
function openOpsDetail(a){
 activeAppointment=a;
 $('#opsDetailName').textContent=`${htmlText(a.time)} · ${htmlText(a.customer)}`;
 $('#opsDetailMeta').textContent=`${htmlText(a.service)} · ${htmlText(a.staff)} · ${won(a.amount)}원`;
 $('#opsCustomerSnapshot').innerHTML=`<div><span>최근 시술</span><b>${htmlText(a.last)}</b></div><div><span>회원권</span><b>${htmlText(a.membership)}</b></div><div class="wide"><span>메모</span><b>${htmlText(a.note)}</b></div>`;
 $('#opsStatusBtn').textContent=a.status==='완료'?'완료됨':a.status==='진행중'?'시술 완료':'시술 시작';
 $('#opsStatusBtn').disabled=a.status==='완료';
 $('#opsDetailSheet').classList.add('open');$('#opsDetailSheet').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
}
function closeOpsDetail(){const sheet=$('#opsDetailSheet');if(!sheet)return;sheet.classList.remove('open');sheet.setAttribute('aria-hidden','true');document.body.style.overflow=''}
function bookingDateFromOffset(offset=0){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+offset);return d}
function bookingDateText(offset=0){const d=bookingDateFromOffset(offset);return `${d.getMonth()+1}월 ${d.getDate()}일 ${['일','월','화','수','목','금','토'][d.getDay()]}요일`}
function bookingWeekStartOffset(anchor=bookingDayOffset){
 const d=bookingDateFromOffset(anchor),mondayIndex=(d.getDay()+6)%7;
 return anchor-mondayIndex
}
function bookingWeekOffsets(anchor=bookingDayOffset){
 const start=bookingWeekStartOffset(anchor);return Array.from({length:7},(_,i)=>start+i)
}
function bookingWeekRangeText(anchor=bookingDayOffset){
 const offsets=bookingWeekOffsets(anchor),a=bookingDateFromOffset(offsets[0]),b=bookingDateFromOffset(offsets[6]);
 const left=`${a.getMonth()+1}월 ${a.getDate()}일`,right=a.getMonth()===b.getMonth()?`${b.getDate()}일`:`${b.getMonth()+1}월 ${b.getDate()}일`;
 return `${left} – ${right}`
}
function renderBookingWeek(){
 const strip=$('#bookingWeekStrip');if(!strip)return;strip.innerHTML='';
 bookingWeekOffsets().forEach(o=>{
   const d=bookingDateFromOffset(o),b=document.createElement('button');b.type='button';b.className=o===bookingDayOffset?'active':'';
   if(o===0)b.classList.add('today');
   b.innerHTML=`<small>${['일','월','화','수','목','금','토'][d.getDay()]}</small><b>${d.getDate()}</b>${o===0?'<i></i>':''}`;
   b.onclick=()=>{bookingDayOffset=o;renderBooking();setTimeout(()=>$('#bookingWeekBoard')?.querySelector('[data-day-offset="'+o+'"]')?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'}),30)};
   strip.appendChild(b)
 })
}
function bookingDataForWeek(){
 const offsets=bookingWeekOffsets(),start=offsets[0],end=offsets[6];
 return salonAppointments.filter(a=>{
   const day=Number(a.dayOffset||0);
   return day>=start&&day<=end&&(bookingStaff==='전체'||a.staff===bookingStaff)
 })
}
function bookingArtImage(a,cardIndex=0){
 const direct=a?.artImage||a?.designImage||a?.previewImageUrl||a?.preview_image_url||null;
 if(direct)return direct;
 const library=Array.isArray(state?.library)?state.library:[];
 const linked=a?.artId?library.find(d=>String(d.id)===String(a.artId)):null;
 if(linked?.img)return linked.img;
 const service=String(a?.service||a?.artName||'').trim().toLowerCase();
 const norm=value=>String(value||'').trim().toLowerCase();
 let match=library.find(d=>d?.img&&service&&(norm(d.name).includes(service)||service.includes(norm(d.name))));
 if(!match&&/이달/.test(service))match=library.find(d=>d?.img&&d.status==='이달의아트');
 if(!match){
   const keywords=['자석','시럽','웨딩','프렌치','오로라','글리터','젤','아트'];
   const key=keywords.find(k=>service.includes(k));
   if(key)match=library.find(d=>d?.img&&(norm(d.name).includes(key)||(Array.isArray(d.tags)&&d.tags.some(t=>norm(t).includes(key)))));
 }
 return match?.img||'assets/nail_5.jpg';
}
function renderBooking(){
 const offsets=bookingWeekOffsets(),startDate=bookingDateFromOffset(offsets[0]),endDate=bookingDateFromOffset(offsets[6]);
 const monthLabel=startDate.getMonth()===endDate.getMonth()?`${startDate.getFullYear()}년 ${startDate.getMonth()+1}월`:`${startDate.getFullYear()}년 ${startDate.getMonth()+1}월 · ${endDate.getMonth()+1}월`;
 if($('#bookingMonthLabel'))$('#bookingMonthLabel').textContent=monthLabel;
 if($('#bookingWeekRange'))$('#bookingWeekRange').textContent=bookingWeekRangeText();
 renderBookingWeek();
 const staffNames=['전체',...salonStaffNames];
 const tabs=$('#staffTabs');
 if(tabs){
   tabs.innerHTML='';
   staffNames.forEach(s=>{
     const b=document.createElement('button');b.type='button';b.textContent=s;b.classList.toggle('active',bookingStaff===s);
     b.onclick=()=>{bookingStaff=s;renderBooking()};tabs.appendChild(b)
   })
 }
 const data=bookingDataForWeek();
 if($('#bookingCountLabel'))$('#bookingCountLabel').textContent=bookingWeekRangeText()+' · '+bookingStaff+' '+data.length+'건';
 const board=$('#bookingWeekBoard');if(!board)return;board.innerHTML='';
 offsets.forEach((offset,dayIndex)=>{
   const d=bookingDateFromOffset(offset),dayData=data.filter(a=>Number(a.dayOffset||0)===offset).sort((a,b)=>String(a.time).localeCompare(String(b.time)));
   const col=document.createElement('section');col.className='booking-day-column'+(offset===bookingDayOffset?' selected':'')+(offset===0?' today':'');col.dataset.dayOffset=String(offset);
   const head=document.createElement('header');head.className='booking-day-head';
   head.innerHTML=`<button type="button" class="booking-day-select" aria-label="${bookingDateText(offset)} 선택"><span>${['일','월','화','수','목','금','토'][d.getDay()]}</span><b>${d.getDate()}</b><small>${dayData.length}건</small></button><button type="button" class="booking-day-add" aria-label="${bookingDateText(offset)} 예약 추가">＋</button>`;
   head.querySelector('.booking-day-select').onclick=()=>{bookingDayOffset=offset;renderBooking()};
   head.querySelector('.booking-day-add').onclick=e=>{e.stopPropagation();bookingDayOffset=offset;openQuickBooking('10:00',bookingStaff==='전체'?(salonStaffNames[0]||'루디아'):bookingStaff)};
   col.appendChild(head);
   const list=document.createElement('div');list.className='booking-day-list';
   if(!dayData.length){
     const empty=document.createElement('button');empty.type='button';empty.className='booking-day-empty';empty.innerHTML='<span>예약 없음</span><small>＋ 눌러 추가</small>';empty.onclick=()=>{bookingDayOffset=offset;openQuickBooking('10:00',bookingStaff==='전체'?(salonStaffNames[0]||'루디아'):bookingStaff)};list.appendChild(empty)
   }else{
     dayData.forEach((a,cardIndex)=>{
       const b=document.createElement('button');b.type='button';b.className='weekly-booking-card '+(a.status==='완료'?'done ':a.status==='진행중'?'progress ':a.status==='취소'||a.status==='노쇼'?'cancelled ':'waiting ');
       const staffChip=bookingStaff==='전체'?'<span class="weekly-staff">'+htmlText(a.staff||'미지정')+'</span>':'';
       b.innerHTML=`<div class="weekly-booking-copy"><div class="weekly-booking-meta"><time>${htmlText(a.time)}</time>${staffChip}</div><b>${htmlText(a.customer)}</b><small>${htmlText(a.service)}</small><em>${htmlText(a.status)} · ${won(a.amount)}원</em></div><span class="weekly-booking-art" aria-hidden="true"><img src="${htmlText(bookingArtImage(a,cardIndex+dayIndex))}" alt="" loading="lazy" decoding="async"></span>`;
       b.onclick=()=>{bookingDayOffset=offset;openOpsDetail(a)};list.appendChild(b)
     })
   }
   col.appendChild(list);board.appendChild(col)
 })
}
let quickBookingDraft={time:'13:00',staff:'루디아'};
function ensureQuickDuration(minutes){
 const select=$('#qbDuration');if(!select||!minutes)return;const value=String(minutes);if(![...select.options].some(o=>o.value===value)){const o=document.createElement('option');o.value=value;o.textContent=value+'분';select.appendChild(o)}select.value=value
}
function currentMonthKey(offset=0){
 const d=new Date();d.setDate(1);d.setMonth(d.getMonth()+offset);
 return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')
}
function monthKeyLabel(key){
 const [y,m]=String(key||currentMonthKey()).split('-').map(Number);return y+'년 '+m+'월'
}
function monthKeyForDate(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
function bookingMonthKey(){return monthKeyForDate(bookingDateFromOffset(bookingDayOffset))}
function monthlyMenuItems(key=currentMonthKey()){
 return state.library.filter(d=>(d.status==='이달의아트'||d.projectStatus==='monthly')&&String(d.monthKey||currentMonthKey())===String(key))
}
function syncQuickBookingOptions(){
 const staff=$('#qbStaff'),service=$('#qbService');
 if(staff){const current=staff.value;staff.innerHTML='';(salonStaffNames.length?salonStaffNames:['루디아']).forEach(name=>{const o=document.createElement('option');o.value=name;o.textContent=name;staff.appendChild(o)});if([...staff.options].some(o=>o.value===current))staff.value=current}
 if(service){
   const current=service.value,base=(salonServices.length?salonServices.map(s=>({name:s.name,label:s.name+' · '+s.duration_minutes+'분 · '+won(s.price)+'원'})):[
     {name:'젤 원컬러',label:'젤 원컬러'},{name:'젤 아트',label:'젤 아트'},{name:'오마카세 아트',label:'오마카세 아트'},{name:'제거 + 젤 아트',label:'제거 + 젤 아트'}
   ]);
   const specials=[{name:'이달의 아트',label:'이달의 아트 · 메뉴에서 선택'},{name:'수제디자인',label:'수제디자인 · 고객 요청'}];
   const merged=[...base.filter(x=>!specials.some(s=>s.name===x.name)),...specials];
   service.innerHTML='';merged.forEach(s=>{const o=document.createElement('option');o.value=s.name;o.textContent=s.label;service.appendChild(o)});
   service.value=[...service.options].some(o=>o.value===current)?current:(merged[0]?.name||'젤 아트');
   service.onchange=handleQuickServiceChange
 }
}
function renderQuickMonthlyArts(){
 const wrap=$('#qbMonthlyArtWrap'),grid=$('#qbMonthlyArtGrid'),month=$('#qbMonthlyArtMonth');if(!wrap||!grid)return;
 const key=bookingMonthKey(),items=monthlyMenuItems(key);if(month)month.textContent=monthKeyLabel(key);
 grid.innerHTML='';
 if(!items.length){grid.innerHTML='<div class="qb-art-empty">이번 달 등록 메뉴가 없어요.<br>이달의 아트 메뉴판에서 먼저 추가해 주세요.</div>';return}
 items.forEach(d=>{
   const b=document.createElement('button');b.type='button';b.className='qb-art-option'+(quickSelectedMonthlyArt&&String(quickSelectedMonthlyArt.id)===String(d.id)?' selected':'');
   const sale=Number(d.salePrice)||0,list=Number(d.listPrice??d.price)||0;
   b.innerHTML='<img src="'+htmlText(d.img||'assets/nail_5.jpg')+'" alt=""><span><b>'+htmlText(d.name)+'</b><small>'+(sale?'<s>'+money(list)+'</s> '+money(sale):money(list))+(d.time?' · '+d.time+'분':'')+'</small></span>';
   b.onclick=()=>{quickSelectedMonthlyArt=d;ensureQuickDuration(d.time||90);renderQuickMonthlyArts()};grid.appendChild(b)
 })
}
function handleQuickServiceChange(){
 const service=$('#qbService')?.value||'';
 $('#qbMonthlyArtWrap')?.classList.toggle('hidden',service!=='이달의 아트');
 $('#qbCustomDesignWrap')?.classList.toggle('hidden',service!=='수제디자인');
 if(service==='이달의 아트'){renderQuickMonthlyArts();if(quickSelectedMonthlyArt)ensureQuickDuration(quickSelectedMonthlyArt.time||90)}
 else{quickSelectedMonthlyArt=null;const selected=salonServices.find(x=>x.name===service);if(selected)ensureQuickDuration(selected.duration_minutes)}
}
function openQuickBooking(time='13:00',staff='루디아'){
 syncQuickBookingOptions();const safeStaff=salonStaffNames.includes(staff)?staff:(salonStaffNames[0]||staff);quickBookingDraft={time,staff:safeStaff};quickSelectedMonthlyArt=null;
 delete $('#qbCustomer').dataset.cloudCustomerId;delete $('#qbCustomer').dataset.cloudCustomerName;
 $('#qbTime').value=time;$('#qbStaff').value=safeStaff;$('#qbCustomer').value='';if($('#qbPhone'))$('#qbPhone').value='';if($('#qbCustomDesignNote'))$('#qbCustomDesignNote').value='';ensureQuickDuration(90);
 if($('#qbService')?.options.length){const preferred=[...$('#qbService').options].find(o=>o.value==='젤 아트')||$('#qbService').options[0];$('#qbService').value=preferred?.value||'젤 아트'}
 handleQuickServiceChange();
 $('#quickBookingContext').innerHTML='<b>'+bookingDateText(bookingDayOffset)+'</b><span>'+time+' · '+safeStaff+'</span>';$('#quickBookingSheet').classList.add('open');$('#quickBookingSheet').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';setTimeout(()=>$('#qbCustomer')?.focus(),180)
}
function closeQuickBooking(){$('#quickBookingSheet')?.classList.remove('open');$('#quickBookingSheet')?.setAttribute('aria-hidden','true');document.body.style.overflow=''}
async function saveQuickBooking(){
 if(salonCloudMode!=='demo'&&!window.LudiaSalonCloud?.isConnected?.())return toast('클라우드 연결을 확인한 후 다시 저장해 주세요');
 const customer=$('#qbCustomer')?.value.trim();if(!customer)return toast('고객 이름을 입력해 주세요');
 const phone=$('#qbPhone')?.value.trim()||'',rawService=$('#qbService')?.value||'젤 아트',time=$('#qbTime')?.value||quickBookingDraft.time,staff=$('#qbStaff')?.value||quickBookingDraft.staff;
 const selectedArt=rawService==='이달의 아트'?quickSelectedMonthlyArt:null;
 if(rawService==='이달의 아트'&&!selectedArt)return toast('예약할 이달의 아트를 선택해 주세요');
 const customNote=rawService==='수제디자인'?($('#qbCustomDesignNote')?.value.trim()||'고객 요청 수제디자인'):'';
 const service=selectedArt?'이달의 아트 · '+selectedArt.name:rawService;
 const serviceRecord=salonServices.find(x=>x.name===rawService)||salonServices.find(x=>x.name===service);
 const duration=Number($('#qbDuration')?.value)||selectedArt?.time||serviceRecord?.duration_minutes||90;
 const priceMap={'젤 원컬러':45000,'젤 아트':79000,'오마카세 아트':99000,'제거 + 젤 아트':89000,'수제디자인':89000};
 const amount=selectedArt?(Number(selectedArt.salePrice)||Number(selectedArt.listPrice)||Number(selectedArt.price)||79000):(serviceRecord?.price||priceMap[rawService]||69000);
 const payload={customer,phone,service,time,staff,duration,amount,date:bookingDateFromOffset(bookingDayOffset),note:customNote||'빠른 예약',artId:selectedArt?.id||null,artName:selectedArt?.name||null,designType:selectedArt?'monthly':rawService==='수제디자인'?'custom':null};
 const btn=$('#qbSaveBtn');if(btn)btn.disabled=true;
 try{
   if(salonCloudMode==='cloud'&&window.LudiaSalonCloud?.isConnected()){
     await window.LudiaSalonCloud.saveAppointment(payload);closeQuickBooking();toast(customer+' · '+time+' 예약 저장 · 실시간 반영');return
   }
   salonAppointments.push({id:Date.now(),dayOffset:bookingDayOffset,time,customer,service,staff,duration,amount,status:'대기',note:payload.note,membership:'확인 필요',last:'신규',source:'manual',artId:payload.artId,artName:payload.artName,designType:payload.designType});
   salonAppointments.sort((a,b)=>(a.dayOffset||0)-(b.dayOffset||0)||a.time.localeCompare(b.time));if(!salonCustomers.some(c=>c.name===customer&&(!phone||c.phone===phone)))salonCustomers.unshift({name:customer,phone:phone||'연락처 없음',visit:0,last:'신규',tags:[],membership:'없음',note:payload.note,img:img(5)});await persistNow();closeQuickBooking();renderBooking();if(bookingDayOffset===0)renderOpsToday();toast(customer+' · '+time+' 예약 저장')
 }catch(error){console.error(error);toast('예약 저장에 실패했어요 · 연결 상태를 확인해 주세요')}finally{if(btn)btn.disabled=false}
}
function renderCustomers(){
 const q=($('#customerSearch')?.value||'').trim().toLowerCase();
 const data=salonCustomers.filter(c=>!q||[c.name,c.phone,c.note,...(c.tags||[])].join(' ').toLowerCase().includes(q));
 const pages=Math.max(1,Math.ceil(data.length/CUSTOMER_PAGE_SIZE));customerPage=Math.min(Math.max(1,customerPage),pages);
 const start=(customerPage-1)*CUSTOMER_PAGE_SIZE,pageData=data.slice(start,start+CUSTOMER_PAGE_SIZE);
 const box=$('#customerGrid');if(!box)return;box.innerHTML='';
 pageData.forEach(c=>{const a=document.createElement('article');a.className='customer-card panel';a.innerHTML=`<div class="customer-top"><img src="${htmlText(c.img)}" alt=""><div><b>${htmlText(c.name)}</b><small>${htmlText(c.phone)}</small></div><em>${c.visit}회</em></div><p>${htmlText(c.note||'고객 메모 없음')}</p><div class="customer-tags">${(c.tags||[]).slice(0,3).map(t=>`<span>${htmlText(t)}</span>`).join('')}</div><div class="customer-foot"><span>${htmlText(c.last||'신규')} 방문</span><b>${htmlText(c.membership)}</b></div>`;a.onclick=()=>toast(`${htmlText(c.name)} 고객카드 · 상세 연결 준비됨`);box.appendChild(a)});
 const nav=$('#customerPagination'),indicator=$('#customerPageIndicator'),prev=$('#customerPrevPage'),next=$('#customerNextPage');
 if(nav)nav.classList.toggle('hidden',data.length<=CUSTOMER_PAGE_SIZE);
 if(indicator){
   indicator.innerHTML='';
   const candidates=new Set([1,pages,customerPage-1,customerPage,customerPage+1]);
   const visible=[...candidates].filter(p=>p>=1&&p<=pages).sort((a,b)=>a-b);
   let prevPage=0;
   visible.forEach(p=>{
     if(prevPage&&p-prevPage>1){const dots=document.createElement('span');dots.className='customer-page-dots';dots.textContent='…';indicator.appendChild(dots)}
     const b=document.createElement('button');b.type='button';b.textContent=String(p);b.className=p===customerPage?'active':'';b.setAttribute('aria-label',`${p}페이지`);b.onclick=()=>{customerPage=p;renderCustomers();window.scrollTo({top:0,behavior:'smooth'})};indicator.appendChild(b);prevPage=p
   })
 }
 if(prev){prev.disabled=customerPage<=1;prev.onclick=()=>{if(customerPage>1){customerPage--;renderCustomers();window.scrollTo({top:0,behavior:'smooth'})}}}
 if(next){next.disabled=customerPage>=pages;next.onclick=()=>{if(customerPage<pages){customerPage++;renderCustomers();window.scrollTo({top:0,behavior:'smooth'})}}}
}

function applyCloudSalonData(payload){
 activeSalonId=payload.salonId||null;salonCloudMode='cloud';salonAppointments=payload.appointments||[];salonCustomers=payload.customers||[];customerPage=1;salonStaffNames=payload.staffNames?.length?payload.staffNames:['미지정'];salonServices=payload.services||[];
 if(bookingStaff!=='전체'&&!salonStaffNames.includes(bookingStaff))bookingStaff='전체';
 syncQuickBookingOptions();renderOpsToday();renderBooking();renderCustomers();updateCloudAccountStatus({configured:true,connected:true,salonName:payload.salonName,email:payload.email,realtime:'live'});syncCloudArtLibrary();syncProfilePhoto();
}
function prepareCloudSalonData(){
 if(salonCloudMode==='demo')localSalonSession=structuredClone({library:state.library,designs:state.designs,appointments:salonAppointments,customers:salonCustomers,draft:state.draft});
 salonCloudMode='connecting';activeSalonId=null;artLoadSequence++;salonAppointments=[];salonCustomers=[];state.library=[];state.designs=[];state.active=null;state.collection=new Set();
 closeSheet();closeFinalView();closeOpsDetail();closeQuickBooking();closeDesignRegister();setProfilePhoto(null);renderLibrary();renderRecent();renderMonthlyMenu();renderOpsToday();renderBooking();renderCustomers();
}
function resetCloudSalonData(){
 artLoadSequence++;activeSalonId=null;salonCloudMode='demo';
 state.library=localSalonSession?.library||baseDesigns.slice(0,5);state.designs=localSalonSession?.designs||[...baseDesigns];state.draft=localSalonSession?.draft||state.draft;state.active=null;
 salonAppointments=localSalonSession?.appointments||DEMO_APPOINTMENTS.map(x=>({...x}));salonCustomers=localSalonSession?.customers||DEMO_CUSTOMERS.map(x=>({...x}));customerPage=1;salonStaffNames=['루디아','지안'];salonServices=[];bookingStaff='전체';
 closeSheet();closeFinalView();closeOpsDetail();closeQuickBooking();closeDesignRegister();renderLibrary();renderRecent();renderMonthlyMenu();renderOpsToday();renderBooking();renderCustomers();syncProfilePhoto();
}
function updateCloudAccountStatus(status={}){
 const label=$('#cloudAccountStatus'),badge=$('#cloudAccountBadge');if(!label||!badge)return;
 if(!status.configured){label.textContent='Supabase 설정 필요 · 데모 모드';badge.textContent='데모';badge.className='cloud-state-badge demo';return}
 if(status.loading){label.textContent='클라우드 확인 중…';badge.textContent='연결';badge.className='cloud-state-badge loading';return}
 if(status.connected){label.textContent=`${status.salonName||'샵'} · ${status.realtime==='live'?'실시간 동기화':'연결됨'}`;badge.textContent=status.realtime==='live'?'LIVE':'연결';badge.className='cloud-state-badge live';return}
 if(status.error==='salon_required'){label.textContent='로그인 완료 · 샵 생성 필요';badge.textContent='설정';badge.className='cloud-state-badge attention';return}
 label.textContent=status.configured?'로그인해서 예약·고객 동기화':'Supabase 설정 필요 · 데모 모드';badge.textContent=status.configured?'로그인':'데모';badge.className='cloud-state-badge '+(status.configured?'ready':'demo')
}
async function initSalonCloud(){
 if(!window.LudiaSalonCloud){updateCloudAccountStatus({configured:false});return}
 await window.LudiaSalonCloud.init({applyData:applyCloudSalonData,onSignedOut:resetCloudSalonData,onSessionChanging:prepareCloudSalonData,onStatus:updateCloudAccountStatus,toast})
}
const PROFILE_PHOTO_LOCAL_KEY='ludiaProfilePhotoLocal';
function setProfilePhoto(url){
 $$('.profile-photo-trigger').forEach(el=>{
   const imgEl=el.querySelector('.profile-photo-img'),fallback=el.querySelector('.profile-brand-fallback');
   if(imgEl){if(url){imgEl.src=url;imgEl.classList.add('visible')}else{imgEl.removeAttribute('src');imgEl.classList.remove('visible')}}
   if(fallback)fallback.classList.toggle('hidden',Boolean(url));
   el.classList.toggle('has-photo',Boolean(url));
 });
}
async function syncProfilePhoto(){
 const local=salonCloudMode==='demo'?(localStorage.getItem(PROFILE_PHOTO_LOCAL_KEY)||null):null;
 if(local)setProfilePhoto(local);else setProfilePhoto(null);
 if(!window.LudiaSalonCloud?.isConnected?.()||!window.LudiaSalonCloud?.getProfilePhotoUrl)return;
 const identity=activeSalonId;try{const url=await window.LudiaSalonCloud.getProfilePhotoUrl();if(identity===activeSalonId&&salonCloudMode==='cloud')setProfilePhoto(url)}catch(error){console.warn('[LUDIA profile photo load]',error)}
}
function fileToDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)})}
$$('.profile-photo-trigger').forEach(el=>el.addEventListener('click',()=>$('#profilePhotoInput')?.click()));
$('#profilePhotoInput')?.addEventListener('change',async e=>{
 const input=e.currentTarget,file=input.files?.[0];if(!file)return;if(salonCloudMode!=='demo'&&!window.LudiaSalonCloud?.isConnected?.()){input.value='';return toast('클라우드 연결 후 사진을 변경해 주세요')}
 if(!/^image\/(jpeg|png|webp|avif)$/i.test(file.type||'')){input.value='';return toast('JPG · PNG · WEBP · AVIF 사진만 사용할 수 있어요')}
 if(file.size>5*1024*1024){input.value='';return toast('프로필 사진은 5MB 이하로 선택해 주세요')}
 try{
   const preview=await optimizeImageFile(file,800,.88);setProfilePhoto(preview);
   if(window.LudiaSalonCloud?.isConnected?.()&&window.LudiaSalonCloud?.saveProfilePhoto){
     const url=await window.LudiaSalonCloud.saveProfilePhoto(file);localStorage.removeItem(PROFILE_PHOTO_LOCAL_KEY);if(url)setProfilePhoto(url);toast('프로필 사진을 저장했어요')
   }else{
     localStorage.setItem(PROFILE_PHOTO_LOCAL_KEY,preview);toast('이 기기의 프로필 사진을 변경했어요')
   }
 }catch(error){console.error('[LUDIA profile photo save]',error);toast('프로필 사진 저장에 실패했어요');await syncProfilePhoto()}
 finally{input.value=''}
});
function buildDirectStudioDesign({fresh=false}={}){
 if(!fresh&&state.active){ensureFingerLooks(state.active);return state.active}
 const source=state.draft.homePrompt||state.draft.concept||'';
 const base=cloneModel(baseDesigns[0]);
 base.id='studio-'+Date.now();
 base.name='내 네일 디자인';
 base.desc=source||'손가락을 선택하고 원하는 디자인을 직접 만들어보세요.';
 base.status='작업중';
 base.model=promptModelAdjust(cloneModel(MODEL_VARIANTS[0]),source);
 base.fingerLooks=null;
 ensureFingerLooks(base);
 state.active=base;
 state.designs=[base];
 state.fingers=new Set(['전체']);
 return base
}
function renderDirectStudioPreview(){
 const box=$('#directStudioPreview');if(!box)return;
 const d=buildDirectStudioDesign();
 box.innerHTML=modelPreviewHTML(d,'direct-studio-preview');
}
function openDirectStudio({fresh=false}={}){
 const d=buildDirectStudioDesign({fresh});
 renderDirectStudioPreview();
 openSheet(d);
 $('#editSheet')?.classList.add('direct-studio-mode');
}
function setView(v){
 state.view=v;document.body.classList.toggle('booking-view',v==='booking');$$('.screen').forEach(x=>x.classList.remove('active'));const target=$(`#${v}Screen`);if(!target)return;target.classList.add('active');
 const artViews=new Set(['home','create','library','collection','settings']);
 $$('.rail-nav [data-nav],.mobile-nav [data-nav]').forEach(x=>{
   const nav=x.dataset.nav;
   const active=nav===v||(artViews.has(v)&&nav==='more');
   x.classList.toggle('active',active);
 });
 $$('.art-tabs [data-nav]').forEach(x=>x.classList.toggle('active',x.dataset.nav===v));
 const titles={opsHome:'오늘, 필요한 것만.',booking:'예약',customers:'고객',more:'더보기',home:'ART STUDIO',create:'디자인 스튜디오',library:'ART 보관함',collection:'이달의 아트',settings:'DNA · 재료'};
 $('#pageTitle').textContent=titles[v]||'LUDIA NAIL';
 if(v==='create'){state.start=Date.now();renderDirectStudioPreview();setTimeout(()=>openDirectStudio(),40)}
 if(v==='booking')renderBooking();
 if(v==='customers')renderCustomers();
 if(v==='library')syncCloudArtLibrary();
 if(v==='collection'){renderMonthlyMenu();syncCloudArtLibrary()}
 window.scrollTo({top:0,behavior:'smooth'});
}
$$('[data-nav]').forEach(b=>b.onclick=()=>setView(b.dataset.nav));window.__ludiaNavBound=true;
$('#openStudioBtn')?.addEventListener('click',()=>openDirectStudio());$('#newStudioBtn')?.addEventListener('click',()=>{state.active=null;openDirectStudio({fresh:true})});
const applyTheme=mode=>{const dark=mode==='dark';document.documentElement.dataset.theme=dark?'dark':'light';document.body.classList.toggle('dark-mode',dark);localStorage.setItem('ludiaTheme',dark?'dark':'light');const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=dark?'#111113':'#f6f4ef';const btn=$('#themeBtn');if(btn){btn.classList.toggle('is-dark',dark);btn.setAttribute('aria-label',dark?'화이트 모드로 전환':'블랙 모드로 전환')}const bookingBtn=$('#bookingThemeBtn');if(bookingBtn){bookingBtn.classList.toggle('is-dark',dark);bookingBtn.setAttribute('aria-pressed',dark?'true':'false');bookingBtn.setAttribute('aria-label',dark?'화이트 모드로 전환':'블랙 모드로 전환')}const homeBtn=$('#homeThemeBtn');if(homeBtn){homeBtn.classList.toggle('is-dark',dark);homeBtn.setAttribute('aria-pressed',dark?'true':'false');homeBtn.setAttribute('aria-label',dark?'화이트 모드로 전환':'블랙 모드로 전환')}};
const savedTheme=localStorage.getItem('ludiaTheme');applyTheme(savedTheme==='dark'?'dark':'light');
const toggleTheme=()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
$('#themeBtn')?.addEventListener('click',toggleTheme);$('#bookingThemeBtn')?.addEventListener('click',toggleTheme);$('#homeThemeBtn')?.addEventListener('click',toggleTheme);window.__ludiaThemeBound=true;

const homeChipTexts=['가을 자석','성수 미니멀','웨딩 여리','강남 글리터','숏네일 심플'];
homeChipTexts.forEach(t=>{const b=document.createElement('button');b.textContent=t;b.onclick=()=>{$('#homePrompt').value=t+' 느낌으로 6개';startFromHome()};$('#homePromptChips').appendChild(b)});
function startFromHome(){const v=$('#homePrompt').value.trim();state.draft.homePrompt=v;if(v){state.draft.concept=v;if($('#conceptInput'))$('#conceptInput').value=v}state.active=null;setView('create');updateBrief();schedulePersist()}
$('#homePrompt').oninput=()=>{state.draft.homePrompt=$('#homePrompt').value;schedulePersist()};$('#homeGenerate').onclick=startFromHome;$('#quickReference').onclick=()=>{setView('create');setTimeout(()=>$('#pickRef').click(),180)};
const trendData=[['Rose Smoke Magnet','누드핑크 · 실버 캣아이'],['Clear Chrome Point','클리어 · 미러 포인트'],['Soft Wedding Glass','오팔 · 여리한 광']];
trendData.forEach((x,i)=>{const d=document.createElement('div');d.className='trend-item';d.innerHTML=`<div class="trend-main"><span class="trend-swatch" style="filter:hue-rotate(${i*25}deg)"></span><div><b>${x[0]}</b><small>${x[1]}</small></div></div><span>→</span>`;d.onclick=()=>{$('#homePrompt').value=x[0]+' '+x[1];startFromHome()};$('#trendList').appendChild(d)});
function recentCard(d){const a=document.createElement('article');a.className='recent-card';a.innerHTML=`${designPreviewHTML(d,'recent')}<div class="card-copy"><b>${htmlText(d.name)}</b><small>${htmlText(d.tags.slice(0,2).join(' · '))}</small></div>`;a.onclick=()=>openSheet(d);return a}
function renderRecent(){$('#recentStrip').replaceChildren(...state.library.slice(0,4).map(recentCard))}

function renderDNAChips(){const box=$('#dnaChips');box.innerHTML='';DNA.forEach(d=>{const b=document.createElement('button');b.textContent=d.name;b.classList.toggle('active',state.dna===d.name);b.onclick=()=>{state.dna=d.name;renderDNAChips();updateBrief();schedulePersist()};box.appendChild(b)})}
function renderConditions(){const box=$('#conditionChips');box.innerHTML='';conditions.forEach(t=>{const b=document.createElement('button');b.textContent=t;b.classList.toggle('active',state.conditions.has(t));b.onclick=()=>{state.conditions.has(t)?state.conditions.delete(t):state.conditions.add(t);renderConditions();updateBrief();schedulePersist()};box.appendChild(b)})}
function renderNails(){const box=$('#nailPreview');box.innerHTML='';for(let i=0;i<5;i++){const n=document.createElement('div');n.className='nail-tip';n.style.filter=`hue-rotate(${i*3}deg)`;box.appendChild(n)}}
function updateBrief(){const time=+$('#maxTime').value||90;const price=+$('#targetPrice').value||69000;const c=[...state.conditions];const concept=$('#conceptInput').value.trim();$('#briefTitle').textContent=`${state.dna} · ${c?concept.split(/[,.]/)[0].slice(0,14):'밀키 자석'}`;$('#briefCopy').textContent=`시술시간 ${time}분, 목표 ${money(price)} 안에서 ${c.includes('화려')?'포인트를 살리고':'과한 요소는 줄여'} 실제 샵에서 재현하기 쉽게 구성합니다.`;$('#briefCount').textContent=`${c.length?1:0+c.length} ${c.length?'BRIEF · ':''}${c.length?c.length+'자':''}`;const fit=Math.max(84,97-c.length*1-(time<80?2:0));$('#fitScore').textContent=fit+'%';$('#fitMeter').style.width=fit+'%';const notes=[`${state.dna} 프리셋 우선`,`선택 조건 ${c.length?c.length:'0'}개 반영`, $('#stockFirst').checked?'보유재료 우선 · 품절 파츠 대체 제안':'재고 제한 없이 아이디어 우선'];$('#briefList').replaceChildren(...notes.map(t=>{const d=document.createElement('div');d.className='brief-note';d.textContent=t;return d}))}
$('#conceptInput').oninput=()=>{state.draft.concept=$('#conceptInput').value;updateBrief();schedulePersist()};$('#maxTime').onchange=()=>{state.draft.maxTime=$('#maxTime').value;updateBrief();schedulePersist()};$('#targetPrice').onchange=()=>{state.draft.targetPrice=$('#targetPrice').value;updateBrief();schedulePersist()};$('#stockFirst').onchange=()=>{state.draft.stockFirst=$('#stockFirst').checked;updateBrief();schedulePersist()};
$('#pickRef').onclick=()=>$('#refFile').click();$('#refFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>18*1024*1024){toast('사진은 18MB 이하로 선택해 주세요');return}try{setSaveStatus('saving','사진 저장 중…');const data=await optimizeImageFile(f);state.draft.refDataUrl=data;$('#refPreviewImg').src=data;$('#refEmpty').classList.add('hidden');$('#refPreview').classList.remove('hidden');toast('참고사진을 기기에 저장했어요');updateBrief();schedulePersist()}catch(err){toast('사진을 불러오지 못했어요')}};$('#removeRef').onclick=()=>{$('#refFile').value='';state.draft.refDataUrl=null;$('#refPreview').classList.add('hidden');$('#refEmpty').classList.remove('hidden');schedulePersist()};

const MODEL_VARIANTS=[
 {key:'blush-magnet',name:'Soft Blush Magnet',base:'#f3c8cd',accent:'#fff3f5',magnet:2,aurora:0,french:0,gems:1,accentFingers:[3,8],texture:'syrup'},
 {key:'micro-french',name:'Micro Silver French',base:'#e8d5cb',accent:'#e7e9ed',magnet:0,aurora:0,french:2,gems:0,accentFingers:[1,2,3,6,7,8],texture:'nude'},
 {key:'ribbon-pearl',name:'Ludia Ribbon Pearl',base:'#efd7df',accent:'#fff8f6',magnet:0,aurora:1,french:0,gems:3,accentFingers:[0,3,5,8],texture:'pearl'},
 {key:'gray-drop',name:'Nuance Gray Drop',base:'#bfc0c4',accent:'#e9ebef',magnet:1,aurora:0,french:0,gems:1,accentFingers:[2,7],texture:'smoke'},
 {key:'dot-jelly',name:'Mini Dot Jelly',base:'#efbfc8',accent:'#ffffff',magnet:0,aurora:0,french:0,gems:2,accentFingers:[1,4,6,9],texture:'jelly'},
 {key:'aurora-glass',name:'Aurora Glass',base:'#e7cbd9',accent:'#bde8ef',magnet:1,aurora:3,french:0,gems:2,accentFingers:[2,3,7,8],texture:'glass'}
];
function cloneModel(m){return JSON.parse(JSON.stringify(m))}
function studioSource(){
 return [state.draft.concept||'',state.draft.homePrompt||'',state.dna,[...state.conditions].sort().join('|')].join('::')
}
function promptModelAdjust(model,text){
 const t=(text||studioSource()).toLowerCase();const cond=[...state.conditions].join(' ');
 if(/자석|magnet/.test(t)||cond.includes('자석 강하게'))model.magnet=Math.max(model.magnet,2);
 if(/오로라|aurora/.test(t)||cond.includes('오로라'))model.aurora=Math.max(model.aurora,2);
 if(/프렌치|french/.test(t))model.french=Math.max(model.french,2);
 if(/심플|minimal/.test(t)||cond.includes('더 심플')){model.gems=Math.min(model.gems,1);model.aurora=Math.min(model.aurora,1)}
 if(cond.includes('파츠 2개 이하'))model.gems=Math.min(model.gems,2);
 if(cond.includes('실버 포인트'))model.accent='#e7e9ed';
 return model
}
function modelLookForIndex(d,i){
 const m=d.model||MODEL_VARIANTS[i%MODEL_VARIANTS.length];const accent=(m.accentFingers||[]).includes(i);
 return {mods:[],levels:{},base:m.base,accent:m.accent,magnet:accent?m.magnet:Math.max(0,m.magnet-1),aurora:accent?m.aurora:Math.max(0,m.aurora-1),french:m.french,gems:accent?m.gems:0,texture:m.texture||'syrup',shape:m.shape||'oval',length:Number.isFinite(m.length)?m.length:2}
}
function nailVisualState(look){
 const mods=look.mods||[];const lvl=look.levels||{};let base=look.base||'#edc8cf',accent=look.accent||'#ffffff';
 let magnet=Math.max(look.magnet||0,lvl['자석감 강하게']||0);let aurora=Math.max(look.aurora||0,lvl['오로라감 추가']||0);let french=look.french||0;let gems=Math.max(look.gems||0,lvl['포인트 추가']||0,lvl['화려하게']||0);
 if(mods.includes('더 연하게'))base='color-mix(in srgb, '+base+' 68%, white)';
 if(mods.includes('더 진하게'))base='color-mix(in srgb, '+base+' 80%, #4a2630)';
 if(mods.includes('더 심플')||mods.includes('파츠 줄이기')||mods.includes('실물시술 쉽게'))gems=Math.min(gems,1);
 if(mods.includes('청순하게')){base='color-mix(in srgb, '+base+' 72%, white)';aurora=Math.min(aurora,1)}
 if(mods.includes('성수 무드')){base='color-mix(in srgb, '+base+' 70%, #9b9ba0)';gems=Math.min(gems,1)}
 if(mods.includes('강남 무드')){magnet=Math.max(magnet,2);gems=Math.max(gems,2)}
 return {base,accent,magnet:Math.min(3,magnet),aurora:Math.min(3,aurora),french:Math.min(3,french),gems:Math.min(3,gems),texture:look.texture||'syrup'}
}
function safeAttr(value){return String(value||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}
function nailMarkup(look,cls=''){
 const v=nailVisualState(look);const gems=Array.from({length:v.gems},(_,i)=>`<i class="model-gem g${i+1}"></i>`).join('');const shape=look.shape||'oval';const length=Math.max(0,Math.min(3,Number.isFinite(look.length)?look.length:2));
 const canvas=look.canvas||{},drawing=canvas.drawing?`<img class="model-canvas-drawing" src="${safeAttr(canvas.drawing)}" alt="">`:'';
 const parts=(canvas.parts||[]).map(p=>{const x=Math.max(0,Math.min(100,Number(p.x)||50)),y=Math.max(0,Math.min(100,Number(p.y)||50)),r=Number(p.r)||0,s=Math.max(.35,Math.min(2.4,Number(p.s)||1));const body=p.data?`<img src="${safeAttr(p.data)}" alt="">`:`<span>${String(p.icon||'✦').replace(/</g,'&lt;')}</span>`;return `<i class="model-canvas-part" style="left:${x}%;top:${y}%;--part-r:${r}deg;--part-s:${s}">${body}</i>`}).join('');
 return `<span class="nail-model ${cls} texture-${safeAttr(v.texture)} shape-${safeAttr(shape)} length-${length}" style="--nail-base:${safeAttr(v.base)};--nail-accent:${safeAttr(v.accent)};--mag:${v.magnet/3};--aur:${v.aurora/3};--french:${v.french/3}"><span class="model-base"></span><span class="model-wash"></span><span class="model-aurora"></span><span class="model-magnet"></span><span class="model-french"></span>${drawing}${gems}${parts}<span class="model-gloss"></span></span>`
}
function modelPreviewHTML(d,mode='card'){
 ensureFingerLooks(d);
 if(mode==='editor-live'||mode==='direct-studio-preview'){
   const hand=(fingers,side)=>`<div class="model-palm model-palm-${side}">${fingers.map((f,i)=>`<span class="model-finger mf${i+1}">${nailMarkup(d.fingerLooks[f],'preview-nail')}</span>`).join('')}</div>`;
   return `<div class="model-preview ${mode} dual-hand-preview"><div class="model-dual-wrap">${hand(FINGERS.slice(0,5),'left')}${hand(FINGERS.slice(5,10),'right')}</div></div>`
 }
 const fingers=FINGERS.slice(5,10);return `<div class="model-preview ${mode}"><div class="model-palm">${fingers.map((f,i)=>`<span class="model-finger mf${i+1}">${nailMarkup(d.fingerLooks[f],'preview-nail')}</span>`).join('')}</div></div>`
}
function designPreviewHTML(d,mode='card'){return d.model?modelPreviewHTML(d,mode):`<img src="${htmlText(d.img)}" alt="${htmlText(d.name)}">`}
async function saveDesign(d){
 if(!d)return false;
 if(salonCloudMode!=='demo'&&!window.LudiaSalonCloud?.isConnected?.()){toast('클라우드 연결 후 다시 저장해 주세요');return false}
 try{
  let saved=structuredClone({...d,savedAt:new Date().toISOString()});
  if(salonCloudMode==='cloud'){
   const payload={id:d.cloudArt?d.id:null,name:d.name,price:d.price,listPrice:d.listPrice??d.price,salePrice:d.salePrice||0,monthKey:d.monthKey||'',time:d.time,tags:d.tags||[],materials:d.materials||[],difficulty:d.diff,tech:d.tech,description:d.desc,status:d.projectStatus||'draft',designState:{model:d.model,fingerLooks:d.fingerLooks,baseTime:d.baseTime,basePrice:d.basePrice}};
   saved=d.cloudArt?await window.LudiaSalonCloud.updateArtDesign(payload):await window.LudiaSalonCloud.saveArtDesign(payload);
   if(!saved)throw new Error('empty design result');state.active=saved;
  }
  state.library=[saved,...state.library.filter(x=>String(x.id)!==String(saved.id))];renderLibrary();renderRecent();renderPicker();await persistNow();toast(salonCloudMode==='cloud'?'현재 샵에 디자인을 저장했어요':'이 기기에 디자인을 저장했어요');return true;
 }catch(error){console.error('[LUDIA editor save]',error);toast('디자인 저장에 실패했어요');return false}
}
const FINGERS=['L엄지','L검지','L중지','L약지','L소지','R엄지','R검지','R중지','R약지','R소지'];
const NAIL_SHAPES=[['round','라운드'],['oval','오벌'],['almond','아몬드'],['square','스퀘어'],['ballerina','발레리나']];
const NAIL_LENGTH_LABELS=['숏','보통','롱','엑스트라'];
const NAIL_COLORS=['#f1c7ce','#e6d0c4','#d6b7c7','#b9cee6','#f0ebe5','#a84b59','#5a5860','#ffffff'];
const NAIL_TEXTURES=[['syrup','시럽'],['jelly','젤리'],['glass','글라스'],['pearl','펄'],['smoke','스모크']];
let editorHistory=[],editorRedo=[],editorOriginal=null,editorPreviewMode='current';
function snapshotFingerLooks(d){ensureFingerLooks(d);return cloneModel(d.fingerLooks)}
function syncCanvasFromActive(){const f=window.LudiaNailCanvas?.getCurrentFinger?.();if(f)window.LudiaNailCanvas.openFinger(f,{preserveSelection:true,scroll:false})}
function restoreFingerLooks(d,snap){d.fingerLooks=cloneModel(snap);syncCanvasFromActive();recalcDesign(d);renderHandEditor();renderArtLiveStage();renderEditorMetrics();syncEditChipStates();render3DStage();renderDirectStudioPreview();schedulePersist()}
function pushEditorHistory(){if(!state.active)return;editorHistory.push(snapshotFingerLooks(state.active));if(editorHistory.length>40)editorHistory.shift();editorRedo=[];updateHistoryButtons()}
function updateHistoryButtons(){const u=$('#undoEditBtn'),r=$('#redoEditBtn');if(u)u.disabled=!editorHistory.length;if(r)r.disabled=!editorRedo.length}
function undoEditor(){if(!state.active||!editorHistory.length)return;editorRedo.push(snapshotFingerLooks(state.active));restoreFingerLooks(state.active,editorHistory.pop());updateHistoryButtons();toast('한 단계 되돌렸어요')}
function redoEditor(){if(!state.active||!editorRedo.length)return;editorHistory.push(snapshotFingerLooks(state.active));restoreFingerLooks(state.active,editorRedo.pop());updateHistoryButtons();toast('다시 적용했어요')}
function designWithFingerSnapshot(snap){return {...state.active,fingerLooks:cloneModel(snap||{})}}
function renderArtLiveStage(){
 const stage=$('#artLiveStage');if(!stage||!state.active)return;
 const current=modelPreviewHTML(state.active,'editor-live');
 const original=editorOriginal?modelPreviewHTML(designWithFingerSnapshot(editorOriginal),'editor-live'):'';
 if(editorPreviewMode==='original')stage.innerHTML='<div class="art-stage-single"><span class="art-stage-label">원본</span>'+original+'</div>';
 else if(editorPreviewMode==='split')stage.innerHTML='<div class="art-stage-split"><div><span class="art-stage-label">원본</span>'+original+'</div><div><span class="art-stage-label">현재</span>'+current+'</div></div>';
 else stage.innerHTML='<div class="art-stage-single"><span class="art-stage-label live">LIVE</span>'+current+'</div>';
 $$('#artPreviewTabs [data-preview-mode]').forEach(b=>b.classList.toggle('active',b.dataset.previewMode===editorPreviewMode));
}
function setFingerSelectionFromText(text){
 const t=text||'';let picks=[];
 if(/전체|모든/.test(t))picks=['전체'];
 else if(/왼손|left/i.test(t))picks=FINGERS.slice(0,5);
 else if(/오른손|right/i.test(t))picks=FINGERS.slice(5);
 else{
  const map=[['엄지',['L엄지','R엄지']],['검지',['L검지','R검지']],['중지',['L중지','R중지']],['약지',['L약지','R약지']],['소지',['L소지','R소지']]];
  map.forEach(([k,v])=>{if(t.includes(k))picks.push(...v)});
  if(/왼쪽|L엄|L검|L중|L약|L소/.test(t))picks=picks.filter(x=>x.startsWith('L'));
  if(/오른쪽|R엄|R검|R중|R약|R소/.test(t))picks=picks.filter(x=>x.startsWith('R'));
 }
 if(picks.length){state.fingers=new Set([...new Set(picks)]);renderHandEditor();return true}
 return false
}
function parseDirectRequest(text){
 const t=(text||'').toLowerCase();const mods=[];
 if(/연하게|밝게|투명/.test(t))mods.push('더 연하게');
 if(/진하게|딥|짙게/.test(t))mods.push('더 진하게');
 if(/심플|깔끔|단순/.test(t))mods.push('더 심플');
 if(/파츠.*줄|스톤.*줄|장식.*줄|제거/.test(t))mods.push('파츠 줄이기');
 if(/포인트.*추|스톤.*추|파츠.*추/.test(t))mods.push('포인트 추가');
 if(/자석|캣아이/.test(t))mods.push('자석감 강하게');
 if(/오로라|유리알|글라스/.test(t))mods.push('오로라감 추가');
 if(/성수|뉴트럴|미니멀/.test(t))mods.push('성수 무드');
 if(/강남|화려|블링/.test(t))mods.push('강남 무드');
 if(/청순|여리|웨딩/.test(t))mods.push('청순하게');
 if(/가격|저렴|낮춰/.test(t))mods.push('가격 낮춰서');
 return [...new Set(mods)];
}
function applyDirectColor(text){
 if(!state.active)return false;const t=(text||'').toLowerCase();let palette=null;
 if(/블루|파랑|blue/.test(t))palette=['#b8d2ef','#edf6ff'];
 else if(/레드|빨강|와인|red/.test(t))palette=['#a84655','#f3d6dc'];
 else if(/블랙|검정|black/.test(t))palette=['#34343a','#e9e9ed'];
 else if(/화이트|흰색|white/.test(t))palette=['#efe8e7','#ffffff'];
 else if(/핑크|분홍|pink/.test(t))palette=['#efbec8','#fff1f5'];
 else if(/누드|베이지|beige/.test(t))palette=['#dfc4b7','#f4e8df'];
 if(!palette)return false;
 selectedFingerNames().forEach(f=>{state.active.fingerLooks[f].base=palette[0];state.active.fingerLooks[f].accent=palette[1]});return true;
}
const lookClassMap={
 '더 연하게':'look-light','더 진하게':'look-deep','더 심플':'look-simple','파츠 줄이기':'look-simple',
 '포인트 추가':'look-accent','자석감 강하게':'look-magnet','오로라감 추가':'look-aurora','성수 무드':'look-seongsu',
 '강남 무드':'look-gangnam','청순하게':'look-soft','화려하게':'look-glam','실물시술 쉽게':'look-easy',
 '가격 낮춰서':'look-budget','이달의 아트용':'look-monthly','오마카세용':'look-omakase'
};
function ensureFingerLooks(d){
 if(!d.fingerLooks)d.fingerLooks={};
 FINGERS.forEach((f,i)=>{if(!d.fingerLooks[f])d.fingerLooks[f]=modelLookForIndex(d,i);else{d.fingerLooks[f].mods=d.fingerLooks[f].mods||[];d.fingerLooks[f].levels=d.fingerLooks[f].levels||{};d.fingerLooks[f].shape=d.fingerLooks[f].shape||'oval';if(!Number.isFinite(d.fingerLooks[f].length))d.fingerLooks[f].length=2}});
 if(!d.baseTime)d.baseTime=d.time;if(!d.basePrice)d.basePrice=d.price;return d.fingerLooks;
}
function selectedFingerNames(){return state.fingers.has('전체')?[...FINGERS]:[...state.fingers]}
function recalcDesign(d){
 ensureFingerLooks(d);const all=FINGERS.flatMap(f=>d.fingerLooks[f].mods||[]);const has=m=>all.includes(m);
 let t=d.baseTime,p=d.basePrice;
 if(has('더 심플')||has('파츠 줄이기')||has('실물시술 쉽게'))t-=10;
 if(has('포인트 추가')||has('화려하게')||has('오마카세용'))t+=8;
 if(has('가격 낮춰서'))p-=10000;
 d.time=Math.max(40,t);d.price=Math.max(39000,p);
}
function fingerLookClasses(mods=[]){return mods.map(m=>lookClassMap[m]).filter(Boolean).join(' ')}
function renderHandEditor(){
 if(!state.active)return;ensureFingerLooks(state.active);const box=$('#handEditor');if(!box)return;box.innerHTML='';
 const hands=[['LEFT',FINGERS.slice(0,5)],['RIGHT',FINGERS.slice(5)]];
 hands.forEach(([label,list])=>{const hand=document.createElement('div');hand.className='editor-hand';hand.innerHTML=`<span class="hand-label">${label}</span><div class="editor-fingers"></div>`;const row=hand.querySelector('.editor-fingers');
   list.forEach((f,i)=>{const look=state.active.fingerLooks[f];const b=document.createElement('button');b.type='button';b.className=`finger-photo ${state.fingers.has('전체')||state.fingers.has(f)?'selected':''}`;b.dataset.finger=f;b.setAttribute('aria-label',f.replace('L','왼손 ').replace('R','오른손 '));b.setAttribute('aria-pressed',String(state.fingers.has('전체')||state.fingers.has(f)));b.innerHTML=`<span class="finger-model-wrap">${nailMarkup(look,'editor-model')}</span><small>${f.replace(/^L|^R/,'')}</small><i>${Object.values(look.levels||{}).reduce((a,b)=>a+b,0)||(look.mods||[]).length||''}</i>`;b.onclick=()=>{
     const wasAll=state.fingers.has('전체'),wasSelected=state.fingers.has(f);
     if(wasAll){state.fingers=new Set([f]);window.LudiaNailCanvas?.openFinger(f,{preserveSelection:true})}
     else if(wasSelected){
       if(state.fingers.size>1){state.fingers.delete(f);if(window.LudiaNailCanvas?.getCurrentFinger?.()===f)window.LudiaNailCanvas?.openFinger(selectedFingerNames()[0],{preserveSelection:true})}
     }else{
       state.fingers.add(f)
     }
     renderHandEditor();syncEditChipStates();renderPrecisionEditor();renderArtLiveStage();renderDirectStudioPreview();if($('#finalViewSheet')?.classList.contains('open'))render3DStage()
   };row.appendChild(b)});box.appendChild(hand)});
 window.LudiaNailCanvas?.updateSelectionLabel?.();const sel=selectedFingerNames();const helper=$('#fingerHelper'),liveState=$('#liveEditState');if(helper)helper.textContent=state.fingers.has('전체')?'전체 손가락에 수정이 즉시 반영됩니다.':`${sel.join(' · ')}만 수정합니다.`;if(liveState)liveState.textContent=state.fingers.has('전체')?'전체 선택':`${sel.length}개 선택`;renderPrecisionEditor();
}
function toggleFingerFromPhoto(f){
 if(state.fingers.has('전체'))state.fingers=new Set([f]);else if(state.fingers.has(f)&&state.fingers.size>1)state.fingers.delete(f);else if(!state.fingers.has(f))state.fingers.add(f);
 renderHandEditor();syncEditChipStates();renderPrecisionEditor();renderArtLiveStage();renderDirectStudioPreview()
}
function syncEditChipStates(){
 if(!state.active)return;ensureFingerLooks(state.active);const selected=selectedFingerNames();
 $$('#editChips button').forEach(b=>{const m=b.dataset.mod||b.textContent;const on=selected.length&&selected.every(f=>state.active.fingerLooks[f].mods.includes(m));b.classList.toggle('active',on)});
}
function renderPrecisionEditor(){
 if(!state.active||!$('#precisionEditor'))return;ensureFingerLooks(state.active);const targets=selectedFingerNames();const looks=targets.map(f=>state.active.fingerLooks[f]);const same=key=>looks.every(x=>x[key]===looks[0][key]);
 $('#precisionTarget').textContent=state.fingers.has('전체')?'전체 10손가락':targets.join(' · ');
 $$('[data-nail-shape]').forEach(b=>b.classList.toggle('active',same('shape')&&looks[0].shape===b.dataset.nailShape));
 const lv=looks.map(x=>Number.isFinite(x.length)?x.length:2),uniform=lv.every(x=>x===lv[0]),length=Math.round(lv.reduce((a,b)=>a+b,0)/Math.max(1,lv.length));$('#nailLength').value=String(length);$('#nailLengthValue').textContent=uniform?NAIL_LENGTH_LABELS[length]:'혼합';
 $$('[data-nail-color]').forEach(b=>b.classList.toggle('active',same('base')&&looks[0].base.toLowerCase()===b.dataset.nailColor.toLowerCase()));
 $$('[data-nail-texture]').forEach(b=>b.classList.toggle('active',same('texture')&&looks[0].texture===b.dataset.nailTexture));
 const gems=looks.map(x=>x.gems||0);$('#partsCount').textContent=gems.every(x=>x===gems[0])?String(gems[0]):'혼합'
}
function applyPrecisionEdit(label,mutator){
 if(!state.active)return;pushEditorHistory();selectedFingerNames().forEach(f=>mutator(state.active.fingerLooks[f]));syncCanvasFromActive();recalcDesign(state.active);renderHandEditor();renderArtLiveStage();renderEditorMetrics();render3DStage();syncEditChipStates();schedulePersist();updateHistoryButtons();renderDirectStudioPreview();toast(label+' 적용')
}
function applyLiveMod(mod,{record=true,quiet=false}={}){
 if(!state.active)return;ensureFingerLooks(state.active);if(record)pushEditorHistory();const targets=selectedFingerNames();const stepped=new Set(['자석감 강하게','오로라감 추가','포인트 추가','화려하게']);
 targets.forEach(f=>{const look=state.active.fingerLooks[f];look.levels=look.levels||{};look.mods=look.mods||[];
   if(mod==='원본으로'){state.active.fingerLooks[f]=editorOriginal?.[f]?cloneModel(editorOriginal[f]):modelLookForIndex(state.active,FINGERS.indexOf(f));return}
   if(stepped.has(mod)){look.levels[mod]=Math.min(3,(look.levels[mod]||0)+1);if(!look.mods.includes(mod))look.mods.push(mod)}
   else{look.mods=look.mods.includes(mod)?look.mods.filter(x=>x!==mod):[...look.mods,mod]}
 });
 syncCanvasFromActive();recalcDesign(state.active);renderHandEditor();syncEditChipStates();renderArtLiveStage();renderEditorMetrics();render3DStage();schedulePersist();updateHistoryButtons();renderDirectStudioPreview();if(!quiet)toast((targets.length===10?'전체':targets.join(' · '))+' · '+mod+' 즉시 반영');
}
function renderEditorMetrics(){const d=state.active;if(!d)return;$('#metricRow').innerHTML=`<div class="metric"><span>난이도</span><b>${htmlText(d.diff)}</b></div><div class="metric"><span>시간</span><b>${d.time}분</b></div><div class="metric"><span>권장가</span><b>${money(d.price)}</b></div><div class="metric"><span>실행성</span><b>${d.fit}%</b></div>`}
function openSheet(d){
 const sheet=$('#editSheet');if(!sheet)return toast('편집 화면을 불러오지 못했어요');
 window.LudiaNailCanvas?.reset?.();state.active=d;state.fingers=new Set(['전체']);ensureFingerLooks(d);recalcDesign(d);editorOriginal=snapshotFingerLooks(d);editorHistory=[];editorRedo=[];editorPreviewMode='current';
 sheet.classList.add('open');sheet.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
 try{
  if($('#sheetName'))$('#sheetName').textContent=d.name||'내 네일 디자인';if($('#sheetDesc'))$('#sheetDesc').textContent=d.desc||'';
  renderEditorMetrics();const guide=$('#serviceGuide');if(guide)guide.innerHTML='<b>실제 시술 가이드</b><span>재료 · '+htmlText((d.materials||[]).join(' · ')||'직접 구성')+'</span><span>순서 · '+htmlText(d.tech||'직접 편집')+'</span><span>대체 · 품절 파츠가 있으면 미니 스톤/실버 라인/진주 계열로 우선 대체</span>';
  renderHandEditor();renderArtLiveStage();syncEditChipStates();updateHistoryButtons();if($('#editPrompt'))$('#editPrompt').value='';
 }catch(error){console.error('[LUDIA editor open]',error);toast('편집기는 열렸어요 · 일부 보조 UI를 확인 중입니다')}
}
function closeSheet(){$('#editSheet').classList.remove('open','direct-studio-mode');$('#editSheet').setAttribute('aria-hidden','true');document.body.style.overflow='';renderDirectStudioPreview()}
$$('[data-close-sheet]').forEach(x=>x.onclick=closeSheet);
editOptions.forEach(t=>{const b=document.createElement('button');b.textContent=t;b.dataset.mod=t;b.onclick=()=>applyLiveMod(t);$('#editChips').appendChild(b)});
NAIL_SHAPES.forEach(([key,label])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.nailShape=key;b.onclick=()=>applyPrecisionEdit(label,x=>x.shape=key);$('#nailShapeControls').appendChild(b)});
NAIL_COLORS.forEach(color=>{const b=document.createElement('button');b.type='button';b.className='nail-color-swatch';b.dataset.nailColor=color;b.style.setProperty('--swatch',color);b.setAttribute('aria-label','컬러 '+color);b.onclick=()=>applyPrecisionEdit('컬러',x=>x.base=color);$('#nailColorControls').appendChild(b)});
NAIL_TEXTURES.forEach(([key,label])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.nailTexture=key;b.onclick=()=>applyPrecisionEdit(label,x=>x.texture=key);$('#nailTextureControls').appendChild(b)});
$('#nailLength').oninput=e=>{$('#nailLengthValue').textContent=NAIL_LENGTH_LABELS[+e.target.value]||'보통'};$('#nailLength').onchange=e=>{const value=+e.target.value;applyPrecisionEdit('길이 '+(NAIL_LENGTH_LABELS[value]||''),x=>x.length=value)};
$('#partsMinus').onclick=()=>applyPrecisionEdit('파츠 줄이기',x=>x.gems=Math.max(0,(x.gems||0)-1));$('#partsPlus').onclick=()=>applyPrecisionEdit('파츠 추가',x=>x.gems=Math.min(3,(x.gems||0)+1));
$('#saveDesignBtn').onclick=()=>state.active&&saveDesign(state.active);$('#sheetFavorite').onclick=e=>{e.currentTarget.textContent=e.currentTarget.textContent==='♡'?'♥':'♡';toast('즐겨찾기에 반영했어요')};
$('#undoEditBtn').onclick=undoEditor;$('#redoEditBtn').onclick=redoEditor;
$$('#artPreviewTabs [data-preview-mode]').forEach(b=>b.onclick=()=>{editorPreviewMode=b.dataset.previewMode;renderArtLiveStage()});
$('#applyEditBtn').onclick=()=>{const text=$('#editPrompt').value.trim();if(!state.active)return toast('디자인을 먼저 선택해 주세요');if(!text)return toast('수정 내용을 입력해 주세요');
 setFingerSelectionFromText(text);pushEditorHistory();const mods=parseDirectRequest(text);const colored=applyDirectColor(text);mods.forEach(m=>applyLiveMod(m,{record:false,quiet:true}));
 if(!mods.length&&!colored){editorHistory.pop();updateHistoryButtons();return toast('예: 약지만 오로라, 전체 더 연하게, 블루톤처럼 입력해 주세요')}
 recalcDesign(state.active);renderHandEditor();renderArtLiveStage();renderEditorMetrics();syncEditChipStates();$('#editPrompt').value='';
 const fingers=selectedFingerNames();state.active.editHistory=[...(state.active.editHistory||[]),{at:new Date().toISOString(),fingers,text,after:{time:state.active.time,price:state.active.price,diff:state.active.diff}}];
 schedulePersist();toast('요청을 LIVE 프리뷰에 바로 반영했어요')
};
$('#finalSaveFromEditor').onclick=()=>saveDesign(state.active);

let viewerRotX=-8,viewerRotY=0,viewerDragging=false,viewerPX=0,viewerPY=0,viewerFocusFinger=null;
function render3DStage(){
 const stage=$('#viewerStage');if(!stage||!state.active)return;ensureFingerLooks(state.active);stage.innerHTML='';stage.style.transform=`rotateX(${viewerRotX}deg) rotateY(${viewerRotY}deg)`;
 const back=$('#viewerFocusBack'),hint=$('#viewerHint');
 if(viewerFocusFinger){
   const look=state.active.fingerLooks[viewerFocusFinger];const single=document.createElement('div');single.className='viewer-single-card';single.innerHTML=`<div class="viewer-single-nail">${nailMarkup(look,'viewer-focus-model')}</div><b>${viewerFocusFinger.replace('L','왼손 ').replace('R','오른손 ')}</b><small>드래그해서 각도를 확인하세요</small>`;stage.appendChild(single);
   back?.classList.remove('hidden');if(hint)hint.textContent='↔ 드래그 · ↕ 기울이기 · 전체 손으로 돌아가기';
   return
 }
 back?.classList.add('hidden');if(hint)hint.textContent='손톱을 누르면 단독 확대 · ↔ 드래그 · ↕ 기울이기';
 const hand=document.createElement('div');hand.className='viewer-hand-card';
 FINGERS.forEach((f,i)=>{const look=state.active.fingerLooks[f];const n=document.createElement('button');n.type='button';n.className=`viewer-nail v${i+1}`;n.setAttribute('aria-label',f+' 단독 확대');n.innerHTML=`${nailMarkup(look,'viewer-model')}<small>${f}</small>`;n.onclick=e=>{e.stopPropagation();viewerFocusFinger=f;viewerRotX=-4;viewerRotY=0;render3DStage()};hand.appendChild(n)});stage.appendChild(hand)
}
function openFinalView(){if(!state.active)return;viewerRotX=-8;viewerRotY=0;viewerFocusFinger=null;render3DStage();$('#finalViewSheet').classList.add('open');$('#finalViewSheet').setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}
function closeFinalView(){$('#finalViewSheet').classList.remove('open');$('#finalViewSheet').setAttribute('aria-hidden','true');document.body.style.overflow=$('#editSheet').classList.contains('open')?'hidden':''}
$('#final3dBtn').onclick=openFinalView;$$('[data-close-final]').forEach(x=>x.onclick=closeFinalView);
$('#viewerFocusBack')?.addEventListener('click',()=>{viewerFocusFinger=null;viewerRotX=-8;viewerRotY=0;render3DStage()});
$$('[data-view-angle]').forEach(b=>b.onclick=()=>{const a=b.dataset.viewAngle;$$('[data-view-angle]').forEach(x=>x.classList.remove('active'));b.classList.add('active');if(a==='front'){viewerRotX=-8;viewerRotY=0}if(a==='left'){viewerRotX=-6;viewerRotY=-30}if(a==='right'){viewerRotX=-6;viewerRotY=30}if(a==='top'){viewerRotX=25;viewerRotY=0}render3DStage()});
const viewerShell=$('#viewerShell');
let viewerMoved=false,viewerStartX=0,viewerStartY=0;
viewerShell?.addEventListener('pointerdown',e=>{viewerDragging=true;viewerMoved=false;viewerPX=viewerStartX=e.clientX;viewerPY=viewerStartY=e.clientY});
viewerShell?.addEventListener('click',e=>{if(viewerMoved){e.preventDefault();e.stopImmediatePropagation()}},true);
viewerShell?.addEventListener('pointermove',e=>{if(!viewerDragging)return;if(!viewerMoved&&Math.hypot(e.clientX-viewerStartX,e.clientY-viewerStartY)<5)return;viewerMoved=true;viewerShell.setPointerCapture?.(e.pointerId);viewerRotY=Math.max(-55,Math.min(55,viewerRotY+(e.clientX-viewerPX)*.35));viewerRotX=Math.max(-30,Math.min(35,viewerRotX-(e.clientY-viewerPY)*.25));viewerPX=e.clientX;viewerPY=e.clientY;render3DStage()});
['pointerup','pointercancel','pointerleave'].forEach(ev=>viewerShell?.addEventListener(ev,()=>viewerDragging=false));
$('#finalSaveBtn').onclick=async()=>{if(state.active&&await saveDesign(state.active))closeFinalView()};

function renderLibrary(){const q=($('#librarySearch')?.value||'').trim().toLowerCase();const f=state.filter;const data=state.library.filter(d=>(f==='전체'||d.status===f||d.tags.includes(f))&&(!q||d.name.toLowerCase().includes(q)||d.tags.join(' ').toLowerCase().includes(q)));$('#libraryGrid').innerHTML='';data.forEach(d=>{const a=document.createElement('article');a.className='library-card';a.innerHTML=`<span class="status-badge">${d.status}</span>${designPreviewHTML(d,'library')}<div class="card-copy"><b>${htmlText(d.name)}</b><small>${htmlText(d.diff)} · ${d.time}분 · ${money(d.price)}</small><div class="tagline">${d.tags.slice(0,3).map(t=>`<span>#${htmlText(t)}</span>`).join('')}</div></div>`;a.onclick=()=>openSheet(d);$('#libraryGrid').appendChild(a)});$('#libraryEmpty').classList.toggle('hidden',data.length>0)}
async function syncCloudArtLibrary(){
 if(!window.LudiaSalonCloud?.isConnected?.()||!window.LudiaSalonCloud?.loadArtDesigns)return;
 const identity=activeSalonId,sequence=++artLoadSequence;
 try{
  const cloud=await window.LudiaSalonCloud.loadArtDesigns();
  if(sequence!==artLoadSequence||identity!==activeSalonId||salonCloudMode!=='cloud')return;
  state.library=cloud;renderLibrary();renderRecent();renderMonthlyMenu();renderBooking();
 }catch(error){console.warn('[LUDIA art library]',error);toast('샵 아트 목록을 불러오지 못했어요. 다시 시도해 주세요')}
}
let designRegisterFile=null,designRegisterObjectUrl=null,designRegisterMonthlyMode=false;
function closeDesignRegister(){
 const sheet=$('#designRegisterSheet');if(!sheet)return;sheet.classList.remove('open');sheet.setAttribute('aria-hidden','true');document.body.style.overflow='';monthlyEditingId=null;designRegisterMonthlyMode=false
}
function resetDesignRegister(){
 designRegisterFile=null;if(designRegisterObjectUrl){URL.revokeObjectURL(designRegisterObjectUrl);designRegisterObjectUrl=null}
 ['designNameInput','designPriceInput','designSalePriceInput','designTimeInput','designCategoryInput','designTagsInput','designMaterialsInput','designTechInput'].forEach(id=>{const el=$('#'+id);if(el)el.value=''});
 if($('#designMonthInput'))$('#designMonthInput').value=currentMonthKey(monthlyMenuOffset);
 if($('#designDifficultyInput'))$('#designDifficultyInput').value='보통';if($('#designStatusInput'))$('#designStatusInput').value='draft';
 $('#designDetailFields')?.classList.add('hidden');$('#designDetailToggle')?.classList.remove('open');$('#monthlyDesignFields')?.classList.add('hidden');
 const img=$('#designPhotoPreview'),empty=$('#designPhotoEmpty');if(img){img.removeAttribute('src');img.classList.remove('visible')}if(empty)empty.classList.remove('hidden');
 if($('#designRegisterKicker'))$('#designRegisterKicker').textContent='MY SALON LIBRARY';if($('#designRegisterTitle'))$('#designRegisterTitle').textContent='디자인 등록';if($('#designRegisterDesc'))$('#designRegisterDesc').textContent='사진·이름·가격·시간을 등록하고 보관함에서 관리합니다.'
}
function openDesignRegister({monthly=false,design=null}={}){
 resetDesignRegister();monthlyEditingId=design?.id||null;designRegisterMonthlyMode=monthly;
 if(monthly){
   $('#monthlyDesignFields')?.classList.remove('hidden');if($('#designStatusInput'))$('#designStatusInput').value='monthly';
   if($('#designRegisterKicker'))$('#designRegisterKicker').textContent='MONTHLY ART MENU';if($('#designRegisterTitle'))$('#designRegisterTitle').textContent=design?'이달의 아트 수정':'이달의 아트 메뉴 추가';if($('#designRegisterDesc'))$('#designRegisterDesc').textContent='대표 사진 · 디자인명 · 정가 · 할인가 · 노출 월을 관리합니다.'
 }
 if(design){
   if($('#designNameInput'))$('#designNameInput').value=design.name||'';if($('#designPriceInput'))$('#designPriceInput').value=Number(design.listPrice??design.price)||0;if($('#designSalePriceInput'))$('#designSalePriceInput').value=Number(design.salePrice)||'';if($('#designMonthInput'))$('#designMonthInput').value=design.monthKey||currentMonthKey(monthlyMenuOffset);if($('#designTimeInput'))$('#designTimeInput').value=Number(design.time)||90;
   if($('#designCategoryInput'))$('#designCategoryInput').value=design.category||'';if($('#designTagsInput'))$('#designTagsInput').value=(design.tags||[]).join(', ');if($('#designMaterialsInput'))$('#designMaterialsInput').value=(design.materials||[]).join(', ');if($('#designTechInput'))$('#designTechInput').value=design.tech||'';if($('#designDifficultyInput'))$('#designDifficultyInput').value=design.diff||'보통';if($('#designStatusInput'))$('#designStatusInput').value=monthly?'monthly':(design.projectStatus||'draft');
   const img=$('#designPhotoPreview'),empty=$('#designPhotoEmpty');if(img&&design.img){img.src=design.img;img.classList.add('visible')}if(empty&&design.img)empty.classList.add('hidden')
 }
 const sheet=$('#designRegisterSheet');if(!sheet)return;sheet.classList.add('open');sheet.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';setTimeout(()=>$('#designNameInput')?.focus(),180)
}
function readAsDataURL(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}
$('#openDesignRegisterBtn')?.addEventListener('click',()=>openDesignRegister());
$('#addMonthlyArtBtn')?.addEventListener('click',()=>openDesignRegister({monthly:true}));
$('#monthlyMenuEmptyAdd')?.addEventListener('click',()=>openDesignRegister({monthly:true}));
$$('[data-close-design-register]').forEach(x=>x.addEventListener('click',closeDesignRegister));
$('#designDetailToggle')?.addEventListener('click',()=>{$('#designDetailFields')?.classList.toggle('hidden');$('#designDetailToggle')?.classList.toggle('open')});
$('#designPhotoInput')?.addEventListener('change',e=>{
 const file=e.target.files?.[0];if(!file)return;if(!/^image\/(jpeg|png|webp|avif)$/i.test(file.type||'')){e.target.value='';return toast('JPG · PNG · WEBP · AVIF 사진을 선택해 주세요')}if(file.size>6*1024*1024){e.target.value='';return toast('사진은 6MB 이하로 등록해 주세요')}
 designRegisterFile=file;if(designRegisterObjectUrl)URL.revokeObjectURL(designRegisterObjectUrl);designRegisterObjectUrl=URL.createObjectURL(file);
 const img=$('#designPhotoPreview');if(img){img.src=designRegisterObjectUrl;img.classList.add('visible')}$('#designPhotoEmpty')?.classList.add('hidden')
});
$('#saveRegisteredDesignBtn')?.addEventListener('click',async()=>{
 if(salonCloudMode!=='demo'&&!window.LudiaSalonCloud?.isConnected?.())return toast('클라우드 연결 후 다시 저장해 주세요');
 const name=$('#designNameInput')?.value.trim();if(!name)return toast('디자인 이름을 입력해 주세요');
 const existing=monthlyEditingId?state.library.find(x=>String(x.id)===String(monthlyEditingId)):null;
 if(!designRegisterFile&&!existing?.img)return toast('대표 사진을 추가해 주세요');
 const listPrice=Number($('#designPriceInput')?.value)||0,salePrice=Number($('#designSalePriceInput')?.value)||0,time=Number($('#designTimeInput')?.value)||0;
 const monthKey=$('#designMonthInput')?.value||'',category=$('#designCategoryInput')?.value.trim()||'',tags=($('#designTagsInput')?.value||'').split(',').map(x=>x.trim()).filter(Boolean);
 if(category&&!tags.includes(category))tags.unshift(category);
 const materials=($('#designMaterialsInput')?.value||'').split(',').map(x=>x.trim()).filter(Boolean),difficulty=$('#designDifficultyInput')?.value||'보통',status=designRegisterMonthlyMode?'monthly':($('#designStatusInput')?.value||'draft'),tech=$('#designTechInput')?.value.trim()||'';
 if(listPrice<0||salePrice<0||salePrice>listPrice||time<5||time>720)return toast('가격과 시술시간(5~720분)을 확인해 주세요');
 const monthly=status==='monthly';if(monthly&&!monthKey)return toast('노출 월을 선택해 주세요');
 const btn=$('#saveRegisteredDesignBtn');if(btn){btn.disabled=true;btn.textContent='저장 중…'}
 try{
  let saved;
  const payload={id:monthlyEditingId,name,photoFile:designRegisterFile,listPrice,price:listPrice,salePrice:monthly?salePrice:0,monthKey:monthly?monthKey:'',time,tags,category,materials,difficulty,tech,status};
  if(window.LudiaSalonCloud?.isConnected?.()){
    if(monthlyEditingId&&window.LudiaSalonCloud?.updateArtDesign)saved=await window.LudiaSalonCloud.updateArtDesign(payload);
    else if(window.LudiaSalonCloud?.saveArtDesign)saved=await window.LudiaSalonCloud.saveArtDesign(payload);
  }else{
    const imgData=designRegisterFile?await readAsDataURL(designRegisterFile):(existing?.img||null);
    saved={...(existing||{}),id:existing?.id||'local-art-'+Date.now(),name,img:imgData,listPrice,salePrice:monthly?salePrice:0,monthKey:monthly?monthKey:'',price:(monthly&&salePrice)||listPrice,time,tags,status:monthly?'이달의아트':status==='favorite'?'즐겨찾기':'후보',projectStatus:status,diff:difficulty,materials,tech,category,desc:existing?.desc||'',savedAt:new Date().toISOString(),cloudArt:false}
  }
  if(!saved)throw new Error('design save returned empty');
  state.library=[saved,...state.library.filter(x=>String(x.id)!==String(saved.id))];renderLibrary();renderRecent();renderMonthlyMenu();renderBooking();schedulePersist();closeDesignRegister();toast(monthly?'이달의 아트 메뉴를 저장했어요':(window.LudiaSalonCloud?.isConnected?.()?'현재 샵 보관함에 저장했어요':'이 기기에 디자인을 저장했어요'))
 }catch(error){console.error('[LUDIA design register]',error);toast('디자인 저장에 실패했어요')}
 finally{if(btn){btn.disabled=false;btn.textContent='디자인 저장'}}
});
['전체','즐겨찾기','베스트','이달의아트','실시술완료','자석','시럽','웨딩'].forEach((f,i)=>{const b=document.createElement('button');b.textContent=f;b.classList.toggle('active',i===0);b.onclick=()=>{state.filter=f;$$('#libraryFilters button').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderLibrary()};$('#libraryFilters').appendChild(b)});$('#librarySearch').oninput=renderLibrary;

async function removeMonthlyArt(design){
 if(!design)return;
 const payload={id:design.id,name:design.name,photoFile:null,listPrice:Number(design.listPrice??design.price)||0,salePrice:0,monthKey:'',time:Number(design.time)||0,tags:design.tags||[],category:design.category||'',materials:design.materials||[],difficulty:design.diff||'보통',tech:design.tech||'',description:design.desc||'',status:'draft'};
 try{
   let saved;
   if(design.cloudArt&&window.LudiaSalonCloud?.isConnected?.()&&window.LudiaSalonCloud?.updateArtDesign)saved=await window.LudiaSalonCloud.updateArtDesign(payload);
   else saved={...design,status:'후보',projectStatus:'draft',monthKey:'',salePrice:0,price:Number(design.listPrice??design.price)||0};
   state.library=[saved,...state.library.filter(x=>String(x.id)!==String(design.id))];renderMonthlyMenu();renderLibrary();renderBooking();schedulePersist();toast('이달의 아트 메뉴에서 내렸어요')
 }catch(error){console.error('[LUDIA monthly remove]',error);toast('메뉴 변경에 실패했어요')}
}
function renderMonthlyMenu(){
 const grid=$('#monthlyMenuGrid'),empty=$('#monthlyMenuEmpty');if(!grid)return;
 const key=currentMonthKey(monthlyMenuOffset),items=monthlyMenuItems(key);if($('#monthlyMenuLabel'))$('#monthlyMenuLabel').textContent=monthKeyLabel(key);if($('#monthlyMenuCount'))$('#monthlyMenuCount').textContent=items.length+'개 메뉴';
 grid.innerHTML='';empty?.classList.toggle('hidden',items.length>0);
 items.forEach(d=>{
   const card=document.createElement('article');card.className='monthly-menu-card';
   const list=Number(d.listPrice??d.price)||0,sale=Number(d.salePrice)||0;
   card.innerHTML='<div class="monthly-menu-photo"><img src="'+htmlText(d.img||'assets/nail_5.jpg')+'" alt="'+htmlText(d.name)+'"></div><div class="monthly-menu-copy"><span>이달의 아트</span><b>'+htmlText(d.name)+'</b><div class="monthly-menu-price">'+(sale?'<s>'+money(list)+'</s><strong>'+money(sale)+'</strong>':'<strong>'+money(list)+'</strong>')+'</div><small>'+(d.time?d.time+'분 · ':'')+monthKeyLabel(key)+'</small><div class="monthly-menu-actions"><button type="button" data-edit>수정</button><button type="button" data-remove>메뉴에서 내리기</button></div></div>';
   card.querySelector('[data-edit]').onclick=()=>openDesignRegister({monthly:true,design:d});card.querySelector('[data-remove]').onclick=()=>removeMonthlyArt(d);grid.appendChild(card)
 });
 if($('#qbService')?.value==='이달의 아트')renderQuickMonthlyArts()
}
$('#monthlyMenuPrev')?.addEventListener('click',()=>{monthlyMenuOffset--;renderMonthlyMenu()});
$('#monthlyMenuNext')?.addEventListener('click',()=>{monthlyMenuOffset++;renderMonthlyMenu()});

function renderPicker(){renderMonthlyMenu()}
function renderCollectionPreview(){renderMonthlyMenu()}
function renderSettings(){$('#dnaList').replaceChildren(...DNA.map(d=>{const r=document.createElement('div');r.className='dna-row';r.innerHTML=`<div class="dna-info"><b>${htmlText(d.name)}</b><small>${d.desc}</small></div><span class="dna-score">${d.score}%</span>`;return r}));$('#inventoryList').replaceChildren(...inventory.map(x=>{const r=document.createElement('div');r.className='inventory-row';r.innerHTML=`<div class="inventory-info"><b>${x.name}</b><small>${x.state} · ${x.qty}</small></div><span class="stock-dot ${x.state==='부족'?'low':x.state==='품절'?'out':''}"></span>`;return r}))}
function hydrateFromState(){if($('#homePrompt'))$('#homePrompt').value=state.draft.homePrompt||'';if($('#conceptInput'))$('#conceptInput').value=state.draft.concept||'';if($('#maxTime'))$('#maxTime').value=String(state.draft.maxTime||'90');if($('#targetPrice'))$('#targetPrice').value=String(state.draft.targetPrice||'69000');if($('#stockFirst'))$('#stockFirst').checked=state.draft.stockFirst!==false;if(state.draft.refDataUrl){$('#refPreviewImg').src=state.draft.refDataUrl;$('#refEmpty').classList.add('hidden');$('#refPreview').classList.remove('hidden')}else{$('#refPreview').classList.add('hidden');$('#refEmpty').classList.remove('hidden')}}
function renderAll(){renderDNAChips();renderConditions();renderNails();renderLibrary();renderRecent();renderPicker();renderCollectionPreview();renderSettings();updateBrief();updateStorageStats();renderDirectStudioPreview()}
function installCoreNavigation(){
 document.addEventListener('click',event=>{
   const closeOps=event.target.closest('[data-close-ops]');if(closeOps){event.preventDefault();event.stopPropagation();closeOpsDetail();return}
   const closeQuick=event.target.closest('[data-close-quick-booking]');if(closeQuick){event.preventDefault();event.stopPropagation();closeQuickBooking();return}
   const closeRegister=event.target.closest('[data-close-design-register]');if(closeRegister){event.preventDefault();event.stopPropagation();closeDesignRegister();return}
   const closeFinal=event.target.closest('[data-close-final]');if(closeFinal){event.preventDefault();event.stopPropagation();closeFinalView();return}
   const closeEditor=event.target.closest('[data-close-sheet]');if(closeEditor){event.preventDefault();event.stopPropagation();closeSheet();return}
   const nav=event.target.closest('[data-nav]');if(nav){event.preventDefault();setView(nav.dataset.nav);return}
   const action=event.target.closest('[data-ludia-action]');if(!action)return;window.dispatchEvent(new CustomEvent('ludia:open-'+action.dataset.ludiaAction))
 });
 document.addEventListener('keydown',event=>{
   if(event.key!=='Escape')return;
   if($('#opsDetailSheet')?.classList.contains('open'))return closeOpsDetail();
   if($('#quickBookingSheet')?.classList.contains('open'))return closeQuickBooking();
   if($('#designRegisterSheet')?.classList.contains('open'))return closeDesignRegister();
   if($('#finalViewSheet')?.classList.contains('open'))return closeFinalView();
   if($('#editSheet')?.classList.contains('open'))return closeSheet();
 });
}
installCoreNavigation();
$('#saveStatus').onclick=()=>{setView('more');toast('저장 상태 · 설정/백업은 더보기에서 관리합니다')};
$('#exportBackupBtn').onclick=exportBackup;$('#importBackupBtn').onclick=()=>$('#backupFile').click();$('#backupFile').onchange=e=>{const f=e.target.files[0];if(f)importBackupFile(f);e.target.value=''};$('#persistStorageBtn').onclick=requestPersistentStorage;


$$('[data-close-ops]').forEach(x=>x.onclick=closeOpsDetail);
$('#opsStatusBtn').onclick=async()=>{if(!activeAppointment||activeAppointment.status==='완료')return;const next=activeAppointment.status==='대기'?'진행중':'완료';const btn=$('#opsStatusBtn');btn.disabled=true;try{if(salonCloudMode==='cloud'&&activeAppointment.cloudId&&window.LudiaSalonCloud?.isConnected()){await window.LudiaSalonCloud.updateAppointmentStatus(activeAppointment.cloudId,next);toast(next==='진행중'?'시술을 시작했어요':'시술 완료로 변경했어요')}else{activeAppointment.status=next;await persistNow();toast(next==='진행중'?'시술을 시작했어요':'시술 완료로 변경했어요');renderOpsToday();renderBooking()}closeOpsDetail()}catch(error){console.error(error);toast('상태 변경에 실패했어요')}finally{btn.disabled=false}};
$('#opsCustomerBtn').onclick=()=>{if(!activeAppointment)return;closeOpsDetail();setView('customers');const input=$('#customerSearch');input.value=activeAppointment.customer;renderCustomers()};
$('#customerSearch').oninput=()=>{customerPage=1;renderCustomers()};
$('#customerRefreshBtn')?.addEventListener('click',async()=>{
 const btn=$('#customerRefreshBtn');if(btn){btn.disabled=true;btn.textContent='↻ 동기화 중'}
 try{
   customerPage=1;if(salonCloudMode!=='demo'&&!window.LudiaSalonCloud?.isConnected?.())throw new Error('cloud disconnected');
   if(window.LudiaSalonCloud?.isConnected?.()&&window.LudiaSalonCloud?.refresh){await window.LudiaSalonCloud.refresh();toast('고객 목록을 최신 상태로 불러왔어요')}
   else{renderCustomers();toast('고객 목록을 새로 표시했어요')}
 }catch(error){console.error('[LUDIA customer refresh]',error);toast('고객 목록 새로고침에 실패했어요')}
 finally{if(btn){btn.disabled=false;btn.textContent='↻ 새로고침'}}
});
$('#quickAddBooking').onclick=()=>openQuickBooking('13:00',bookingStaff==='전체'?(salonStaffNames[0]||'루디아'):bookingStaff);
const homeQuickAdd=$('#homeQuickAdd');if(homeQuickAdd)homeQuickAdd.onclick=()=>{bookingDayOffset=0;renderBooking();openQuickBooking('13:00',salonStaffNames[0]||'루디아')};
$('#newCustomerBtn').onclick=()=>toast('고객 등록은 이름·연락처만 먼저 받고 나머지는 시술 후 채우는 방식으로 연결할게요');
$('#bookingTodayBtn').onclick=()=>{bookingDayOffset=0;renderBooking()};
$('#bookingPrevWeek')?.addEventListener('click',()=>{bookingDayOffset-=7;renderBooking()});
$('#bookingNextWeek')?.addEventListener('click',()=>{bookingDayOffset+=7;renderBooking()});$$('[data-close-quick-booking]').forEach(x=>x.onclick=closeQuickBooking);$('#qbSaveBtn').onclick=saveQuickBooking;
$$('.more-card:not([data-nav])').forEach(b=>b.onclick=()=>toast(`${b.querySelector('b').textContent} · 필요한 핵심 화면만 단계적으로 연결합니다`));

setInterval(()=>{if(state.view==='create'){const s=Math.floor((Date.now()-state.start)/1000),m=Math.floor(s/60);$('#createTimer').textContent=`${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;$('#createTimer').parentElement.classList.toggle('warn',s>300)}},1000);
(async function boot(){try{const mode=await loadPersisted();hydrateFromState();renderAll();renderOpsToday();renderBooking();renderCustomers();syncProfilePhoto();setView('opsHome');setSaveStatus('saved',mode==='new'?'자동저장 준비':'자동저장됨');if(mode==='restored'||mode==='migrated')toast(mode==='migrated'?'기존 보관함을 새 저장방식으로 옮겼어요':'이전 작업을 복원했어요');if(mode==='new')schedulePersist();initSalonCloud().catch(error=>console.error('[LUDIA cloud init]',error))}catch(error){console.error('[LUDIA boot recovery]',error);renderOpsToday();renderBooking();renderCustomers();setView('opsHome');setSaveStatus('error','일부 기능 복구 모드')}})();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{}));

/* v2.37 · Nail Canvas Pro — commit-on-save editor */
(()=>{
 const canvas=document.getElementById('nailDrawCanvas'),tip=document.getElementById('nailBigTip'),partsLayer=document.getElementById('nailPartsLayer'),root=document.getElementById('nailCanvasPro');
 if(!canvas||!tip||!partsLayer||!root)return;
 const ctx=canvas.getContext('2d');let currentFinger=null,drawing=false,last=null,brush='pen',brushSize=9,ink='#d998a6',working=null,undo=[],redo=[];
 const colors=[['#fffaf8','밀키 화이트','all'],['#f7e9e6','베이비 핑크','nude'],['#f3d7d9','밀키 핑크','nude'],['#e9a9b4','로즈 시럽','syrup'],['#d98f9c','뮤트 로즈','syrup'],['#c96f82','베리 시럽','syrup'],['#ead7cb','피치 누드','nude'],['#dcc4b8','베이지 누드','nude'],['#cbaaa1','모카 누드','nude'],['#b7786f','로지 브라운','all'],['#9b283c','와인','all'],['#721a2b','딥 체리','all'],['#3b2428','에스프레소','all'],['#d9d2c9','그레이지','all'],['#b9a8b9','라일락','all'],['#9eafd1','페리윙클','all'],['#768aa2','블루그레이','all'],['#8fae9a','세이지','all'],['#d8c989','버터','all'],['#c9b7dc','오로라','glitter'],['#e5c3d4','핑크 펄','glitter'],['#d9c7a4','샴페인','glitter'],['#b9b9bf','실버 글리터','glitter'],['#b7bec9','실버 자석','magnet'],['#d4a6b9','핑크 자석','magnet'],['#8d6b75','모브 자석','magnet'],['#7b8190','스틸 자석','magnet'],['#ae8c72','브론즈 자석','magnet'],['#584c65','플럼 자석','magnet'],['#101014','블랙','all'],['#cf222e','클래식 레드','all'],['#ef6a9a','핫핑크','all'],['#6650a4','바이올렛','all'],['#3288bd','코발트','all'],['#1f9d72','에메랄드','all'],['#ff8b3d','코랄','all']];
 let fav=JSON.parse(localStorage.getItem('ludiaNailFavColors')||'["#f3d7d9","#e9a9b4","#ead7cb","#d4a6b9"]'),customParts=JSON.parse(localStorage.getItem('ludiaNailParts')||'[]');
 const baseParts=[['✦','크리스탈','stone'],['◆','다이아','stone'],['◇','오팔','stone'],['✧','미니 스톤','stone'],['●','화이트 진주','pearl'],['◉','핑크 진주','pearl'],['♡','하트 메탈','metal'],['☆','스타 메탈','metal'],['☾','문 메탈','metal'],['♢','프레임','metal'],['🎀','리본','ribbon'],['୨୧','미니 리본','ribbon'],['✿','플라워','flower'],['❀','데이지','flower']];
 const clone=x=>JSON.parse(JSON.stringify(x));
 let liveSyncTimer=null;
 const stateShot=()=>({base:working.base,accent:working.accent,parts:clone(working.parts),drawing:canvas.toDataURL('image/png')});
 const updateBtns=()=>{document.getElementById('nailUndoBtn').disabled=!undo.length;document.getElementById('nailRedoBtn').disabled=!redo.length};
 const push=()=>{if(!working)return;undo.push(stateShot());if(undo.length>40)undo.shift();redo=[];updateBtns()};
 let drawRevision=0,canvasLoading=false;
 function drawData(data,done=()=>{}){const revision=++drawRevision;canvasLoading=Boolean(data);ctx.clearRect(0,0,canvas.width,canvas.height);if(!data){done();return}const im=new Image();im.onload=()=>{if(revision!==drawRevision)return;ctx.drawImage(im,0,0,canvas.width,canvas.height);canvasLoading=false;done()};im.onerror=()=>{if(revision===drawRevision){canvasLoading=false;done()}};im.src=data}
 function liveRender({hand=false,persist=false}={}){
   if(!working||!state.active||canvasLoading)return;
   const drawing=canvas.toDataURL('image/png'),targets=selectedFingerNames();
   targets.forEach(f=>{const look=state.active.fingerLooks[f];look.base=working.base;look.accent=working.accent;look.canvas={drawing,parts:clone(working.parts)}});
   recalcDesign(state.active);renderArtLiveStage();renderDirectStudioPreview();if($('#finalViewSheet')?.classList.contains('open'))render3DStage();if(hand)renderHandEditor();if(persist)schedulePersist()
 }
 function queueLiveRender(){clearTimeout(liveSyncTimer);liveSyncTimer=setTimeout(()=>liveRender(),90)}
 function restore(s){if(!s)return;working.base=s.base;working.accent=s.accent;working.parts=clone(s.parts||[]);tip.style.setProperty('--pro-nail-base',working.base);drawData(s.drawing,()=>liveRender({hand:true,persist:true}));renderPlacedParts();updateBtns()}
 function openFinger(f,{preserveSelection=false,scroll=true}={}){if(!state.active)return;ensureFingerLooks(state.active);currentFinger=f;if(!preserveSelection)state.fingers=new Set([f]);const look=state.active.fingerLooks[f];working={base:look.base||'#f3d7d9',accent:look.accent||look.base||'#f3d7d9',parts:clone(look.canvas?.parts||[])};undo=[];redo=[];tip.style.setProperty('--pro-nail-base',working.base);drawData(look.canvas?.drawing||null);renderPlacedParts();root.classList.add('ready');const targets=selectedFingerNames(),title=document.getElementById('nailCanvasTitle');if(title)title.textContent=(targets.length>1?targets.length+'개 손가락 동시 편집 · ':f.replace('L','왼손 ').replace('R','오른손 ')+' · ')+'LIVE';if(scroll)root.scrollIntoView({behavior:'smooth',block:'start'});updateBtns()}
 function reset(){clearTimeout(liveSyncTimer);drawRevision++;canvasLoading=false;working=null;currentFinger=null;drawing=false;undo=[];redo=[];ctx.clearRect(0,0,canvas.width,canvas.height);partsLayer.replaceChildren();root.classList.remove('ready');updateBtns()}
 function updateSelectionLabel(){const title=document.getElementById('nailCanvasTitle');if(title&&currentFinger)title.textContent=(selectedFingerNames().length>1?selectedFingerNames().length+'개 손가락 동시 편집':currentFinger.replace('L','왼손 ').replace('R','오른손 '))+' · LIVE'}
 function applyCurrentToSelection(){if(!working||!state.active)return;liveRender({hand:true})}
 function getCurrentFinger(){return currentFinger}
 window.LudiaNailCanvas={openFinger,applyCurrentToSelection,getCurrentFinger,reset,updateSelectionLabel};
 function applyColor(hex){if(!working)return toast('위의 10손가락 중 하나를 눌러주세요');push();working.base=hex;working.accent=hex;ink=hex;tip.style.setProperty('--pro-nail-base',hex);liveRender({hand:true,persist:true})}
 function renderColors(group='favorite'){const box=document.getElementById('nailProColors');box.innerHTML='';colors.filter(x=>group==='favorite'?fav.includes(x[0]):group==='all'||x[2]===group).forEach(x=>{const b=document.createElement('button');b.className='nail-pro-swatch';b.innerHTML='<i style="background:'+x[0]+'"></i><small>'+x[1]+'</small>';let t,long=false;b.onpointerdown=()=>{long=false;t=setTimeout(()=>{long=true;fav.includes(x[0])?fav=fav.filter(v=>v!==x[0]):fav.push(x[0]);localStorage.setItem('ludiaNailFavColors',JSON.stringify(fav));renderColors(group)},520)};b.onpointerup=()=>{clearTimeout(t);if(!long)applyColor(x[0])};b.onpointerleave=()=>clearTimeout(t);box.appendChild(b)})}
 function renderPlacedParts(){partsLayer.innerHTML='';if(!working)return;working.parts.forEach((p,i)=>{const el=document.createElement('button');el.className='placed-nail-part';el.style.left=p.x+'%';el.style.top=p.y+'%';el.style.transform='translate(-50%,-50%) rotate('+p.r+'deg) scale('+p.s+')';el.innerHTML=p.data?'<img src="'+p.data+'" alt="">':'<span>'+p.icon+'</span>';let sx,sy,ox,oy,moved=false,saved=false;el.onpointerdown=e=>{e.preventDefault();push();saved=true;sx=e.clientX;sy=e.clientY;ox=p.x;oy=p.y;el.setPointerCapture(e.pointerId)};el.onpointermove=e=>{if(!el.hasPointerCapture(e.pointerId))return;const r=partsLayer.getBoundingClientRect();p.x=Math.max(7,Math.min(93,ox+(e.clientX-sx)/r.width*100));p.y=Math.max(7,Math.min(93,oy+(e.clientY-sy)/r.height*100));moved=true;el.style.left=p.x+'%';el.style.top=p.y+'%';queueLiveRender()};el.onpointerup=e=>{if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);if(!moved){p.r=(p.r+30)%360;p.s=p.s>=1.55?.75:p.s+.15}renderPlacedParts();liveRender({hand:true,persist:true})};el.ondblclick=()=>{if(!saved)push();working.parts.splice(i,1);renderPlacedParts();liveRender({hand:true,persist:true})};partsLayer.appendChild(el)})}
 function addPart(x){if(!working)return toast('위의 10손가락 중 하나를 눌러주세요');push();working.parts.push({icon:x.icon||'',data:x.data||'',name:x.name,x:50,y:48,r:0,s:1});renderPlacedParts();liveRender({hand:true,persist:true})}
 function renderParts(group='favorite'){const box=document.getElementById('nailProParts');box.innerHTML='';let list=group==='mine'?customParts.map(x=>({...x,mine:true})):baseParts.filter(x=>group==='favorite'?['stone','pearl','ribbon'].includes(x[2]):x[2]===group).map(x=>({icon:x[0],name:x[1],group:x[2]}));list.forEach(x=>{const b=document.createElement('button');b.className='nail-pro-part';b.innerHTML=x.mine?'<img src="'+x.data+'" alt=""><small>'+x.name+'</small><em>MY</em>':'<span>'+x.icon+'</span><small>'+x.name+'</small>';b.onclick=()=>addPart(x);box.appendChild(b)})}
 function pos(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}}
 canvas.onpointerdown=e=>{if(canvasLoading)return;if(!working)return toast('위의 10손가락 중 하나를 눌러주세요');push();drawing=true;last=pos(e);canvas.setPointerCapture(e.pointerId);if(brush==='dot'){ctx.fillStyle=ink;ctx.beginPath();ctx.arc(last.x,last.y,brushSize*.9,0,Math.PI*2);ctx.fill();queueLiveRender()}};
 canvas.onpointermove=e=>{if(!drawing)return;const p=pos(e);ctx.strokeStyle=ink;ctx.fillStyle=ink;ctx.lineWidth=brushSize;ctx.lineCap='round';ctx.lineJoin='round';if(brush==='dot'){ctx.beginPath();ctx.arc(p.x,p.y,brushSize*.9,0,Math.PI*2);ctx.fill()}else{ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.globalAlpha=brush==='air'?.18:1;ctx.stroke();ctx.globalAlpha=1}last=p;queueLiveRender()};
 canvas.onpointerup=canvas.onpointercancel=()=>{if(drawing)liveRender({hand:true,persist:true});drawing=false;last=null};
 document.getElementById('nailBrushSize').oninput=e=>brushSize=+e.target.value;
 document.getElementById('nailClearDrawing').onclick=()=>{if(!working)return;push();ctx.clearRect(0,0,canvas.width,canvas.height);liveRender({hand:true,persist:true})};
 document.querySelectorAll('[data-brush]').forEach(b=>b.onclick=()=>{brush=b.dataset.brush;document.querySelectorAll('[data-brush]').forEach(x=>x.classList.toggle('active',x===b))});
 document.querySelectorAll('[data-nail-tool]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-nail-tool]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('[data-nail-panel]').forEach(x=>x.classList.toggle('active',x.dataset.nailPanel===b.dataset.nailTool))});
 document.querySelectorAll('[data-color-group]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-color-group]').forEach(x=>x.classList.toggle('active',x===b));renderColors(b.dataset.colorGroup)});
 document.querySelectorAll('[data-parts-group]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-parts-group]').forEach(x=>x.classList.toggle('active',x===b));renderParts(b.dataset.partsGroup)});
 document.getElementById('nailPartUpload').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const data=await optimizeImageFile(file,700,.9);customParts.push({name:file.name.replace(/\.[^.]+$/,'').slice(0,24)||'내 파츠',data,mine:true});customParts=customParts.slice(-50);localStorage.setItem('ludiaNailParts',JSON.stringify(customParts));document.querySelector('[data-parts-group="mine"]')?.click();toast('내 파츠 등록 완료')}catch{toast('파츠 사진을 확인해 주세요')}};
 document.getElementById('nailUndoBtn').onclick=()=>{if(!undo.length)return;redo.push(stateShot());restore(undo.pop())};
 document.getElementById('nailRedoBtn').onclick=()=>{if(!redo.length)return;undo.push(stateShot());restore(redo.pop())};
 document.getElementById('nailCanvasSave').onclick=()=>{if(!working||!currentFinger)return toast('먼저 손톱을 선택해 주세요');liveRender({hand:true,persist:true});const targets=selectedFingerNames();toast((targets.length>1?targets.length+'개 손가락':'선택 손가락')+' 디자인 저장 완료');setTimeout(()=>document.getElementById('handEditor')?.scrollIntoView({behavior:'smooth',block:'center'}),100)};
 renderColors();renderParts();
})();

