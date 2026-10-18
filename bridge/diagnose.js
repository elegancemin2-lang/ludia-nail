import fs from 'node:fs/promises';
import path from 'node:path';
import {selectorsReady,FIELD_KEYS} from './config.js';
import {checkServer} from './preflight.js';
let cfg={};try{cfg=JSON.parse(await fs.readFile(path.resolve(process.env.LUDIA_BRIDGE_CONFIG||'./config.local.json'),'utf8'));}catch{}
const result={schema:'ludia-naver-setup-diagnostic/v1',bridgeVersion:'0.5.0',checkedAt:new Date().toISOString(),nodeSupported:Number(process.versions.node.split('.')[0])>=22,
  deliveryMode:cfg.deliveryMode||'unconfigured',parserConfigured:selectorsReady(cfg),fieldsConfigured:Object.fromEntries(FIELD_KEYS.map(key=>[key,Boolean(cfg.bookingFields?.[key])])),attachmentsSupported:false};
if(cfg.deliveryMode==='server')try{result.server=await checkServer(cfg);}catch{result.server={ok:false,issues:['invalid_server_config']};}
console.log(JSON.stringify(result,null,2));
