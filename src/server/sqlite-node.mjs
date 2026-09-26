import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
export function openDatabase(path='data/guardia.sqlite'){
 if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
 const db=new DatabaseSync(path);db.exec('PRAGMA journal_mode=WAL;PRAGMA busy_timeout=5000;PRAGMA foreign_keys=ON;');db.exec(readFileSync(new URL('../../migrations/0001_initial.sql',import.meta.url),'utf8'));
 return{close:()=>db.close(),prepare(sql){const s=db.prepare(sql);function wrap(v=[]){return{bind:(...args)=>wrap(args),async first(){return s.get(...v)??null;},async all(){return{results:s.all(...v)};},async run(){const q=s.run(...v);return{success:true,meta:{changes:Number(q.changes)}};}};}return wrap();}};
}
