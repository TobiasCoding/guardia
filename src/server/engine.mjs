import {getScenario,SERVICES,EDGES,publicActions} from './catalog.mjs';
export class GameError extends Error{constructor(message,status=400){super(message);this.status=status;}}
export function event(r,kind,text,actor=null,now=r.lastTick,extra={}){r.events.push({id:r.events.length+1,kind,text,actor,at:now,elapsed:Math.round(r.elapsed),...extra});}
export function makeRoom({code,scenarioId,host,now,reportId,mode='solo',listed=false}){
 if(!getScenario(scenarioId))throw new GameError('El escenario no existe.');
 const r={code,scenarioId,mode,listed,version:0,status:'lobby',createdAt:now,expiresAt:now+7*86400000,reportId,players:[host],hostId:host.id,startedAt:null,lastTick:now,elapsed:0,budget:100,damage:0,mistakes:0,evidence:[],executed:[],flags:{},events:[],samples:[],messages:[],processed:[],score:0,finishedAt:null};
 event(r,'system','Sala creada. El equipo puede sumarse antes de comenzar.',null,now);if(mode==='solo')start(r,host.id,now);return r;
}
export function start(r,id,now){
 if(id!==r.hostId)throw new GameError('Solo quien creó la sala puede iniciar.',403);
 if(r.status!=='lobby')throw new GameError('La guardia ya comenzó.',409);
 if(now-r.createdAt>1800000)throw new GameError('La sala de espera venció. Creá una nueva.',410);
 r.status='running';r.startedAt=now;r.lastTick=now;event(r,'incident','Alerta SEV-1: checkout degradado. Se inicia la guardia.',null,now);sample(r);
}
export function health(r){
 const s=getScenario(r.scenarioId);if(r.status==='lobby')return{error:0.2,latency:120,requests:1240,healthy:true};
 return{error:r.flags.fixed?0.2:Math.min(85,(r.flags.partial?s.initialError*.32:s.initialError)+r.damage*1.1),latency:r.flags.fixed?145:Math.round((r.flags.partial?s.initialLatency*.42:s.initialLatency)+r.damage*55),requests:1240,healthy:!!r.flags.fixed};
}
export function sample(r){const h=health(r),p={t:Math.round(r.elapsed),error:h.error,latency:h.latency,budget:Math.round(r.budget*10)/10};if(r.samples.at(-1)?.t===p.t)r.samples[r.samples.length-1]=p;else r.samples.push(p);if(r.samples.length>180)r.samples.shift();}
function finish(r,status,now,message){
 r.status=status;r.finishedAt=now;const s=getScenario(r.scenarioId);
 // Remaining time and preserved budget only reward a verified recovery; otherwise conceding at once scored ~550.
 const ok=status==='resolved';
 r.breakdown={time:ok?Math.round(Math.max(0,1-r.elapsed/s.duration)*250):0,budget:ok?Math.round(r.budget*3):0,diagnosis:Math.min(200,r.evidence.length*50),communication:r.flags.communicated?100:0,recovery:status==='resolved'?150:0,penalty:r.mistakes*50};
 const b=r.breakdown;r.score=Math.max(0,Math.min(1000,b.time+b.budget+b.diagnosis+b.communication+b.recovery-b.penalty));event(r,status==='resolved'?'success':'failure',message,null,now);sample(r);
}
export function tick(r,now,extraSeconds=0){
 if(r.status!=='running')return;
 const delta=Math.max(0,(now-r.lastTick)/1000)+extraSeconds,duration=getScenario(r.scenarioId).duration,elapsed=Math.min(delta,duration-r.elapsed);
 r.budget=Math.max(0,r.budget-elapsed*(health(r).error/100)*.55);r.elapsed+=elapsed;r.lastTick=Math.max(r.lastTick,now);
 if(!r.samples.length||r.elapsed-r.samples.at(-1).t>=4||extraSeconds>0)sample(r);
 if(r.budget<=0||r.elapsed>=duration)finish(r,'failed',now,r.budget<=0?'Se agotó el presupuesto de impacto.':'Se agotó el tiempo de la guardia.');
}
export function applyAction(r,playerId,actionId,requestId,now){
 if(r.processed.some(p=>p.id===requestId&&p.playerId===playerId))return;
 tick(r,now);if(r.status!=='running')throw new GameError('La guardia no está activa.',409);
 if(r.processed.length>=120)throw new GameError('Se alcanzó el límite de acciones.',429);
 const a=getScenario(r.scenarioId).actions.find(a=>a.id===actionId);if(!a)throw new GameError('Acción desconocida.');
 if(r.flags.fixed&&a.category==='mitigate')throw new GameError('El sistema se recuperó. Verificá antes de hacer más cambios.',409);
 const p=r.players.find(p=>p.id===playerId);if(!p)throw new GameError('La sesión no pertenece a esta sala.',403);
 if(r.executed.includes(actionId)&&a.category!=='verify')throw new GameError('Esa acción ya se aplicó.',409);
 r.processed.push({id:requestId,playerId});tick(r,now,a.seconds);if(r.status!=='running')return;
 event(r,'action',a.title,p.name,now,{actionId,risk:a.risk,cost:a.seconds});
 if(a.category==='investigate'){
  r.evidence.push({id:a.id,service:a.service,title:a.title,lines:a.lines,finding:a.finding,by:p.name,elapsed:Math.round(r.elapsed)});event(r,'evidence',a.finding,p.name,now);
 }else if(actionId==='communicate'){
  r.flags.communicated=true;event(r,'message','Estado compartido: detectamos una degradación y estamos investigando. Habrá una actualización al recuperar el servicio.',p.name,now);
 }else if(actionId==='verify'){
  if(r.flags.fixed)finish(r,'resolved',now,'Pruebas sintéticas OK. El checkout está recuperado. Incidente cerrado.');
  else event(r,'warning','Las pruebas siguen fallando. La causa o sus efectos todavía están presentes.',p.name,now);
 }else{
  let fixed=false,partial=false,note='';
  if(r.scenarioId==='viernes'&&['disable-feature','rollback'].includes(actionId)){fixed=true;note=actionId==='disable-feature'?'Función deshabilitada. El pool se libera y el checkout vuelve a responder.':'Rollback sin migraciones aplicado. Se normalizan las conexiones.';}
  else if(r.scenarioId==='cascada'&&actionId==='open-breaker'){partial=true;r.flags.breaker=true;note='Circuito abierto. Frenaron los reintentos; queda una cola por recuperar.';}
  else if(r.scenarioId==='cascada'&&actionId==='drain-queue'){if(r.flags.breaker){fixed=true;note='Cola drenada con idempotencia. Pedidos aceptados con pago pendiente, sin cobros duplicados.';}else note='La cola sigue creciendo. Primero frená la fuente de reintentos.';}
  else if(r.scenarioId==='memoria'&&actionId==='spread-ttl'){partial=true;r.flags.ttl=true;note='TTL distribuido y lecturas agrupadas. Falta recuperar las claves.';}
  else if(r.scenarioId==='memoria'&&actionId==='warm-cache'){if(r.flags.ttl){fixed=true;note='Caché precalentado con carga limitada. Aciertos recuperados y base normalizada.';}else note='El precalentamiento repite la sincronización de expiraciones. Corregí el TTL primero.';}
  else note=({'scale-api':'Más réplicas presionan el mismo pool. Suben los errores.','restart-database':'Se cortaron transacciones y volvió el mismo patrón de consultas.','increase-retries':'Más reintentos amplifican los timeouts y el crecimiento de la cola.','restart-workers':'El reinicio no detuvo los reintentos y se perdió capacidad.','flush-cache':'Las claves útiles desaparecieron. Más lecturas llegan a la base saturada.'})[actionId]||'La acción no resolvió la causa.';
  if(fixed){r.flags.fixed=true;r.flags.partial=false;r.damage=0;event(r,'success',note,p.name,now);}
  else if(partial){r.flags.partial=true;r.damage=Math.max(0,r.damage-4);event(r,'success',note,p.name,now);}
  else{r.damage+=7;r.mistakes++;r.budget=Math.max(0,r.budget-7);event(r,'warning',note,p.name,now);}
  if(!fixed&&!partial&&['drain-queue','warm-cache'].includes(actionId)){sample(r);if(r.budget<=0)finish(r,'failed',now,'Se agotó el presupuesto de impacto.');return;}
 }
 if(a.category!=='verify')r.executed.push(actionId);sample(r);if(r.budget<=0&&r.status==='running')finish(r,'failed',now,'Se agotó el presupuesto de impacto.');
}
export function concede(r,id,now){if(r.hostId!==id)throw new GameError('Solo quien creó la sala puede finalizar.',403);tick(r,now);if(r.status!=='running')throw new GameError('La guardia no está activa.',409);finish(r,'failed',now,'El equipo finalizó la guardia para revisar lo ocurrido.');}
export function serviceHealth(r){const h=health(r);return SERVICES.map(s=>{
 let status='healthy',latency=12,load=24;
 if(r.status!=='lobby'&&!r.flags.fixed){const affected=r.scenarioId==='cascada'?['gateway','api','payments','queue']:r.scenarioId==='memoria'?['gateway','api','cache','database']:['gateway','api','database'];if(affected.includes(s.id)){status=r.flags.partial||s.id==='gateway'?'degraded':'critical';latency=h.latency;load=Math.min(100,80+r.damage);}}
 if(r.scenarioId==='cascada'&&(r.flags.partial||r.flags.fixed)&&s.id==='payments'){status='isolated';latency=0;load=0;}
 return{...s,status,latency,load};});}
export function snapshot(r,id,now){const s=getScenario(r.scenarioId);return{
 code:r.code,scenario:{id:s.id,title:s.title,description:s.description,difficulty:s.difficulty,duration:s.duration,briefing:s.briefing},mode:r.mode,status:r.status,version:r.version,hostId:r.hostId,you:id,serverTime:now,elapsed:r.elapsed,remaining:Math.max(0,s.duration-r.elapsed),budget:Math.round(r.budget*10)/10,health:health(r),services:serviceHealth(r),edges:EDGES,players:r.players.map(({id,name,role})=>({id,name,role})),evidence:r.evidence,executed:r.executed,actions:publicActions(s),events:r.events,samples:r.samples,messages:r.messages,score:r.score,reportId:['resolved','failed'].includes(r.status)?r.reportId:null,communicated:!!r.flags.communicated};}
export function report(r){if(!['resolved','failed'].includes(r.status))throw new GameError('El informe estará disponible al finalizar.',409);const s=getScenario(r.scenarioId);return{id:r.reportId,code:r.code,scenario:s.title,scenarioId:s.id,status:r.status,score:r.score,breakdown:r.breakdown,elapsed:Math.round(r.elapsed),budget:Math.round(r.budget),players:r.players.map(({name,role})=>({name,role})),rootCause:s.rootCause,lesson:s.lesson,prevention:s.prevention,mistakes:r.mistakes,evidenceCount:r.evidence.length,events:r.events,samples:r.samples,finishedAt:r.finishedAt,disclaimer:'Simulación educativa con datos sintéticos. El puntaje no certifica competencias profesionales.'};}
