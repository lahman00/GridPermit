#!/usr/bin/env node
import path from 'node:path';import {fileURLToPath} from 'node:url';
import {loadPlatformRegistry} from './lib/partner-config-io.mjs';import {factoryRoutes} from './lib/factory-context.mjs';
export async function routeDebug(url,root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')){
 const u=new URL(url,'https://mygridpermit.com');if(u.origin!=='https://mygridpermit.com'||u.search||u.hash)throw new Error('Exact canonical GridPermit URL required');
 const registry=await loadPlatformRegistry(root),route=(await factoryRoutes(root,registry)).find(r=>r.page_path===u.pathname);if(!route)throw new Error('Unknown built page');
 return {mode:'LOCAL_ONLY',url:u.href,intent:route.context.intent,city:route.context.city,utility:route.context.utility?.value??null,eligible:route.candidates.filter(c=>!c.reasons.length).map(c=>c.partner_id),blocked:route.candidates.filter(c=>c.reasons.length).map(c=>({partner:c.partner_id,reasons:c.reasons})),selected:route.selected?.partner_id??null,reason:route.reason,tracking:route.selected?.selected?.route.tracking??null};
}
const isDirectRun=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);if(isDirectRun)routeDebug(process.argv[2]).then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
