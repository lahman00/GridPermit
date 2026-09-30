#!/usr/bin/env node
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildCommercialCatalog,COMMERCIAL_EXPERIMENTS} from '../src/lib/commercial/catalog.ts';
import {auditCommercialRoutes,catalogErrors} from '../src/lib/commercial/routing.ts';
import {COMMERCIAL_INTENTS,CTA_CHANNELS,ROUTE_STATUSES} from '../src/lib/commercial/types.ts';
import {experimentErrors,observationStatus} from '../src/lib/commercial/experiments.ts';
import {isCompareSolarServedLocality} from '../src/lib/compare-solar-prices.ts';
import {hasVerifiedUnambiguousUtility} from '../src/lib/utility-split-guard.ts';
import {getLaunchReadyPartner} from '../src/lib/partners.ts';
import {parseCommercialCsv,commercialCsv} from './lib/commercial-csv.mjs';
import {readJson,validateIntentMap,loadCommercialContexts,searchToRevenueMap,importMismatchCsv} from './lib/commercial-data.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function commercialDryRun({root=ROOT,now=new Date().toISOString(),healthFile,gscFile,analyticsFile,intentFile,catalogFile,experimentsFile,journey,intentOverride,mismatchFile,mismatchMapFile}={}){
  const intentMap=validateIntentMap(await readJson(intentFile??path.join(root,'data/commercial/page-intents.json')));
  const contexts=await loadCommercialContexts(root,intentMap);
  const health=healthFile?await readJson(healthFile):[];
  const catalog=catalogFile?await readJson(catalogFile):buildCommercialCatalog(health,contexts);
  const experimentConfigs=experimentsFile?await readJson(experimentsFile):COMMERCIAL_EXPERIMENTS;
  if(!Array.isArray(experimentConfigs)||experimentConfigs.some(e=>experimentErrors(e).length))throw new Error('Invalid experiment config');
  const errors=catalogErrors(catalog);if(errors.length)throw new Error(errors.join(';'));
  const routing=contexts.map(context=>{
    const result=auditCommercialRoutes(context,catalog,{now,mode:'shadow'});
    const legacy=context.pageType==='locality_guide'
      ? getLaunchReadyPartner('compare-solar-prices','cpl')&&isCompareSolarServedLocality(context.state,context.city)&&hasVerifiedUnambiguousUtility({record_id:context.recordId,utility:context.utility})?'CSP_PAID':'ENERGYSAGE_UNCOMPENSATED'
      :'NO_LEGACY_INSTALLER_CTA';
    const relevant=result.candidates.filter(r=>catalog.routes.find(x=>x.id===r.routeId)?.pagePaths.includes(context.pagePath));
    return {page_path:context.pagePath,city:context.city||'UNKNOWN',utility:context.utility?.value??'UNKNOWN',intent:context.intent,
      selected_channel:result.selected?.route.channel??'NONE',selected_partner:result.selected?.partner.id??'NONE',legacy_cta:legacy,
      blocked_reasons:[...new Set([...result.errors,...relevant.flatMap(r=>r.reasons)])].join(';')||'NO_APPROVED_ROUTE'};
  });
  let debug=null;
  if(journey){const u=new URL(journey,'https://mygridpermit.com');if(u.origin!=='https://mygridpermit.com'||u.search||u.hash)throw new Error('Journey requires canonical site URL');
    const context=contexts.find(x=>x.pagePath===u.pathname);if(!context)throw new Error('Page not present in inventory');
    if(intentOverride&&!COMMERCIAL_INTENTS.includes(intentOverride))throw new Error('Invalid debug intent');
    debug={context:{...context,...(intentOverride?{intent:intentOverride}:{})},simulation:Boolean(intentOverride),experiment:experimentConfigs.filter(e=>e.eligiblePages.includes(context.pagePath))};
    const debugCatalog=intentOverride?{...catalog,pages:catalog.pages.map(p=>p.pagePath===context.pagePath?{...p,intent:intentOverride}:p)}:catalog;
    debug.routing=auditCommercialRoutes(debug.context,debugCatalog,{now,mode:'shadow'});
  }
  const experiments=experimentConfigs.map(e=>({experiment_id:e.id,status:e.status,enabled:e.enabled,eligible_pages:e.eligiblePages,control:e.controlRouteId??'NONE',variant:e.variantRouteId,
    partner:catalog.routes.find(r=>r.id===e.variantRouteId)?.partnerId,traffic_estimate:null,blocked_reasons:[...experimentErrors(e),...(e.status!=='ACTIVE'?['NOT_ACTIVE']:[])],observation_status:observationStatus(e,{days:0,controlExposures:0,variantExposures:0,reportComplete:false})}));
  const gsc=gscFile?parseCommercialCsv(await readFile(gscFile,'utf8')):[];
  const search=searchToRevenueMap(gsc,contexts,routing,analyticsFile?await readJson(analyticsFile):[]);
  const anomalies=routing.filter(r=>r.blocked_reasons.includes('UTILITY_UNSAFE')||r.utility==='UNKNOWN'||r.intent==='UNKNOWN').map(r=>({...r,classification:r.intent==='UNKNOWN'?'EXPECTED_NO_INTENT_METADATA':'BLOCKED_ROUTE',production_changed:false}));
  return {generated_at:now,mode:'OFFLINE_SHADOW_NO_ACTIVATION',contexts,catalog,routing,anomalies,search,experiments,debug,
    mismatch_import:mismatchFile?importMismatchCsv(await readFile(mismatchFile,'utf8'),mismatchMapFile?await readJson(mismatchMapFile):undefined):null,
    summary:{pages:contexts.length,active_generic_cta_pages:routing.filter(r=>r.selected_channel!=='NONE').length,
      legacy_paid_pages:routing.filter(r=>r.legacy_cta==='CSP_PAID').length,active_experiments:experiments.filter(e=>e.enabled&&e.status==='ACTIVE').length,
      channels:CTA_CHANNELS,production_migration:false}};
}
export function commercialSchemas(){
  return {intent:{$schema:'http://json-schema.org/draft-07/schema#',title:'CommercialIntent',type:'string',enum:COMMERCIAL_INTENTS},
    route:{$schema:'http://json-schema.org/draft-07/schema#',title:'CommercialRoute',type:'object',additionalProperties:false,
      required:['id','partnerId','channel','status','enabled','testOnly','allowedIntents','states','citySlugs','pageTypes','pagePaths','utilityRequired','relationship','eligibility','evidence','destination','tracking'],
      properties:{id:{type:'string',pattern:'^[a-z][a-z0-9-]{1,79}$'},partnerId:{type:'string'},channel:{enum:CTA_CHANNELS},status:{enum:ROUTE_STATUSES},enabled:{type:'boolean'},testOnly:{type:'boolean'},
        allowedIntents:{type:'array',minItems:1,uniqueItems:true,items:{enum:COMMERCIAL_INTENTS}},states:{type:'array',items:{type:'string',pattern:'^[A-Z]{2}$'}},
        citySlugs:{type:'array',items:{type:'string'}},pageTypes:{type:'array',items:{type:'string'}},pagePaths:{type:'array',items:{type:'string',pattern:'^/'}},utilityRequired:{type:'boolean'},
        relationship:{enum:['paid_referral','affiliate','uncompensated_resource','internal_product','sponsored_local']},eligibility:{type:'array',items:{type:'string'}},
        evidence:{type:'object',additionalProperties:false,required:['approvalRef','territoryRef','trackingRef','verifiedAt','expiresAt'],properties:Object.fromEntries(['approvalRef','territoryRef','trackingRef','verifiedAt','expiresAt'].map(k=>[k,{type:'string'}]))},
        destination:{type:'object',additionalProperties:false,required:['landingUrl','usePreferredForm','approvedFallback','expectedHosts'],properties:{landingUrl:{type:'string'},preferredFormUrl:{type:'string'},fallbackUrl:{type:'string'},usePreferredForm:{type:'boolean'},approvedFallback:{type:'boolean'},expectedHosts:{type:'array',items:{type:'string'}},expectedFinalUrls:{type:'array',items:{type:'string'}},allowedQueryParams:{type:'array',items:{type:'string'}}}},
        tracking:{type:'object',additionalProperties:false,required:['mode','cidParam','fixedParams'],properties:{mode:{enum:['legacy_csp','cid_query','internal','utm','phone']},cidParam:{type:'string'},fixedParams:{type:'object',additionalProperties:{type:'string'}}}},
      }}};
}
export async function writeCommercialDryRun(result,out){
  await mkdir(out,{recursive:true});const schemas=commercialSchemas();
  const json={ 'COMMERCIAL_INTENT_SCHEMA.json':schemas.intent,'COMMERCIAL_ROUTE_SCHEMA.json':schemas.route,'OBSERVABILITY.json':result.summary,
    'EXPERIMENT_FRAMEWORK_VERIFY.json':{generated_at:result.generated_at,mode:result.mode,experiments:result.experiments},
    'COMMERCIAL_CATALOG_SNAPSHOT.json':result.catalog,'JOURNEY_DEBUG.json':result.debug??{status:'NO_JOURNEY_REQUESTED'}};
  for(const[name,data]of Object.entries(json))await writeFile(path.join(out,name),JSON.stringify(data,null,2)+'\n');
  for(const[name,rows]of [['ROUTING_MATRIX.csv',result.routing],['ROUTING_ANOMALIES.csv',result.anomalies],['SEARCH_TO_REVENUE_MAP.csv',result.search]])await writeFile(path.join(out,name),commercialCsv(rows));
}
async function main(){
  const args=process.argv.slice(2),value=flag=>{const i=args.indexOf(flag);return i>=0?args[i+1]:undefined;};
  const allowed=new Set(['--check','--out','--health','--gsc','--analytics','--intent-map','--catalog','--experiments','--journey','--intent','--mismatches','--mismatch-field-map','--now']);
  for(let i=0;i<args.length;i++){if(!allowed.has(args[i]))throw new Error(`Unknown option ${args[i]}`);if(args[i]!=='--check'){if(!args[i+1]||args[i+1].startsWith('--'))throw new Error('Missing option value');i++;}}
  const result=await commercialDryRun({now:value('--now'),healthFile:value('--health'),gscFile:value('--gsc'),analyticsFile:value('--analytics'),intentFile:value('--intent-map'),catalogFile:value('--catalog'),experimentsFile:value('--experiments'),journey:value('--journey'),intentOverride:value('--intent'),mismatchFile:value('--mismatches'),mismatchMapFile:value('--mismatch-field-map')});
  if(value('--out'))await writeCommercialDryRun(result,path.resolve(value('--out')));
  console.log(JSON.stringify({summary:result.summary,experiments:result.experiments,journey:result.debug},null,2));
}
const isDirectRun=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isDirectRun)main().catch(e=>{console.error(e.message);process.exitCode=1;});
