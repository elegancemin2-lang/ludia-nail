const json=(res,status,body)=>res.status(status).setHeader('content-type','application/json; charset=utf-8').end(JSON.stringify(body));

const DEFAULT_PRICING={
  eventDiscount:10,
  base:{
    oneColor:{label:'원컬러',price:45000},
    gradation:{label:'그라데이션',price:60000},
    magnetic:{label:'자석젤',price:70000},
    fullDesign:{label:'전체 디자인',price:90000}
  },
  addons:{
    colorAdd:{label:'컬러 추가',price:5000,unit:'개'},
    gradationAdd:{label:'그라데이션 추가',price:10000,unit:'회'},
    dot:{label:'도트',price:3000,unit:'개'},
    clearRibbon:{label:'투명 리본 파츠',price:4000,unit:'개'},
    thinFrench:{label:'씬프렌치',price:10000,unit:'회'},
    ribbonPoint:{label:'리본/스와 포인트',price:5000,unit:'개'},
    smallPoint:{label:'하트/스팽글 소포인트',price:3000,unit:'개'}
  },
  fingerChange:{
    simple:{label:'단순 변경',price:3000},
    point:{label:'포인트 변경',price:5000}
  }
};

function serverConfig(){
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url&&key?{url,key,headers:{apikey:key,authorization:`Bearer ${key}`}}:null;
}
async function readJson(url,headers){
  const r=await fetch(url,{headers});if(!r.ok)throw new Error(`${r.status}: ${await r.text()}`);return r.json();
}
async function resolveSalon(req,cfg){
  const auth=String(req.headers.authorization||'');if(!auth.startsWith('Bearer '))return null;
  const token=auth.slice(7).trim();if(!token)return null;
  const userRes=await fetch(`${cfg.url}/auth/v1/user`,{headers:{apikey:cfg.key,authorization:`Bearer ${token}`}});
  if(!userRes.ok)return null;
  const user=await userRes.json();if(!user?.id)return null;
  const rows=await readJson(`${cfg.url}/rest/v1/ludia_salon_members?user_id=eq.${encodeURIComponent(user.id)}&is_active=eq.true&select=salon_id,role&limit=1`,cfg.headers);
  const member=rows?.[0];return member?.salon_id?{salonId:member.salon_id,userId:user.id,role:member.role||'staff'}:null;
}
function mergePricing(value){
  const v=value||{};
  return {
    ...DEFAULT_PRICING,...v,
    base:{...DEFAULT_PRICING.base,...(v.base||{})},
    addons:{...DEFAULT_PRICING.addons,...(v.addons||{})},
    fingerChange:{...DEFAULT_PRICING.fingerChange,...(v.fingerChange||{})}
  };
}
function outputText(data){
  for(const item of data?.output||[])for(const part of item?.content||[])if(part?.type==='output_text'&&part.text)return part.text;
  return '';
}
function safeQty(value,max=20){return Math.max(0,Math.min(max,Math.round(Number(value)||0)))}
function buildEstimate(analysis,pricing){
  const baseKey=pricing.base[analysis.baseKey]?analysis.baseKey:'fullDesign';
  const base=pricing.base[baseKey];
  const lines=[{id:'base',kind:'base',key:baseKey,label:base.label,qty:1,unitPrice:Number(base.price)||0}];

  for(const row of analysis.addons||[]){
    const item=pricing.addons[row.key],qty=safeQty(row.qty);if(!item||!qty)continue;
    lines.push({id:`addon-${row.key}`,kind:'addon',key:row.key,label:item.label,qty,unitPrice:Number(item.price)||0});
  }
  const simple=safeQty(analysis.simpleChangeQty,10),point=safeQty(analysis.pointChangeQty,10);
  if(simple)lines.push({id:'change-simple',kind:'change',key:'simple',label:pricing.fingerChange.simple.label,qty:simple,unitPrice:Number(pricing.fingerChange.simple.price)||0});
  if(point)lines.push({id:'change-point',kind:'change',key:'point',label:pricing.fingerChange.point.label,qty:point,unitPrice:Number(pricing.fingerChange.point.price)||0});

  const raw=lines.reduce((sum,x)=>sum+x.qty*x.unitPrice,0);
  const regular=Math.max(0,Math.round(raw/1000)*1000);
  const discount=Math.max(0,Math.min(50,Number(pricing.eventDiscount)||0));
  const event=Math.max(0,Math.round((regular*(1-discount/100))/1000)*1000);
  return {lines,rawTotal:raw,regularPrice:regular,eventPrice:event,eventDiscount:discount};
}
export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{ok:false,error:'method_not_allowed'});
  const cfg=serverConfig();
  let access=null;
  if(cfg){try{access=await resolveSalon(req,cfg)}catch(error){console.warn('[LUDIA price optional auth]',error)}}
  if(!process.env.OPENAI_API_KEY)return json(res,503,{ok:false,error:'ai_not_configured'});

  let body=req.body||{};if(typeof body==='string'){try{body=JSON.parse(body)}catch(_){return json(res,400,{ok:false,error:'invalid_json'})}}
  const imageDataUrl=String(body?.imageDataUrl||'');
  if(!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(imageDataUrl))return json(res,400,{ok:false,error:'invalid_image'});
  if(imageDataUrl.length>4_000_000)return json(res,413,{ok:false,error:'image_too_large'});

  try{
    let pricing=mergePricing(DEFAULT_PRICING);
    if(cfg&&access?.salonId){
      const rows=await readJson(`${cfg.url}/rest/v1/ludia_pricing_settings?salon_id=eq.${encodeURIComponent(access.salonId)}&select=config&limit=1`,cfg.headers);
      pricing=mergePricing(rows?.[0]?.config||DEFAULT_PRICING);
    }
    const baseOptions=Object.entries(pricing.base).map(([key,v])=>`${key}=${v.label}`).join(', ');
    const addonOptions=Object.entries(pricing.addons).map(([key,v])=>`${key}=${v.label}`).join(', ');

    const prompt=[
      '너는 네일샵 시술 사진을 가격표 항목으로 분해하는 보조 판독기다.',
      '사진에 실제로 보이는 요소만 판단하고, 확실하지 않은 것은 추정하지 말고 unpricedObservations에 적어라.',
      '가격 자체를 새로 만들지 말고 반드시 제공된 baseKey/addon key 중 가장 가까운 항목만 사용한다.',
      '손가락 변경은 기본 디자인에서 일부 손가락만 다른 경우에만 잡는다. 단순 색/도트 수준은 simple, 리본/파츠/복합 포인트는 point.',
      '양손 전체 사진이면 보이는 전체 손가락을 기준으로 개수를 세고, 한 손만 보이면 과대 추정하지 않는다.',
      `기본 시술 키: ${baseOptions}`,
      `추가 옵션 키: ${addonOptions}`,
      '결과는 원장/직원이 반드시 검수할 초안이므로 짧고 구체적으로 작성한다.'
    ].join('\n');

    const schema={
      type:'object',additionalProperties:false,
      properties:{
        baseKey:{type:'string',enum:['oneColor','gradation','magnetic','fullDesign']},
        addons:{type:'array',items:{type:'object',additionalProperties:false,properties:{key:{type:'string',enum:['colorAdd','gradationAdd','dot','clearRibbon','thinFrench','ribbonPoint','smallPoint']},qty:{type:'integer',minimum:0,maximum:20}},required:['key','qty']}},
        simpleChangeQty:{type:'integer',minimum:0,maximum:10},
        pointChangeQty:{type:'integer',minimum:0,maximum:10},
        unpricedObservations:{type:'array',items:{type:'string'},maxItems:8},
        summary:{type:'string'},
        confidence:{type:'integer',minimum:0,maximum:100}
      },
      required:['baseKey','addons','simpleChangeQty','pointChangeQty','unpricedObservations','summary','confidence']
    };

    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'content-type':'application/json',authorization:`Bearer ${process.env.OPENAI_API_KEY}`},
      body:JSON.stringify({
        model:process.env.OPENAI_PRICE_MODEL||'gpt-5.6-luna',
        reasoning:{effort:'low'},
        input:[{role:'user',content:[
          {type:'input_text',text:prompt},
          {type:'input_image',image_url:imageDataUrl}
        ]}],
        text:{format:{type:'json_schema',name:'nail_price_analysis',strict:true,schema}},
        max_output_tokens:1800
      })
    });
    const raw=await response.json();
    if(!response.ok){console.error('[LUDIA price AI]',raw?.error||raw);return json(res,502,{ok:false,error:'ai_unavailable'})}
    const text=outputText(raw);if(!text)throw new Error('empty AI output');
    const analysis=JSON.parse(text),estimate=buildEstimate(analysis,pricing);
    return json(res,200,{ok:true,analysis,estimate});
  }catch(error){
    console.error('[LUDIA price estimate]',error);return json(res,502,{ok:false,error:'estimate_failed'});
  }
}
