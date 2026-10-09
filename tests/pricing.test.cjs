const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),scope=vm.createContext({module:{exports:{}}});
vm.runInContext(fs.readFileSync(path.join(root,'pricing-core.js'),'utf8'),scope);const core=scope.module.exports,standard=JSON.parse(fs.readFileSync(path.join(root,'data/ludia-price-standard.v1.json'),'utf8')),pricing=standard.pricing,refs=JSON.parse(fs.readFileSync(path.join(root,'data/nail-reference-features.json'),'utf8')).goldenPricingRefs;
const plain=v=>JSON.parse(JSON.stringify(v));
test('existing source prices and units are preserved exactly, and browser baseline matches the versioned JSON',()=>{
 const original=require('node:child_process').execFileSync('git',['show','086848e:app.js'],{cwd:root,encoding:'utf8'}),a=original.indexOf('const DEFAULT_PRICING='),b=original.indexOf('\nconst DEFAULT_BOOKING_HOURS=',a),source=original.slice(a,b)+'\nglobalThis.value=DEFAULT_PRICING;',c=vm.createContext({});vm.runInContext(source,c);assert.deepEqual(pricing,plain(c.value));
 const browser=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(path.join(root,'pricing-standard.js'),'utf8'),browser);assert.deepEqual(plain(browser.window.LudiaPricingStandard),standard);assert.equal(Object.isFrozen(browser.window.LudiaPricingStandard.pricing.addons),true);
});
test('all six golden itemized prices remain unchanged',()=>{for(const r of refs)assert.equal(core.estimate(r,pricing).regularPrice,r.target,r.id)});
test('full-design flat price does not stack automatic addon or change charges',()=>{const r=core.estimate({baseKey:'fullDesign',addons:[{key:'stone',qty:4}],pointChangeQty:2},pricing);assert.equal(r.regularPrice,90000);assert.equal(r.lines.length,1);assert.equal(r.warnings.length,1)});
test('same addon is merged once; fractional, negative, unbounded and unknown quantities are rejected',()=>{
 const r=core.estimate({baseKey:'magnetic',addons:[{key:'clearRibbon',qty:1},{key:'clearRibbon',qty:1},{key:'gradationAdd',qty:1}]},pricing);assert.equal(r.regularPrice,88000);assert.equal(r.lines.filter(x=>x.key==='clearRibbon').length,1);
 for(const qty of [-1,.5,11,Infinity,'2',true])assert.throws(()=>core.estimate({baseKey:'oneColor',addons:[{key:'dot',qty}]},pricing),/invalid_quantity/);
 assert.throws(()=>core.estimate({baseKey:'oneColor',addons:[{key:'unknown',qty:1}]},pricing),/invalid_addon/);assert.throws(()=>core.estimate({baseKey:'oneColor',addons:[],simpleChangeQty:6,pointChangeQty:6},pricing),/invalid_change_quantity/);
});
function sample(){return{schema:'ludia-confirmed-photo/v1',verifiedBy:'owner',photoHash:'a'.repeat(64),scope:'local',lines:plain(core.estimate(refs[3],pricing).lines),finalOverride:87000,pricingFingerprint:core.fingerprint(pricing),features:Array(11).fill(1),photoDataUrl:'data:image/jpeg;base64,YQ=='}}
test('confirmed photo replay preserves manual final quote and reprices safely after a standard change',()=>{
 const s=sample(),r=core.replay(s,pricing);assert.equal(r.regularPrice,87000);assert.equal(r.pricingChanged,false);
 const changed=structuredClone(pricing);changed.base.magnetic.price=75000;const updated=core.replay(s,changed);assert.equal(updated.regularPrice,93000);assert.equal(updated.finalOverride,0);assert.equal(updated.pricingChanged,true);assert.equal(s.lines[0].unitPrice,70000);
});
test('only explicit owner confirmation and bounded photo records are reusable; no external photo URL is accepted',()=>{
 for(const mutation of [{verifiedBy:'model'},{photoHash:'x'},{lines:[]},{lines:[...sample().lines,sample().lines[0]]},{finalOverride:Infinity}])assert.throws(()=>core.confirmedExample({...sample(),...mutation}));
 assert.equal(core.confirmedExample({...sample(),photoDataUrl:'https://example.invalid/customer.jpg'}).photoDataUrl,null);
});
test('optional real vision embeddings preserve old photo records and reject mismatched, unnormalized or malformed model data',()=>{assert.equal(core.confirmedExample(sample()).vision,undefined);const bank=JSON.parse(fs.readFileSync(path.join(root,'vision/nail-text-embeddings.json'),'utf8')),vision={model:bank.model,revision:bank.revision,embedding:bank.classes[0].embedding};assert.equal(core.confirmedExample({...sample(),vision}).vision.embedding.length,768);for(const patch of [{revision:'old'},{embedding:[1]},{embedding:Array(768).fill(0)},{embedding:Array(768).fill(1)}])assert.throws(()=>core.confirmedExample({...sample(),vision:{...vision,...patch}}),/invalid_example_vision/)});
test('public price API calculates existing items without auth, model keys, photo uploads or network requests',async()=>{
 const old=global.fetch;global.fetch=async()=>{throw new Error('unexpected_network_request')};
 try{const {default:handler}=await import('../api/price-estimate.js');async function invoke(body){const res={code:200,status(n){this.code=n;return this},setHeader(){return this},end(s){this.body=JSON.parse(s)}};await handler({method:'POST',headers:{},body},res);return res}
 const r=await invoke({analysis:refs[3]});assert.equal(r.code,200);assert.equal(r.body.estimate.regularPrice,88000);assert.equal(r.body.recognition,'item_calculation_only');assert.equal((await invoke({imageDataUrl:'data:image/jpeg;base64,YQ=='})).code,422);assert.equal((await invoke({analysis:{baseKey:'not_a_price'}})).code,400);
 }finally{global.fetch=old}
});
