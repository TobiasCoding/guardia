// Webflow Cloud / Cloudflare Workers adapter. Gameplay logic is shared with Node.
import {Store} from './server/store.mjs';
import {handleApi,apiPath,SECURITY_HEADERS} from './server/api.mjs';
export default{
 async fetch(request,env){
  if(apiPath(request.url)){
   if(!env.DB)return Response.json({error:'Falta el binding DB y su migración.'},{status:503});
   const db=env.DB.withSession?env.DB.withSession('first-primary'):env.DB;
   return handleApi(request,new Store(db),{ip:request.headers.get('CF-Connecting-IP')||'edge'});
  }
  const response=await env.ASSETS.fetch(request),secured=new Response(response.body,response);
  for(const[k,v]of Object.entries(SECURITY_HEADERS))secured.headers.set(k,v);
  return secured;
 }
};
