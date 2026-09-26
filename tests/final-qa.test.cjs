const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function appContext(){
 const element={classList:{toggle(){},add(){},remove(){},contains(){return false}},style:{},dataset:{},addEventListener(){},setAttribute(){},querySelector(){return null},value:'',innerHTML:'',textContent:''};
 const context=vm.createContext({console,structuredClone,Date,setTimeout,clearTimeout,window:{},document:{querySelector:()=>element,querySelectorAll:()=>[],documentElement:{dataset:{}},body:element},localStorage:{getItem(){return null},setItem(){}},navigator:{}});
 const code=fs.readFileSync(path.join(root,'app.js'),'utf8');vm.runInContext(code.slice(0,code.indexOf('const homeChipTexts')),context);return context;
}
test('user strings remain text and cannot become markup',()=>{const c=appContext();c.sample='<img src=x onerror="alert(1)"> &';assert.equal(vm.runInContext('htmlText(sample)',c),'&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp;')});
test('local appointment art link survives snapshot restore, including date changes',()=>{const c=appContext();const result=vm.runInContext(`salonAppointments=[{id:123,dayOffset:3,artId:'local-art-1',amount:55000,note:'고객 요청'}];salonCustomers=[{name:'QA',tags:[]}];const saved=snapshot();salonAppointments=[];salonCustomers=[];applySnapshot(saved);JSON.stringify({a:salonAppointments,c:salonCustomers})`,c);const data=JSON.parse(result);assert.equal(data.a[0].artId,'local-art-1');assert.equal(data.a[0].amount,55000);assert.equal(data.a[0].dayOffset,3);assert.equal(data.c[0].name,'QA')});
test('persisted cloud art never enters anonymous local library',()=>{const c=appContext();assert.equal(vm.runInContext(`applySnapshot({data:{library:[{id:'private',cloudArt:true},{id:'local'}]}});JSON.stringify(state.library)`,c),'[{"id":"local"}]')});
test('week arithmetic handles month and year boundaries Monday through Sunday',()=>{const c=appContext();const result=vm.runInContext(`JSON.stringify([new Date(2026,8,30,12),new Date(2026,11,31,12)].map(target=>{const offset=Math.round((target-bookingDateFromOffset(0))/86400000);return bookingWeekOffsets(offset).map(x=>[localDateKey(bookingDateFromOffset(x)),bookingDateFromOffset(x).getDay()])}))`,c);const [month,year]=JSON.parse(result);assert.deepEqual(month.map(x=>x[1]),[1,2,3,4,5,6,0]);assert.equal(month[0][0],'2026-09-28');assert.equal(month[6][0],'2026-10-04');assert.equal(year[0][0],'2026-12-28');assert.equal(year[6][0],'2027-01-03')});
function cloudContext(){
 let failing=false,applyConnected=false,changed=0,reloads=0,authChanged;const ranges=[];
 const rows={ludia_salon_members:[{salon_id:'qa-salon',user_id:'qa-user',display_name:'QA',is_active:true}],ludia_salons:{id:'qa-salon',name:'QA'},ludia_services:[],ludia_customers:[],ludia_customer_memberships:[],ludia_appointments:[]};
 const query=table=>new Proxy({}, {get(_,k){if(k==='then')return(resolve)=>resolve(failing?{error:new Error('offline')}:{data:rows[table]||[],error:null});return(...args)=>{if(table==='ludia_appointments'&&['gte','lt'].includes(k))ranges.push([k,...args]);return query(table)}}});
 const channel={on(){return this},subscribe(){return this}};
 const client={from:query,auth:{onAuthStateChange(cb){authChanged=cb},async getSession(){return{data:{session:{user:{id:'qa-user',email:'qa@example.invalid'}}}}}},channel:()=>channel,removeChannel:async()=>{}};
 const c=vm.createContext({console:{error(){},warn(){}},setTimeout,clearTimeout,window:{location:{reload(){reloads++}},supabase:{createClient:()=>client}},document:{querySelector:()=>null,querySelectorAll:()=>[]},fetch:async()=>({json:async()=>({configured:true,url:'https://example.invalid',anonKey:'test'})})});
 vm.runInContext(fs.readFileSync(path.join(root,'salon-cloud.js'),'utf8'),c);
 const cloud=c.window.LudiaSalonCloud;
 return{cloud,ranges,fail(){failing=true},authChanged:(...args)=>authChanged(...args),reloadCount:()=>reloads,async init(){await cloud.init({getBookingDate:()=>new Date(2026,11,31,12),onSessionChanging(){changed++},applyData(){applyConnected=cloud.isConnected()}})},check(){return{applyConnected,changed}}};
}
test('initial cloud callback sees connected state, and refresh rejects on real failure',async()=>{const c=cloudContext();await c.init();assert.deepEqual(c.check(),{applyConnected:true,changed:1});assert.equal(c.cloud.getState().salonId,'qa-salon');c.fail();await assert.rejects(c.cloud.refresh(),/offline/)});
test('single-element selectors are never used as collections',()=>{
 for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.js'))){const src=fs.readFileSync(path.join(root,file),'utf8');assert.equal(/(?<!\$)\$\([^\n)]*\)\s*(?:\?\.)?\.forEach\s*\(/.test(src),false,file);assert.equal(/querySelector\([^\n)]*\)\s*\.forEach\s*\(/.test(src),false,file)}
});
test('service worker never handles authenticated APIs',()=>{
 const events={},c=vm.createContext({self:{addEventListener:(name,fn)=>events[name]=fn},URL,location:{origin:'https://ludianail.vercel.app'}});vm.runInContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),c);let intercepted=false;events.fetch({request:{method:'GET',url:'https://ludianail.vercel.app/api/naver-status',headers:{has:()=>false}},respondWith(){intercepted=true}});assert.equal(intercepted,false);
});

test('remote week query includes selected year boundary in Korea time',async()=>{const c=cloudContext();await c.init();assert.ok(c.ranges.some(x=>x[0]==='gte'&&x[2]==='2026-12-28T00:00:00+09:00'));assert.ok(c.ranges.some(x=>x[0]==='lt'&&x[2]==='2027-01-04T00:00:00+09:00'))});
test('identity changes clear optional module caches by reloading; token refresh does not',async()=>{
 const c=cloudContext();await c.init();c.authChanged('TOKEN_REFRESHED',{user:{id:'qa-user'}});await new Promise(resolve=>setTimeout(resolve,10));assert.equal(c.reloadCount(),0);
 c.authChanged('SIGNED_IN',{user:{id:'qa-other'}});await new Promise(resolve=>setTimeout(resolve,10));assert.equal(c.reloadCount(),1);assert.equal(c.cloud.getState().salonId,null);
 const s=cloudContext();await s.init();s.authChanged('SIGNED_OUT',null);assert.equal(s.reloadCount(),1);assert.equal(s.cloud.getLastPayload(),null);s.authChanged('SIGNED_OUT',null);assert.equal(s.reloadCount(),1);
});
