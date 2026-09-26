import {GameError,makeRoom,start,tick,applyAction,concede,event,snapshot,report} from './engine.mjs';
import {getScenario,publicScenarios} from './catalog.mjs';
export const SECURITY_HEADERS={'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",'X-Frame-Options':'DENY'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...SECURITY_HEADERS,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const randomHex=n=>[...crypto.getRandomValues(new Uint8Array(n))].map(b=>b.toString(16).padStart(2,'0')).join('');
const randomCode=()=>[...crypto.getRandomValues(new Uint8Array(8))].map(b=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b%32]).join('');
export async function digest(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
function text(v,label,min,max){if(typeof v!=='string'||v.trim().length<min||v.trim().length>max)throw new GameError(`${label}: usá entre ${min} y ${max} caracteres.`);return v.trim().normalize('NFC');}
function name(v){const n=text(v,'Nombre',2,24);if(!/^[\p{L}\p{N} _.-]+$/u.test(n))throw new GameError('Usá letras, números, espacios, puntos y guiones.');return n;}
function keys(o,allowed){if(Object.keys(o).some(k=>!allowed.includes(k)))throw new GameError('La solicitud incluye campos no permitidos.');}
async function body(req){
 if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new GameError('Se requiere Content-Type application/json.',415);
 if(Number(req.headers.get('content-length')||0)>4096)throw new GameError('La solicitud es demasiado grande.',413);
 if(!req.body)throw new GameError('Falta el cuerpo de la solicitud.');
 const reader=req.body.getReader(),chunks=[];let size=0;
 while(true){const{done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();throw new GameError('La solicitud es demasiado grande.',413);}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 try{const v=JSON.parse(new TextDecoder().decode(bytes));if(!v||typeof v!=='object'||Array.isArray(v))throw 0;return v;}catch{throw new GameError('El cuerpo debe ser un objeto JSON válido.');}
}
async function authHash(req){const token=req.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];if(!token)throw new GameError('Necesitás entrar a la sala.',401);return digest(token);}
function authorize(r,hash){const p=r.players.find(p=>p.tokenHash===hash);if(!p)throw new GameError('La sesión no pertenece a esta sala.',403);return p;}
export function apiPath(url){const p=new URL(url).pathname,i=p.indexOf('/api/');return i<0?null:p.slice(i);}
export async function handleApi(req,store,{now=Date.now(),ip='local'}={}){
 const path=apiPath(req.url),method=req.method;
 try{
  if(!path)throw new GameError('Ruta no encontrada.',404);
  if(!['GET','POST','DELETE'].includes(method))throw new GameError('Método no permitido.',405);
  const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new GameError('Origen no autorizado.',403);
  const client=await digest(`${new Date(now).toISOString().slice(0,10)}|${ip}`);await store.limit(`read:${client}`,240,60000,now);
  if(method==='GET'&&path==='/api/health')return json({ok:await store.health(),app:'guardia',storage:'sqlite',version:'1.0.0'});
  if(method==='GET'&&path==='/api/scenarios')return json({scenarios:publicScenarios()});
  if(method==='GET'&&path==='/api/leaderboard')return json({entries:await store.leaderboard(now)});
  if(method==='POST'&&path==='/api/rooms'){
   const b=await body(req);keys(b,['name','scenario','mode','listed']);const hostName=name(b.name);
   if(!getScenario(b.scenario))throw new GameError('Elegí un escenario válido.');
   if(!['solo','coop'].includes(b.mode??'solo'))throw new GameError('Modo inválido.');
   if(b.listed!==undefined&&typeof b.listed!=='boolean')throw new GameError('La publicación del resultado debe ser booleana.');
   await store.limit(`create:${client}`,12,3600000,now);await store.cleanup(now);await store.capacity(now);
   const token=randomHex(32),host={id:randomHex(8),name:hostName,role:'Comando',tokenHash:await digest(token)};
   for(let i=0;i<5;i++){const r=makeRoom({code:randomCode(),scenarioId:b.scenario,host,now,reportId:randomHex(16),mode:b.mode??'solo',listed:b.listed??false});if(await store.create(r))return json({token,room:snapshot(r,host.id,now)},201);}
   throw new GameError('No pudimos crear la sala. Reintentá.',503);
  }
  const reportMatch=path.match(/^\/api\/reports\/([a-f0-9]{32})$/);
  if(method==='GET'&&reportMatch){const r=await store.byReport(reportMatch[1],now);if(!r)throw new GameError('Informe no encontrado o vencido.',404);return json(report(r));}
  const match=path.match(/^\/api\/rooms\/([A-Z2-9]{8})(?:\/(join|start|actions|messages|close))?$/);
  if(!match)throw new GameError('Ruta no encontrada.',404);const[,code,op]=match;
  if(method==='POST'&&op==='join'){
   const b=await body(req);keys(b,['name']);const n=name(b.name);await store.limit(`join:${client}`,30,300000,now);
   const token=randomHex(32),player={id:randomHex(8),name:n,role:'',tokenHash:await digest(token)};
   const r=await store.mutate(code,now,r=>{tick(r,now);if(r.mode==='solo')throw new GameError('Esta partida es individual.',403);if(!['lobby','running'].includes(r.status))throw new GameError('La guardia ya finalizó.',409);if(r.players.length>=4)throw new GameError('La sala está completa (4 personas).',409);if(r.players.some(p=>p.name.toLowerCase()===n.toLowerCase()))throw new GameError('Ese nombre ya está en la sala.',409);player.role=['Comando','Observabilidad','Infraestructura','Comunicación'][r.players.length];r.players.push(player);event(r,'system',`${n} se sumó al equipo.`,null,now);});
   return json({token,room:snapshot(r,player.id,now)},201);
  }
  const hash=await authHash(req);
  if(method==='GET'&&!op){let id;const r=await store.mutate(code,now,r=>{id=authorize(r,hash).id;tick(r,now);});return json(snapshot(r,id,now));}
  if(method==='DELETE'&&!op){const r=await store.get(code,now);if(!r)throw new GameError('Sala no encontrada.',404);if(authorize(r,hash).id!==r.hostId)throw new GameError('Solo quien creó la sala puede borrarla.',403);await store.remove(code);return json({deleted:true});}
  if(method!=='POST')throw new GameError('Método no permitido.',405);
  await store.limit(`write:${hash}`,100,60000,now);const b=await body(req);let playerId;
  const r=await store.mutate(code,now,r=>{
   const p=authorize(r,hash);playerId=p.id;
   if(op==='start'){keys(b,[]);start(r,p.id,now);}
   else if(op==='close'){keys(b,[]);concede(r,p.id,now);}
   else if(op==='actions'){keys(b,['actionId','requestId']);const a=text(b.actionId,'Acción',1,48),id=text(b.requestId,'ID',16,64);if(!/^[a-zA-Z0-9-]+$/.test(id))throw new GameError('ID inválido.');applyAction(r,p.id,a,id,now);}
   else if(op==='messages'){keys(b,['text','requestId']);const message=text(b.text,'Mensaje',1,180),id=text(b.requestId,'ID',16,64);if(r.processed.some(x=>x.id===id&&x.playerId===p.id))return;if(r.messages.length>=60)throw new GameError('Se alcanzó el límite de 60 notas.',429);tick(r,now);if(!['running','lobby'].includes(r.status))throw new GameError('La guardia terminó.',409);r.messages.push({id:r.messages.length+1,by:p.name,text:message,at:now});r.processed.push({id,playerId:p.id});event(r,'note',message,p.name,now);}
   else throw new GameError('Ruta no encontrada.',404);
  });return json(snapshot(r,playerId,now));
 }catch(e){if(e instanceof GameError)return json({error:e.message},e.status);console.error('GUARDIA API: unexpected storage/runtime error');return json({error:'El servidor no pudo completar la operación. Reintentá.'},500);}
}
