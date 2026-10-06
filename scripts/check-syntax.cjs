const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');let count=0,failed=false;
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(['.git','node_modules'].includes(e.name))continue;const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(/\.(?:mjs|cjs|js)$/.test(f)){count++;const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0){failed=true;process.stderr.write(r.stderr||String(r.error))}}}}
walk(root);process.stdout.write(`Checked ${count} JavaScript files; ${failed?'errors found':'all passed'}.\n`);process.exitCode=failed?1:0;
