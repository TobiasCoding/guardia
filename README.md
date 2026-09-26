# GUARDIA — Salvá producción

Simulador cooperativo de incidentes para 1–4 personas. Investigá una caída, compartí evidencia, aplicá una mitigación y verificá la recuperación. Los incidentes son ficticios; la API, las sesiones y la persistencia son reales.

## Ejecutar ahora

Requiere Node.js 22.13 o posterior. El modo local no requiere instalar dependencias ni crear cuentas:

```sh
npm start
```

Abrí `http://localhost:3000`. Para ejecutar las pruebas:

```sh
npm test
npm run check
```

La base SQLite se crea automáticamente en `data/guardia.sqlite`. Variables opcionales: `PORT`, `HOST` y `DATABASE_PATH`. El servidor escucha en loopback por defecto. Para una demostración en tu red local podés configurar `HOST=0.0.0.0`; para Internet usá un alojamiento con HTTPS.

## Qué incluye

- Tres incidentes completos: El deploy del viernes, Efecto dominó y Memoria prestada.
- Partidas individuales y salas cooperativas, hasta cuatro participantes.
- Sesiones independientes y sincronización mediante consultas periódicas al servidor.
- Evidencias y notas compartidas, acciones con costos y consecuencias.
- Reloj, estado y puntaje calculados en el backend, no enviados por el navegador.
- Actualizaciones de sala con control de versión para evitar pérdidas por concurrencia.
- Postmortem persistente, reconstrucción temporal y exportación Markdown.
- Ranking voluntario; sin resultados ficticios preinsertados.
- Diseño responsive, foco visible, etiquetas de formularios y reducción de movimiento.

## Qué se verificó

La reconstrucción incluida pasó 41 pruebas automatizadas de motor, API, persistencia y concurrencia. Se recorrieron los tres incidentes desde la interfaz, incluido un equipo con dos sesiones independientes. Los registros están en `test-artifacts/`.

El navegador de pruebas de este entorno bloquea navegación directa a localhost. El arnés usó un adaptador de origen/almacenamiento para renderizar el cliente; las solicitudes llegaron al servidor HTTP y SQLite reales. Esto no valida aislamiento de origen ni CSP en un navegador de producción.

**No está publicada en Webflow Cloud.** El build de Vite, el runtime Cloud/D1 y el despliegue público no se pudieron ejecutar aquí. La configuración de Cloud está incluida para completar y verificar ese paso. No se modificó el sitio Worlder.

## Publicar en Webflow Cloud

Leé `docs/DESPLIEGUE.md`. Se incluyen `webflow.json`, `wrangler.json`, el adaptador `src/worker.ts` y la migración SQL.

El MCP disponible puede crear/desplegar aplicaciones desde un repositorio GitHub autorizado para Webflow. No tiene una acción para subir estos archivos locales. La alternativa sin repositorio es la CLI de Webflow autenticada en la máquina que contiene el proyecto.

## Demostración

Para una primera partida: crear guardia individual → leer logs de Checkout → comparar el deploy → apagar recommendations_v2 → comunicar estado → verificar recuperación → revisar y exportar el postmortem.

No hay ejecución de comandos reales ni acceso a infraestructura de terceros. Los roles orientan la colaboración; solo iniciar, finalizar y borrar la sala están reservados al anfitrión.

## Estructura

- `src/main.js`, `src/client/`: interfaz.
- `src/server/catalog.mjs`: incidentes y evidencias; solo servidor.
- `src/server/engine.mjs`: reglas y evolución de la simulación.
- `src/server/api.mjs`: rutas, validación y sesiones.
- `src/server/store.mjs`: consultas compatibles con SQLite/D1.
- `server.mjs`: servidor HTTP local.
- `src/worker.ts`: adaptador para Webflow Cloud/Workers.
- `migrations/`: esquema de la base de datos.
- `tests/`: pruebas reproducibles.

## Límites

No es un sistema de evaluación profesional ni un ranking resistente a participantes que conocen el código fuente. No se hicieron pruebas de carga a escala. Los informes contienen alias y notas; quien tenga el enlace puede leerlos. Usá datos ficticios. El acceso a salas e informes vence a los siete días; la limpieza física se realiza al crear nuevas salas. No subas archivos `.env`, bases de datos locales ni credenciales al repositorio.
