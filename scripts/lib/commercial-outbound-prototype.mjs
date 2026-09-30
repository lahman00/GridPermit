import {newCommercialCid,buildCommercialOutbound} from '../../src/lib/commercial/attribution.ts';
import {selectCommercialRoute} from '../../src/lib/commercial/routing.ts';
// In-memory protocol prototype only. No HTTP endpoint, persistent store or cloud
// dependency. Disabled by default, including when imported by a production build.
export function createOutboundPrototype({enabled=false,catalog,contexts,clock=()=>new Date().toISOString(),retentionDays=30,maxRecords=1000}={}){
  if(!Number.isInteger(retentionDays)||retentionDays<1||retentionDays>30||!Number.isInteger(maxRecords)||maxRecords<1||maxRecords>10000)throw new Error('Unsafe storage limits');
  const grants=new Map(),records=new Map();
  const prune=()=>{const now=Date.parse(clock());for(const[k,v]of records)if(now-Date.parse(v.timestamp)>retentionDays*86400000)records.delete(k);for(const[k,v]of grants)if(now>v.expires)grants.delete(k);};
  function issue({pagePath,routeId,sourceSlot='organic'}){
    if(!enabled)return null;
    prune();
    if(!/^organic$|^fl_src_0[1-6]$/.test(sourceSlot)||grants.size>=maxRecords)return null;
    const context=contexts?.get(pagePath),selected=context&&selectCommercialRoute(context,catalog,{now:clock(),routeId});
    if(!selected)return null;
    const grant=newCommercialCid(),cid=newCommercialCid();
    grants.set(grant,{cid,pagePath,routeId,sourceSlot,expires:Date.parse(clock())+300000});
    return grant;
  }
  function handle({method,origin,grant}){
    if(!enabled)return {status:503,reason:'PROTOTYPE_DISABLED'};
    if(method!=='POST'||origin!=='https://mygridpermit.com')return {status:403,reason:'REQUEST_REJECTED'};
    prune();const g=grants.get(grant);if(!g)return {status:403,reason:'INVALID_GRANT'};
    const context=contexts.get(g.pagePath),selected=selectCommercialRoute(context,catalog,{now:clock(),routeId:g.routeId});
    if(!selected)return {status:503,reason:'ROUTE_CLOSED'};
    if(!records.has(g.cid)&&records.size>=maxRecords)return {status:503,reason:'CAPACITY_LIMIT'};
    const url=buildCommercialOutbound(selected,g.cid);
    if(!records.has(g.cid))records.set(g.cid,{cid:g.cid,timestamp:clock(),page_path:g.pagePath,partner:selected.partner.id,cta_type:selected.route.channel,city:context.city,source_slot:g.sourceSlot});
    return {status:303,location:url,cid:g.cid};
  }
  return {issue,handle,snapshot(){prune();return structuredClone([...records.values()]);}};
}
