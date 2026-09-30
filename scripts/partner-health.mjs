#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {loadPlatformRegistry} from './lib/partner-config-io.mjs';
import {factoryRoutes} from './lib/factory-context.mjs';
import {checkCommercialDestination} from './lib/commercial-destination-check.mjs';
import {buildCommercialOutbound} from '../src/lib/commercial/attribution.ts';
import {commercialCsv} from './lib/commercial-csv.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const decode=s=>s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
export function inspectPartnerHtml(html,expected){
 const csp=[...html.matchAll(/<[a-z][^>]*\sdata-compare-solar-cta-root(?:\s|=|>)/gi)];
 const generic=[...html.matchAll(/\sdata-partner-v2="([^"]+)"/g)].map(m=>JSON.parse(decode(m[1])));
 const visible=decode(html.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ');
 const count=csp.length+generic.length,actual=csp.length?'compare-solar-prices':generic[0]?.selected?.partner?.id??null,errors=[];
 if(count>1)errors.push('DUPLICATE_PAID_SLOT');
 if(actual!==(expected?.partner_id??null))errors.push('WRONG_PARTNER');
 if(csp.length&&actual==='compare-solar-prices'&&!/Paid referral disclosure:/.test(html))errors.push('MISSING_DISCLOSURE');
 if(generic[0]){
  const value=generic[0].selected,contract=expected?.selected;
  if(value.context.intent!==contract?.context.intent)errors.push('WRONG_INTENT');
  if(value.context.city!==contract?.context.city||value.context.state!==contract?.context.state)errors.push('WRONG_TERRITORY');
  if(value.destination!==contract?.destination)errors.push('WRONG_DESTINATION');
  if(value.disclosure!==contract?.disclosure||!visible.includes(value.disclosure))errors.push('MISSING_DISCLOSURE');
  if(JSON.stringify(value.route.tracking)!==JSON.stringify(contract?.route.tracking))errors.push('BROKEN_TRACKING');
 }
 if(actual&&!expected?.selected)errors.push('UNVERIFIED_RENDER');
 return {actual_partner:actual??'NONE',paid_slots:count,errors};
}
export async function auditPartners({root=ROOT,out,live=false,probeDestinations=false,fetchImpl=globalThis.fetch,now=new Date().toISOString()}={}){
 const registry=await loadPlatformRegistry(root),routes=await factoryRoutes(root,registry,now),rows=[],destinations=[];
 for(const route of routes){
  let html='',status=200,error=null;
  try{
   if(live){const response=await fetchImpl('https://mygridpermit.com'+route.page_path,{redirect:'manual',signal:AbortSignal.timeout(10000),headers:{'User-Agent':'GridPermit-ReadOnly-Factory-Audit/1.0'}});status=response.status;html=await response.text();}
   else html=await readFile(path.join(root,'dist',route.page_path,'index.html'),'utf8');
   const contract=inspectPartnerHtml(html,route.selected);if(status!==200)contract.errors.push('HTTP_STATUS');
   if(route.selected)buildCommercialOutbound(route.selected.selected,'a'.repeat(24)); // Offline URL shape only.
   rows.push({page:route.page_path,intent:route.context.intent,city:route.context.city,utility:route.context.utility?.value??'UNKNOWN',expected_partner:route.selected?.partner_id??'NONE',...contract,errors:contract.errors.join(';'),status});
  }catch(e){error=e.message;rows.push({page:route.page_path,errors:'CONTRACT_EXCEPTION:'+error,status});}
  if(live)await new Promise(resolve=>setTimeout(resolve,80));
 }
 for(const p of registry.partners.filter(p=>p.status==='ACTIVE')){
  const tracked=p.tracking.network_tracking_url||p.tracking.cj_tracking_url;
  const urls=[...new Set([p.destination,p.paths.solar,p.paths.battery,p.fallback_destination].filter(Boolean))];
  for(const url of urls){
   // Affiliate tracking endpoints can count HEADs. Never manufacture traffic.
   const u=new URL(url);const canProbe=!tracked&&u.search==='';
   const observed=probeDestinations&&canProbe?await checkCommercialDestination(url,{expectedHosts:p.expected_hosts,fetchImpl}):registry.health.find(h=>h.url===url);
   destinations.push({partner:p.partner_id,url,observed:observed??null,probe:probeDestinations&&canProbe?'UNTRACKED_HEAD':'CACHED_EVIDENCE_TRACKED_ENDPOINT_NOT_PROBED'});
  }
 }
 const stale=registry.partners.filter(p=>p.status==='ACTIVE'&&(!p.program||Date.parse(p.program.reverify_after)<=Date.parse(now))).map(p=>p.partner_id);
 const health={generated_at:new Date().toISOString(),mode:live?'LIVE_READ_ONLY':'LOCAL_BUILD',pages:rows.length,paid_pages:rows.filter(r=>r.paid_slots===1).length,failures:rows.filter(r=>r.errors),stale_programs:stale,destinations,destination_failures:destinations.filter(d=>!d.observed?.ok),attribution_probe:'OFFLINE_ONLY_NO_TEST_CID_SENT',monitor_schedule_created:false};
 health.ok=!health.failures.length&&!stale.length&&!health.destination_failures.length;
 if(out){await mkdir(out,{recursive:true});await writeFile(path.join(out,'PARTNER_HEALTH.json'),JSON.stringify(health,null,2)+'\n');await writeFile(path.join(out,'LIVE_ROUTE_CRAWL.csv'),commercialCsv(rows));}
 return health;
}
async function main(){const a=process.argv.slice(2),input={};for(let i=0;i<a.length;i++){if(['--live','--probe-destinations'].includes(a[i]))input[a[i]]=true;else if(['--root','--out'].includes(a[i])&&a[i+1])input[a[i]]=a[++i];else throw new Error('Invalid option');}if(!input['--out'])throw new Error('--out required');const result=await auditPartners({root:input['--root'],out:input['--out'],live:input['--live'],probeDestinations:input['--probe-destinations']});console.log(JSON.stringify({ok:result.ok,pages:result.pages,paid_pages:result.paid_pages,failures:result.failures.length}));if(!result.ok)process.exitCode=2;}
const isDirectRun=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);if(isDirectRun)main().catch(e=>{console.error(e.message);process.exitCode=1;});
