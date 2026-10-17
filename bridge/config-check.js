import fs from 'node:fs/promises';
import path from 'node:path';
import {validateConfig} from './config.js';
if(Number(process.versions.node.split('.')[0])<20)process.exitCode=2;
else try{validateConfig(JSON.parse(await fs.readFile(path.resolve(process.env.LUDIA_BRIDGE_CONFIG||'./config.local.json'),'utf8')));}catch{process.exitCode=1;}
