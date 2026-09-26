import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
async function walk(path){let out=[];for(const e of await readdir(path,{withFileTypes:true})){if(['node_modules','dist','data','.wrangler'].includes(e.name))continue;const p=join(path,e.name);if(e.isDirectory())out.push(...await walk(p));else if(/\.(m?js)$/.test(p))out.push(p);}return out;}
const files=await walk('.');for(const f of files){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status){console.error(r.stderr);process.exit(1);}}console.log(`${files.length} módulos JavaScript: sintaxis válida.`);
