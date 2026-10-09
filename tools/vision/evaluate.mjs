import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {AutoProcessor,SiglipVisionModel,RawImage,env} from '@huggingface/transformers';
import '../../nail-vision-core.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),bank=JSON.parse(await fs.readFile(path.join(root,'vision/nail-text-embeddings.json'),'utf8'));
env.cacheDir=path.join(root,'.model-cache');env.backends.onnx.wasm.numThreads=1;
const options={revision:bank.revision,dtype:'q8'},processor=await AutoProcessor.from_pretrained(bank.model,options),model=await SiglipVisionModel.from_pretrained(bank.model,options),results=[];
for(let i=1;i<=5;i++){const file='assets/nail_'+i+'.jpg',inputs=await processor(await RawImage.read(path.join(root,file))),{pooler_output}=await model(inputs),r=globalThis.LudiaNailVisionCore.classify(pooler_output.tolist()[0],bank);results.push({file,isNail:r.isNail,uncertain:r.uncertain,baseKey:r.baseKey,baseCandidates:r.baseCandidates,detailCandidates:r.detailCandidates});console.log(file,JSON.stringify(results.at(-1)))}
await model.dispose();await fs.writeFile(path.join(root,'docs/vision-evaluation.json'),JSON.stringify({model:bank.model,revision:bank.revision,executedAt:new Date().toISOString(),runtime:'Node CPU q8; browser verification documented separately',dataset:'Five existing repository photos; no independently labeled material/count ground truth',accuracyMeasured:false,results},null,2)+'\n');
