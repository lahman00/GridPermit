#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {PARTNER_CATEGORIES,debugPartnerRoutes,routePartnerSlot} from '../src/lib/commercial/partner-platform.ts';
import {loadPlatformRegistry,assertIsolated,atomicConfigWrite,digest} from './lib/partner-config-io.mjs';
import {loadCommercialContexts,validateIntentMap,searchToRevenueMap} from './lib/commercial-data.mjs';
import {parseCommercialCsv,commercialCsv} from './lib/commercial-csv.mjs';
import {partnerConcentration,queryIntentHypothesis,joinSearchPartnerResults,normalizeNetworkReport,reportedLifecycle,reportAdaptersFromPartners} from './lib/partner-measurement.mjs';
import {checkCommercialDestination} from './lib/commercial-destination-check.mjs';
import {isCompareSolarServedLocality} from '../src/lib/compare-solar-prices.ts';
import {hasVerifiedUnambiguousUtility} from '../src/lib/utility-split-guard.ts';
import {getLaunchReadyPartner} from '../src/lib/partners.ts';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function platformReport({root=ROOT,out,now=new Date().toISOString(),gscFile,clicksFile,measurementFile,journey,intent,liveHealth=false,writeHealth=false}={}){
 if(!out)throw new Error('Explicit --out required');
 const registry=await loadPlatformRegistry(root),intentMap=validateIntentMap(JSON.parse(await readFile(path.join(root,'data/commercial/page-intents.json'))));
 const contexts=await loadCommercialContexts(root,intentMap),experiments=JSON.parse(await readFile(path.join(root,'data/commercial/partner-experiments.json')));
 const active=registry.partners.filter(p=>p.status==='ACTIVE'&&['PRIMARY','BACKUP'].includes(p.placement));
 let health=registry.health;
 if(liveHealth){health=[];const seen=new Set();for(const p of active)for(const url of [p.destination,p.paths.solar,p.paths.battery,p.tracking.cj_tracking_url,p.fallback_destination]){
  if(!url||seen.has(url))continue;seen.add(url);health.push(await checkCommercialDestination(url,{expectedHosts:p.expected_hosts}));
 }registry.health=health;now=new Date().toISOString();}
 if(writeHealth){if(!liveHealth)throw new Error('Health writes require --live-health');await assertIsolated(root);const file=path.join(root,'data/commercial/destination-health.json'),old=await readFile(file);await atomicConfigWrite(file,digest(old),health);}
 const routing=[],partnerMatrix=[],intentMatrix=[];
 for(const context of contexts){
  const legacy=context.pageType==='locality_guide'&&isCompareSolarServedLocality(context.state,context.city)&&hasVerifiedUnambiguousUtility({record_id:context.recordId,utility:context.utility})&&getLaunchReadyPartner('compare-solar-prices','cpl');
  const placement=registry.partners.filter(p=>registry.verifications.some(v=>v.partner_id===p.partner_id&&v.reviewed)&&p.status==='ACTIVE'&&['PRIMARY','BACKUP'].includes(p.placement)).flatMap(p=>p.placements??[]).filter(p=>p.page_path===context.pagePath);
  const intents=new Set(placement.map(p=>p.intent));
  const pageIntent=intents.size>1?'NONE':placement[0]?.intent??context.intent;
  const effective=pageIntent==='UNKNOWN'&&legacy?'NEW_SOLAR':pageIntent;
  const ctx={...context,intent:effective,pageIntent:effective,...(effective==='BATTERY_RETROFIT'?{existingSolar:true,batteryIntent:'RETROFIT'}:{})};
  const result=routePartnerSlot(ctx,registry,experiments,now);
  routing.push({page_path:context.pagePath,state:context.state,city:context.city,utility:context.utility?.value??'UNKNOWN',page_intent:pageIntent,effective_offer_intent:effective,intent_source:pageIntent==='UNKNOWN'&&legacy?'GRANDFATHERED_EXISTING_OFFER_NOT_PAGE_CLASSIFICATION':'REVIEWED_OR_UNKNOWN',selected_partner:result.selected?.partner_id??'NONE',cta_type:result.selected?.selected?.route.channel??'NONE',reason:result.reason,experiment_id:result.assignment?.experimentId??'NONE'});
  for(const p of result.candidates)partnerMatrix.push({page_path:context.pagePath,page_intent:pageIntent,offer_intent:effective,partner:p.partner_id,placement:p.placement,priority:p.priority,eligible:p.reasons.length===0,selected:result.selected?.partner_id===p.partner_id,blocked_reasons:p.reasons.join(';')});
  for(const category of PARTNER_CATEGORIES){const simulated=debugPartnerRoutes({...context,intent:category,pageIntent:category,...(category==='BATTERY_RETROFIT'?{existingSolar:true,batteryIntent:'RETROFIT'}:{})},registry,now);intentMatrix.push({page_path:context.pagePath,city:context.city,utility:context.utility?.value??'UNKNOWN',intent:category,selected_partner:simulated.selected?.partner_id??'NONE',reason:simulated.reason,mode:'CAPABILITY_SIMULATION_NOT_ACTIVATION'});}
 }
 let debug=null;if(journey){const u=new URL(journey,'https://mygridpermit.com');if(u.origin!=='https://mygridpermit.com'||u.search||u.hash)throw new Error('Canonical site URL required');const c=contexts.find(c=>c.pagePath===u.pathname);if(!c)throw new Error('Unknown page');const effective=intent??routing.find(r=>r.page_path===c.pagePath).effective_offer_intent;debug={mode:'LOCAL_CLI_ONLY',simulation:Boolean(intent),context:{...c,intent:effective,pageIntent:effective},result:routePartnerSlot({...c,intent:effective,pageIntent:effective},registry,experiments,now)};}
 const normalizedRouting=routing.map(r=>({...r,intent:r.page_intent,selected_channel:r.cta_type,legacy_cta:r.intent_source==='GRANDFATHERED_EXISTING_OFFER_NOT_PAGE_CLASSIFICATION'?'CSP_EXISTING_OFFER':'NOT_INFERRED',blocked_reasons:r.reason}));
 const gsc=gscFile?parseCommercialCsv(await readFile(gscFile,'utf8')):[];
 let search=searchToRevenueMap(gsc,contexts,normalizedRouting).map(row=>({...row,query_intent_hypothesis:queryIntentHypothesis(row.query),query_intent_status:'OFFLINE_HYPOTHESIS_NOT_PRODUCTION_METADATA',outbound_clicks:null,partner_result:null,join_status:row.dimension==='QUERY'?'NO_QUERY_PAGE_JOIN_AVAILABLE':'PAGE_JOIN_ONLY_NO_CLICK_OR_PARTNER_EXPORT'}));
 const clicks=clicksFile?parseCommercialCsv(await readFile(clicksFile,'utf8')):null;
 let measurement=null;
 if(measurementFile){
  const bundle=JSON.parse(await readFile(measurementFile,'utf8'));
  if(Object.keys(bundle).some(k=>!['clicks','reports_by_partner','evidence','now','click_window_start','click_window_end','reports_complete'].includes(k))||!Array.isArray(bundle.clicks)||!bundle.reports_by_partner)throw new Error('Sanitized measurement bundle required');
  const reports=Object.entries(bundle.reports_by_partner).flatMap(([partner,rows])=>normalizeNetworkReport(partner,rows,reportAdaptersFromPartners(registry.partners)));
  measurement=reportedLifecycle(bundle.clicks,reports,{now:bundle.now,evidence:bundle.evidence,reportComplete:bundle.reports_complete});
  search=joinSearchPartnerResults(search,bundle.clicks,measurement.ledger,bundle);
 }
 const concentration=partnerConcentration(clicks,registry.partners.map(p=>p.partner_id));
 concentration.placement_concentration={basis:'RENDERABLE_PLACEMENTS_NOT_CLICKS',partners:Object.fromEntries(active.map(p=>[p.partner_id,routing.filter(r=>r.selected_partner===p.partner_id).length]))};
 const coverage={by_intent:Object.fromEntries(PARTNER_CATEGORIES.map(i=>[i,intentMatrix.filter(r=>r.intent===i&&r.selected_partner!=='NONE').length])),by_partner:concentration.placement_concentration.partners,by_geography:routing.filter(r=>r.selected_partner!=='NONE').map(r=>({state:r.state,city:r.city,partner:r.selected_partner})),by_utility:Object.fromEntries([...new Set(routing.map(r=>r.utility))].map(u=>[u,routing.filter(r=>r.utility===u&&r.selected_partner!=='NONE').length]))};
 await mkdir(out,{recursive:true});for(const [name,value]of Object.entries({'PARTNER_REGISTRY.json':registry.partners,'PARTNER_VERIFICATIONS.json':registry.verifications,'ACTIVE_PARTNER_HEALTH.json':{generated_at:now,mode:liveHealth?'READ_ONLY_LIVE_HEAD':'CACHED',health},'PARTNER_CONCENTRATION.json':concentration,'COMMERCIAL_COVERAGE.json':coverage,'ROUTING_VERIFY.json':{generated_at:now,pages:contexts.length,selected_pages:routing.filter(r=>r.selected_partner!=='NONE').length,partners:registry.partners.length,active_partners:active.map(p=>p.partner_id),new_partner_activations:0,experiments_active:experiments.filter(e=>e.enabled&&e.status==='ACTIVE').length,mission_viejo:routing.find(r=>r.page_path.includes('/mission-viejo/')),production_mutated:false},'MEASUREMENT_JOIN.json':measurement??{status:'UNKNOWN_NO_AUTHENTIC_EXPORT'},'JOURNEY_DEBUG.json':debug??{status:'NOT_REQUESTED'}}))await writeFile(path.join(out,name),JSON.stringify(value,null,2)+'\n');
 for(const [name,rows]of [['PARTNER_ROUTE_MATRIX.csv',partnerMatrix],['INTENT_ROUTE_MATRIX.csv',intentMatrix],['PAGE_ROUTE_MATRIX.csv',routing],['SEARCH_TO_PARTNER_MAP.csv',search]])await writeFile(path.join(out,name),commercialCsv(rows));
 return {pages:contexts.length,selected_pages:routing.filter(r=>r.selected_partner!=='NONE').length,partners:registry.partners.length,out};
}
async function main(){const a=process.argv.slice(2),input={},booleans=new Set(['--live-health','--write-health']),allowed=new Set(['--root','--out','--gsc','--clicks','--measurement','--journey','--intent','--now',...booleans]);for(let i=0;i<a.length;i++){if(!allowed.has(a[i]))throw new Error('Invalid option');if(booleans.has(a[i]))input[a[i]]=true;else{if(!a[i+1]||a[i+1].startsWith('--'))throw new Error('Missing argument');input[a[i]]=a[++i];}}console.log(JSON.stringify(await platformReport({root:input['--root'],out:input['--out'],gscFile:input['--gsc'],clicksFile:input['--clicks'],measurementFile:input['--measurement'],journey:input['--journey'],intent:input['--intent'],now:input['--now'],liveHealth:input['--live-health'],writeHealth:input['--write-health']}),null,2));}
const isDirectRun=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isDirectRun)main().catch(e=>{console.error(e.message);process.exitCode=1;});
