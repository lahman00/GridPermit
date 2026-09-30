import routes from '../generated/outbound-routes.json' with {type:'json'};
import {getStore} from '@netlify/blobs';
import {cleanupOutbound} from '../../src/lib/commercial/outbound-service.mjs';
export default async()=>{
 const store=getStore({name:'gridpermit-outbound-v1',consistency:'strong'});
 const result=await cleanupOutbound(store);
 const checks=[];
 for(const url of new Set(routes.map(r=>r.health_probe_url).filter(Boolean))){
  const u=new URL(url);if(u.search)continue;
  try{const res=await fetch(url,{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(4000)});checks.push({url,status:res.status,ok:res.status===200});}catch{checks.push({url,status:null,ok:false});}
 }
 await store.setJSON('control/destinations',{checked_at:new Date().toISOString(),ok:checks.every(x=>x.ok),checks});
 return Response.json(result);
};
export const config={schedule:'17 * * * *'};
