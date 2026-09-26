import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Readable} from 'node:stream';
import {openDatabase} from './src/server/sqlite-node.mjs';
import {Store} from './src/server/store.mjs';
import {handleApi,apiPath,SECURITY_HEADERS} from './src/server/api.mjs';
const ROOT=fileURLToPath(new URL('.',import.meta.url));
const db=openDatabase(process.env.DATABASE_PATH||resolve(ROOT,'data/guardia.sqlite')),store=new Store(db);
const port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url||'/',`http://${req.headers.host||`localhost:${port}`}`);
  for(const[k,v]of Object.entries(SECURITY_HEADERS))res.setHeader(k,v);
  if(apiPath(url.href)){
   const request=new Request(url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Readable.toWeb(req),duplex:'half'});
   const response=await handleApi(request,store,{ip:req.socket.remoteAddress||'local'});
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end('Method not allowed');return;}
  const p=decodeURIComponent(url.pathname);let file;
  if(p==='/'||p==='/index.html')file=resolve(ROOT,'index.html');
  else if(p==='/src/main.js')file=resolve(ROOT,'src/main.js');
  else if(p.startsWith('/src/client/')){file=resolve(ROOT,'.'+p);if(!file.startsWith(resolve(ROOT,'src/client')+sep)||!['.js','.css'].includes(extname(file))){res.writeHead(403);res.end();return;}}
  else if(['/favicon.svg','/robots.txt'].includes(p))file=resolve(ROOT,'public'+p);
  else{res.writeHead(404);res.end('Not found');return;}
  if(!file.startsWith(ROOT)||file.includes(`${sep}server${sep}`)){res.writeHead(403);res.end();return;}
  const data=await readFile(file);res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');res.writeHead(200);res.end(req.method==='HEAD'?undefined:data);
 }catch(e){if(!res.headersSent)res.writeHead(e?.code==='ENOENT'?404:400);res.end('Request unavailable');}
});
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(port,host,()=>console.log(`GUARDIA · http://${host}:${server.address().port} · SQLite persistente`));
for(const signal of['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{db.close();process.exit(0);}));
