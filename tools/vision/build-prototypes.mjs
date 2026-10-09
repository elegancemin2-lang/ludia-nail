import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {AutoTokenizer,SiglipTextModel,env} from '@huggingface/transformers';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),config=JSON.parse(await fs.readFile(path.join(root,'vision/nail-prompts.json'),'utf8'));
env.cacheDir=path.join(root,'.model-cache');env.backends.onnx.wasm.numThreads=1;
const options={revision:config.revision,dtype:config.dtype},tokenizer=await AutoTokenizer.from_pretrained(config.model,options),model=await SiglipTextModel.from_pretrained(config.model,options);
const unit=v=>{const n=Math.hypot(...v);return v.map(x=>x/n)},classes=[];
for(const c of config.classes){const inputs=tokenizer(c.prompts,{padding:'max_length',max_length:64,truncation:true}),{pooler_output}=await model(inputs),rows=pooler_output.tolist().map(unit),mean=Array.from({length:config.dimensions},(_,i)=>rows.reduce((s,r)=>s+r[i],0)/rows.length);classes.push({...c,embedding:unit(mean).map(x=>+x.toFixed(7))});console.log('Encoded '+c.key)}
await fs.writeFile(path.join(root,'vision/nail-text-embeddings.json'),JSON.stringify({schema:'ludia-nail-prototypes/v1',model:config.model,revision:config.revision,dtype:config.dtype,dimensions:config.dimensions,generatedAt:new Date().toISOString(),trainedForNails:false,classes},null,2)+'\n');await model.dispose();
