# Despliegue de GUARDIA

## Estado

App local y recorridos funcionales verificados. Despliegue público pendiente. El build de Vite y el runtime de Webflow Cloud no están verificados en este entorno.

## Ruta A — Repositorio GitHub + MCP o panel Webflow

1. Creá un repositorio y subí el contenido de la carpeta `guardia`, con `package.json` y `webflow.json` en la raíz. No subas el ZIP como único archivo, ni `data/`, credenciales o `.env`.
2. Autorizá el acceso de Webflow a ese repositorio.
3. En Webflow Cloud, creá una app desde ese repositorio y elegí la rama que contiene el código. Para adjuntarla a Worlder, usá un mount libre como `/guardia`, nunca `/`.
4. El MCP puede crear la app con `create_app` y desplegar con `trigger_deployment`. Se necesita la URL real del repositorio y la rama; no se admiten rutas locales ni archivos ZIP como `source_url`.
5. Revisá el estado de despliegue y los logs. Webflow debe aprovisionar el binding `DB` y aplicar `migrations/0001_initial.sql`.
6. Abrí la URL pública y verificá `/api/health` bajo el mount, creación de sala, ingreso desde otro navegador y una partida completa. No consideres completado el despliegue solo porque la app aparece en la lista.

No es obligatorio conectar GitHub a ChatGPT para que Webflow despliegue un repositorio existente. Esa conexión adicional permite subir o modificar el código desde la conversación; la autorización de Webflow para leer el repositorio es independiente.

## Ruta B — CLI de Webflow, sin GitHub

Con la CLI oficial de Webflow instalada, ejecutá desde esta carpeta:

```sh
webflow auth login
webflow cloud deploy
```

Completá la autorización en tu navegador y seleccioná el destino cuando la CLI lo solicite. No compartas tokens ni archivos `.env` en el chat. La conexión OAuth del MCP no autentica automáticamente la CLI de otra máquina.

## Configuración incluida

`webflow.json` declara Vite. `wrangler.json` declara el worker, assets y SQLite/D1. El `database_id` de ejemplo `1234` sigue la documentación de Webflow: la plataforma genera el identificador en el despliegue; no es una base de producción existente.

La ruta local Node no requiere Vite. Para validar el frontend compilado fuera de este entorno:

```sh
npm install
npm run build
```

Revisá y conservá el lockfile generado. Después de instalar, revisá las dependencias y las advertencias del gestor de paquetes. Nunca publiques el servidor de desarrollo de Vite como backend de producción.

## Origen permitido

La API rechaza solicitudes de otros sitios con «Origen no autorizado». Si la app montada en Webflow Cloud (por ejemplo, `https://tu-sitio.com/guardia`) recibe ese error al crear una sala, definí la variable de entorno `ALLOWED_ORIGINS=https://tu-sitio.com` en la configuración de la app. Acepta varios orígenes separados por comas.

## Documentación oficial

- https://developers.webflow.com/webflow-cloud/bring-your-own-app
- https://developers.webflow.com/webflow-cloud/deployments
- https://developers.webflow.com/webflow-cloud/add-sqlite
- https://developers.webflow.com/webflow-cloud/environment/framework-customization
