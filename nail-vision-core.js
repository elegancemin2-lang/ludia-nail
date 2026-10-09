/* Prompt similarity is a reviewable suggestion, not calibrated nail recognition confidence. */
(function(root){'use strict';
 function unit(v){if(!Array.isArray(v)&&!ArrayBuffer.isView(v))throw Error('invalid_embedding');if(v.length!==768||[...v].some(x=>!Number.isFinite(x)))throw Error('invalid_embedding');const n=Math.hypot(...v);if(n<1e-8)throw Error('invalid_embedding');return Array.from(v,x=>x/n)}
 const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
 function rank(embedding,bank){if(bank?.schema!=='ludia-nail-prototypes/v1'||bank.dimensions!==768||!Array.isArray(bank.classes)||bank.classes.length<10)throw Error('invalid_prototypes');const u=unit(embedding);return bank.classes.map(c=>({key:c.key,group:c.group,label:c.label,similarity:dot(u,unit(c.embedding))})).sort((a,b)=>b.similarity-a.similarity)}
 function classify(embedding,bank){const ranked=rank(embedding,bank),gate=ranked.filter(x=>x.group==='gate'),materials=ranked.filter(x=>x.group==='material'),details=ranked.filter(x=>x.group==='detail'),top=materials[0],gap=top.similarity-materials[1].similarity;
  const isNail=gate[0]?.key==='nails'&&gate[0].similarity>0.1&&gate[0].similarity-gate[1].similarity>0.02;
  const uncertain=!isNail||gap<0.012||top.key==='bare';
  const baseMap={oneColor:'oneColor',magnetic:'magnetic',gradation:'gradation',glitterBase:'oneColor',chromeBase:'oneColor',fullDesign:'fullDesign'};
  const plain=details.find(x=>x.key==='plainDetail'),detailCandidates=details.filter(x=>x.key!=='plainDetail'&&x.similarity>0.1&&x.similarity>(plain?.similarity||0)+0.012).slice(0,3);
  // This encoder has no object detector. Never copy a similar photo's part/finger counts.
  return{engine:'siglip2-local-q8',model:bank.model,revision:bank.revision,isNail,uncertain,material:top.key,baseKey:isNail&&!uncertain?baseMap[top.key]||null:null,baseCandidates:materials.slice(0,3),detailCandidates,addons:[],requiresReview:true,quantityState:'not_counted',similarityMeaning:'uncalibrated_cosine',margin:gap,embedding:unit(embedding)}
 }
 function ownerHint(result,examples){const matches=[];for(const e of examples||[]){const v=e?.vision,base=e?.lines?.find(x=>x.kind==='base')?.key;if(e.verifiedBy!=='owner'||v?.model!==result.model||v?.revision!==result.revision||!['oneColor','gradation','magnetic','fullDesign'].includes(base))continue;try{matches.push({baseKey:base,similarity:dot(unit(result.embedding),unit(v.embedding))})}catch{}}matches.sort((a,b)=>b.similarity-a.similarity);const top=matches[0],other=matches.find(x=>x.baseKey!==top?.baseKey);if(!top||top.similarity<0.96||other&&top.similarity-other.similarity<0.04)return null;return{baseKey:top.baseKey,similarity:top.similarity,source:'owner_confirmed_visual_reference'}}
 const api={unit,dot,rank,classify,ownerHint};if(typeof module==='object'&&module.exports)module.exports=api;else root.LudiaNailVisionCore=api;
})(typeof window!=='undefined'?window:globalThis);
