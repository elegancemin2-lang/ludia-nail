/* Photo recognition proposes items. This calculator alone assigns shop prices. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.LudiaPricingCore=api})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const BASE=['oneColor','gradation','magnetic','fullDesign'];
 const ADDONS=['colorAdd','gradationAdd','thinFrench','dot','lineArt','glitter','foilFilm','smallPoint','ribbonPoint','clearRibbon','stone','pearl','chromePowder','marble','characterArt','extensionRepair','other'];
 const MAX_PRICE=100000000;
 const number=value=>{const n=Number(value);return Number.isFinite(n)?Math.max(0,n):0};
 const round=value=>Math.round(number(value)/1000)*1000;
 function qty(value,max=20){if(typeof value!=='number'||!Number.isInteger(value)||value<0||value>max)throw new Error('invalid_quantity');return value}
 function item(pricing,kind,key){const group=kind==='base'?'base':kind==='addon'?'addons':kind==='change'?'fingerChange':null;return group&&Object.prototype.hasOwnProperty.call(pricing?.[group]||{},key)?pricing[group][key]:null}
 function calculate(lines,pricing,override=0){
  const raw=lines.reduce((sum,line)=>sum+number(line.qty)*number(line.unitPrice),0),regular=number(override)||round(raw),discount=Math.min(50,number(pricing?.eventDiscount)),event=round(regular*(1-discount/100));
  return{rawTotal:raw,regularPrice:regular,eventPrice:event,eventDiscount:discount};
 }
 function estimate(analysis,pricing){
  if(!analysis||!BASE.includes(analysis.baseKey))throw new Error('invalid_base');
  if(!Array.isArray(analysis.addons||[])||(analysis.addons||[]).length>50)throw new Error('invalid_addons');
  const base=item(pricing,'base',analysis.baseKey);if(!base)throw new Error('invalid_pricing');
  const amount=value=>{const n=Number(value);if(!Number.isFinite(n)||n<0||n>MAX_PRICE)throw new Error('invalid_price');return n};
  const lines=[{id:'base',kind:'base',key:analysis.baseKey,label:base.label,qty:1,unitPrice:amount(base.price)}],warnings=[],merged=new Map();
  for(const row of analysis.addons||[]){
   if(!row||!ADDONS.includes(row.key))throw new Error('invalid_addon');
   const addon=item(pricing,'addon',row.key);if(!addon)throw new Error('invalid_pricing');
   const limit=addon.unit==='손가락'?10:addon.unit==='세트'?1:20,count=qty(row.qty,limit);
   const total=(merged.get(row.key)||0)+count;if(total>limit)throw new Error('invalid_quantity');merged.set(row.key,total);
  }
  const simple=qty(analysis.simpleChangeQty||0,10),point=qty(analysis.pointChangeQty||0,10);if(simple+point>10)throw new Error('invalid_change_quantity');
  if(analysis.baseKey==='fullDesign'){
   if([...merged.values()].some(Boolean)||simple||point)warnings.push('전체 디자인 기준가는 세부 추가·변경 금액을 자동으로 중복 합산하지 않습니다.');
  }else{
   for(const [key,count] of merged){if(!count)continue;const addon=item(pricing,'addon',key);lines.push({id:'addon-'+key,kind:'addon',key,label:addon.label,qty:count,unitPrice:amount(addon.price)})}
   for(const [key,count] of [['simple',simple],['point',point]]){if(!count)continue;const change=item(pricing,'change',key);if(!change)throw new Error('invalid_pricing');lines.push({id:'change-'+key,kind:'change',key,label:change.label,qty:count,unitPrice:amount(change.price)})}
  }
  return{lines,...calculate(lines,pricing),warnings,standardId:'ludia-existing-2026-10-09'};
 }
 function fingerprint(pricing){return JSON.stringify([number(pricing?.eventDiscount),...BASE.map(k=>number(item(pricing,'base',k)?.price)),...ADDONS.map(k=>number(item(pricing,'addon',k)?.price)),...['simple','point'].map(k=>number(item(pricing,'change',k)?.price))])}
 function confirmedExample(value){
  if(value?.schema!=='ludia-confirmed-photo/v1'||value.verifiedBy!=='owner'||!/^[a-f0-9]{64}$/.test(value.photoHash||''))throw new Error('invalid_example');
  if(!Array.isArray(value.lines)||!value.lines.length||value.lines.length>40)throw new Error('invalid_example_lines');
  const lines=value.lines.map((line,i)=>{const count=qty(line.qty,50),price=Number(line.unitPrice);if(!count||!Number.isFinite(price)||price<0||price>MAX_PRICE)throw new Error('invalid_example_price');if(!['base','addon','change','custom'].includes(line.kind))throw new Error('invalid_example_kind');if(line.kind==='base'&&!BASE.includes(line.key)||line.kind==='addon'&&!ADDONS.includes(line.key)||line.kind==='change'&&!['simple','point'].includes(line.key))throw new Error('invalid_example_key');return{id:'confirmed-'+i,kind:line.kind,key:line.key,label:String(line.label||'').slice(0,80),qty:count,unitPrice:price}});
  if(lines.filter(x=>x.kind==='base').length!==1||lines.find(x=>x.kind==='base').qty!==1)throw new Error('invalid_example_base');
  const override=Number(value.finalOverride||0);if(!Number.isFinite(override)||override<0||override>MAX_PRICE)throw new Error('invalid_example_override');
  return{schema:value.schema,verifiedBy:'owner',photoHash:value.photoHash,verifiedAt:String(value.verifiedAt||'').slice(0,40),scope:String(value.scope||'').slice(0,80),lines,finalOverride:override,pricingFingerprint:String(value.pricingFingerprint||'').slice(0,1500),features:Array.isArray(value.features)&&value.features.length===11&&value.features.every(Number.isFinite)?value.features.slice():[],photoDataUrl:/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value.photoDataUrl||'')&&value.photoDataUrl.length<=2500000?value.photoDataUrl:null};
 }
 function replay(example,pricing){
  const sample=confirmedExample(example),changed=sample.pricingFingerprint!==fingerprint(pricing);
  const lines=sample.lines.map(line=>{const current=item(pricing,line.kind,line.key);return{...line,unitPrice:changed&&current?number(current.price):line.unitPrice}});
  return{lines,finalOverride:changed?0:sample.finalOverride,pricingChanged:changed,...calculate(lines,pricing,changed?0:sample.finalOverride)};
 }
 return Object.freeze({BASE,ADDONS,round,calculate,estimate,fingerprint,confirmedExample,replay});
});
