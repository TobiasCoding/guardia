import {defineConfig} from 'vite';
export default defineConfig({base:process.env.APP_BASE_PATH||'/',build:{target:'es2022'},server:{proxy:{'/api':'http://127.0.0.1:3000'}}});
