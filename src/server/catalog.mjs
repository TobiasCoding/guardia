/** SERVER ONLY. The client receives action descriptions, not solutions or unopened logs. */
const inspect=(id,title,description,service,lines,finding)=>({id,title,description,service,category:'investigate',risk:'none',seconds:5,lines,finding});
const mitigate=(id,title,description,service,risk='medium',seconds=12)=>({id,title,description,service,category:'mitigate',risk,seconds});
const COMMON=[
 {id:'communicate',title:'Comunicar estado del incidente',description:'Informá que el equipo está investigando. No repara servicios.',category:'communicate',service:'all',risk:'none',seconds:2},
 {id:'verify',title:'Verificar recuperación',description:'Ejecutá pruebas sintéticas. El incidente solo se cierra si los servicios se recuperaron.',category:'verify',service:'all',risk:'none',seconds:5}
];
export const SERVICES=[
 {id:'gateway',name:'Gateway',kind:'Entrada',icon:'route',x:10,y:38},
 {id:'api',name:'Checkout API',kind:'Aplicación',icon:'code',x:37,y:38},
 {id:'cache',name:'Redis',kind:'Caché',icon:'layers',x:65,y:10},
 {id:'database',name:'Postgres',kind:'Base de datos',icon:'database',x:65,y:64},
 {id:'payments',name:'Pagos',kind:'Proveedor',icon:'credit-card',x:91,y:10},
 {id:'queue',name:'Workers',kind:'Cola de tareas',icon:'activity',x:91,y:64}
];
export const EDGES=[['gateway','api'],['api','cache'],['api','database'],['api','payments'],['api','queue']];
export const SCENARIOS={
 viernes:{id:'viernes',title:'El deploy del viernes',difficulty:'Inicial',duration:300,theme:'deploy',initialError:32,initialLatency:2450,
 description:'Una versión nueva. Las compras fallan y el tráfico no espera.',
 briefing:'Son las 18:04. Hace cuatro minutos salió checkout v2.14. Un tercio de las compras falla. Encontrá la causa, mitigá el impacto y verificá la recuperación.',
 rootCause:'La versión v2.14 activó recommendations_v2: una consulta por cada producto (N+1) agotó el pool de conexiones de Postgres. No era falta de réplicas.',
 lesson:'Correlacioná el inicio del incidente con los cambios recientes. Una mitigación reversible puede restablecer el servicio antes de corregir el código.',
 prevention:['Agregar pruebas de carga para la ruta de checkout.','Limitar las consultas por request y observar la saturación del pool.','Activar funciones gradualmente, con apagado reversible.'],
 actions:[
 inspect('inspect-api','Leer logs de Checkout','Buscá patrones en los errores de la aplicación.','api',['18:00:03 INFO  release=v2.14 rollout complete','18:00:04 INFO  recommendations_v2=true','18:01:21 WARN  checkout p95=2450ms','18:01:22 ERROR connection timeout pool=100/100','18:01:23 WARN  /recommendations queries_per_request=87'],'La API espera conexiones. El aumento coincide con v2.14 y una función nueva.'),
 inspect('inspect-database','Inspeccionar Postgres','Revisá conexiones, CPU y consultas lentas.','database',['connections: 100/100 (waiting: 246)','cpu: 42%   storage: 31%   replication_lag: 0s','top query: SELECT * FROM products WHERE id=$1','calls / checkout: 87 (baseline: 3)','query source: recommendations_v2'],'El pool está agotado por consultas repetidas; CPU y disco no son el cuello de botella.'),
 inspect('inspect-cache','Inspeccionar Redis','Separá las señales útiles del ruido.','cache',['redis health: PONG','memory: 43%   hit_ratio: 96.8%','evictions: 0   connected_clients: 48','no configuration changes in the last 24h'],'Redis está saludable. Reiniciarlo no ataca el problema observado.'),
 inspect('inspect-deploy','Comparar último deploy','Consultá los cambios publicados.','api',['checkout v2.13 → v2.14 at 18:00:03','+ RECOMMENDATIONS_V2=true','+ recommendEachItem(cart.items)','database migrations: none','rollback target v2.13: available'],'La función puede apagarse sin tocar datos. También existe un rollback sin migraciones.'),
 mitigate('disable-feature','Apagar recommendations_v2','Deshabilitá la función nueva. Es reversible y no modifica pedidos.','api','low',8),
 mitigate('rollback','Revertir a v2.13','Volvé a la versión anterior, sin las mejoras del último deploy.','api','medium',18),
 mitigate('scale-api','Duplicar réplicas de API','Sumá procesos. También aumenta el número de conexiones.','api','high',20),
 mitigate('restart-database','Reiniciar Postgres','Corta conexiones y transacciones en curso.','database','high',30),...COMMON]},
 cascada:{id:'cascada',title:'Efecto dominó',difficulty:'Intermedio',duration:360,theme:'cascade',initialError:46,initialLatency:3900,
 description:'Una dependencia se degrada. Los reintentos multiplican el problema.',
 briefing:'El proveedor de pagos comenzó a demorar respuestas. Los pedidos se acumulan y los workers repiten tareas. Contené la cascada y recuperá la cola sin duplicar cobros.',
 rootCause:'El proveedor de pagos agotó su tiempo de respuesta. Los reintentos sin backoff multiplicaron el tráfico y saturaron la cola.',
 lesson:'Primero detené la amplificación; después recuperá la capacidad. Drenar una cola mientras sigue creciendo no resuelve el incidente.',
 prevention:['Configurar circuit breaker y backoff con jitter.','Usar claves de idempotencia para los cobros.','Alertar por edad de los mensajes, no solo por longitud de cola.'],
 actions:[
 inspect('inspect-api','Leer logs de Checkout','Seguí la llamada que más tarda.','api',['WARN payment-provider timeout after 3000ms','WARN automatic retry 5/5 backoff=0ms','ERROR checkout upstream unavailable','deploys in last 24h: none'],'El fallo viene de una dependencia y los reintentos no tienen espera.'),
 inspect('inspect-payments','Consultar proveedor de pagos','Revisá latencia y estado del circuito.','payments',['payments-latam p95=3000ms baseline=190ms','circuit_breaker: CLOSED (requests allowed)','retries: 5x   backoff: disabled','fallback: accept pending payment (available)'],'El proveedor está degradado. Abrir el circuito permite aceptar pedidos pendientes sin nuevos cobros.'),
 inspect('inspect-queue','Inspeccionar cola','Medí crecimiento y capacidad de procesamiento.','queue',['pending jobs: 18420   oldest: 192s','ingress: 450/s   processed: 60/s','duplicates prevented by idempotency keys','retry_source: payment-provider'],'La cola crece más rápido de lo que se vacía. Primero hay que frenar los reintentos.'),
 inspect('inspect-database','Inspeccionar Postgres','Comprobá si la base explica la degradación.','database',['connections: 41/100   cpu: 36%','replication lag: 0s','slow queries: none','pending orders awaiting payment confirmation'],'La base funciona. Los pedidos están retenidos por la dependencia externa.'),
 mitigate('open-breaker','Abrir circuit breaker','Pausá llamadas al proveedor y aceptá pedidos con pago pendiente.','payments','low',10),
 mitigate('drain-queue','Drenar cola con idempotencia','Reprocesá pedidos pendientes sin duplicar operaciones.','queue','medium',16),
 mitigate('increase-retries','Aumentar reintentos','Intentá más veces ante cada timeout.','payments','high',18),
 mitigate('restart-workers','Reiniciar workers','Interrumpí el procesamiento y reiniciá los workers.','queue','high',25),...COMMON]},
 memoria:{id:'memoria',title:'Memoria prestada',difficulty:'Avanzado',duration:360,theme:'cache',initialError:38,initialLatency:2800,
 description:'El caché cae, la base se satura y las métricas apuntan a lugares distintos.',
 briefing:'Una promoción disparó las visitas. Redis responde, pero los aciertos colapsaron. La base recibe demasiadas lecturas. Recuperá el caché sin repetir la estampida.',
 rootCause:'Las claves de caché expiraron al mismo tiempo. La estampida de lecturas agotó el pool de la base. Sin distribuir las expiraciones, el problema vuelve.',
 lesson:'Una dependencia que responde PONG puede seguir fallando funcionalmente. Mirá la tasa de aciertos y la forma de las expiraciones.',
 prevention:['Distribuir TTL con jitter y precalentar claves populares.','Unificar lecturas concurrentes por clave (single-flight).','Alertar por cache misses y saturación del pool en conjunto.'],
 actions:[
 inspect('inspect-api','Leer logs de Checkout','Identificá la ruta y las dependencias lentas.','api',['WARN product_catalog cache_miss=93%','WARN database pool wait=2100ms','INFO traffic=3.2x baseline','deploys today: none'],'El tráfico subió, pero la amplificación principal viene de las lecturas sin caché.'),
 inspect('inspect-cache','Inspeccionar Redis','Revisá aciertos, expiraciones y TTL.','cache',['PING: PONG   memory: 22%   evictions: 0','hit_ratio: 7% (baseline: 97%)','expired keys at 18:00:00: 42000','TTL: 3600s fixed; jitter: 0; warmup: disabled'],'Todas las claves expiraron juntas. Distribuir el TTL evita la siguiente estampida.'),
 inspect('inspect-database','Inspeccionar Postgres','Buscá cambios en la carga de lectura.','database',['read QPS: 12000 (baseline: 840)','connections: 100/100   waiting: 312','popular product keys requested repeatedly','writes and replication: healthy'],'La base absorbe las lecturas que antes resolvía Redis.'),
 inspect('inspect-queue','Inspeccionar workers','Revisá la herramienta de precalentamiento.','queue',['cache-warmup worker: idle','rate limit: 200 keys/s','popular_keys dataset: available','configure TTL jitter before warming'],'Hay un precalentamiento limitado disponible. La configuración debe corregirse antes.'),
 mitigate('spread-ttl','Distribuir expiraciones de caché','Configurá TTL con jitter y agrupación de lecturas por clave.','cache','low',10),
 mitigate('warm-cache','Precalentar claves populares','Reconstruí gradualmente el caché con límite de carga.','cache','medium',16),
 mitigate('flush-cache','Vaciar todo Redis','Eliminá todas las claves. Las siguientes lecturas irán a Postgres.','cache','high',20),
 mitigate('scale-api','Duplicar réplicas de API','Sumá procesos sin modificar el patrón de lecturas.','api','high',20),...COMMON]}
};
export const getScenario=id=>typeof id==='string'&&Object.hasOwn(SCENARIOS,id)?SCENARIOS[id]:null;
export const publicScenarios=()=>Object.values(SCENARIOS).map(({id,title,difficulty,duration,description})=>({id,title,difficulty,duration,description}));
export const publicActions=s=>s.actions.map(({id,title,description,service,category,risk,seconds})=>({id,title,description,service,category,risk,seconds}));
