const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),standard=JSON.parse(fs.readFileSync(path.join(root,'data/ludia-price-standard.v1.json'),'utf8'));
const output='/* Generated from data/ludia-price-standard.v1.json; edit the JSON and run npm run build:pricing. */\n(function(root){const value='+JSON.stringify(standard)+';function freeze(v){if(v&&typeof v===\"object\"){Object.values(v).forEach(freeze);Object.freeze(v)}return v}root.LudiaPricingStandard=freeze(value)})(typeof window!==\"undefined\"?window:globalThis);\n';
fs.writeFileSync(path.join(root,'pricing-standard.js'),output);
