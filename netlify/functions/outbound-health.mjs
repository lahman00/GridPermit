import {getStore} from '@netlify/blobs';
export default async()=>{
 try{
  const store=getStore({name:'gridpermit-outbound-v1',consistency:'strong'});
  const control=await store.get('control/retention',{type:'json',consistency:'strong'});
  const destinations=await store.get('control/destinations',{type:'json',consistency:'strong'});
  const ok=control?.ok===true&&Date.now()-Date.parse(control.checked_at)<90*60000;
  return Response.json({ok,storage:'netlify-blobs',retention_healthy:ok,last_cleanup:control?.checked_at??null,destination_check:destinations??null},{status:ok?200:503,headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({ok:false,storage:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
};
export const config={path:'/telemetry/health',rateLimit:{windowLimit:10,windowSize:60,aggregateBy:['ip','domain']}};
