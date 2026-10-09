import {createRequire} from 'node:module';
import '../pricing-core.js';
const require=createRequire(import.meta.url),standard=require('../data/ludia-price-standard.v1.json');
const json=(res,status,body)=>{res.setHeader('cache-control','no-store');return res.status(status).setHeader('content-type','application/json; charset=utf-8').end(JSON.stringify(body))};
export default async function handler(req,res){
 if(req.method!=='POST')return json(res,405,{ok:false,error:'method_not_allowed'});
 let body=req.body||{};if(typeof body==='string'){if(body.length>32000)return json(res,413,{ok:false,error:'request_too_large'});try{body=JSON.parse(body)}catch{return json(res,400,{ok:false,error:'invalid_json'})}}
 if(body?.imageDataUrl)return json(res,422,{ok:false,error:'local_image_analysis_required',message:'사진 판독은 LUDIA 브라우저에서 실행합니다. 이 API는 확인한 항목만 기존 가격표로 계산하며 유료 AI를 호출하지 않습니다.'});
 try{return json(res,200,{ok:true,recognition:'item_calculation_only',standardId:standard.standardId,analysis:body.analysis,estimate:globalThis.LudiaPricingCore.estimate(body.analysis,standard.pricing)})}
 catch(error){return json(res,400,{ok:false,error:error.message||'invalid_analysis'})}
}
