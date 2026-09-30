import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {COMMERCIAL_INTENTS} from '../../src/lib/commercial/types.ts';
import {safePagePath} from '../../src/lib/commercial/routing.ts';
import {normalizeCompareSolarCitySlug} from '../../src/lib/compare-solar-prices.ts';
import {parseCommercialCsv} from './commercial-csv.mjs';
export async function walkFiles(dir){let entries=[];try{entries=await readdir(dir,{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return [];throw e;}const result=[];for(const e of entries){const p=path.join(dir,e.name);if(e.isDirectory())result.push(...await walkFiles(p));else if(e.isFile())result.push(p);}return result.sort();}
export async function readJson(file){return JSON.parse(await readFile(file,'utf8'));}
export function validateIntentMap(input){
  if(input?.schema_version!==1||!Array.isArray(input.pages))throw new Error('Unsupported intent map schema');
  const seen=new Set();
  for(const row of input.pages){
    if(Object.keys(row).some(k=>!['page_path','intent','evidence_ref','reviewed_at'].includes(k))||!safePagePath(row.page_path)||!COMMERCIAL_INTENTS.includes(row.intent)||!row.evidence_ref||!Number.isFinite(Date.parse(row.reviewed_at)))throw new Error('Invalid reviewed page intent');
    if(seen.has(row.page_path))throw new Error('Duplicate page intent');seen.add(row.page_path);
  }
  return new Map(input.pages.map(r=>[r.page_path,r]));
}
export async function loadCommercialContexts(root,intentMap){
  const contexts=[];
  for(const f of await walkFiles(path.join(root,'data/localities'))){
    if(!f.endsWith('.json'))continue;const r=await readJson(f);if(r.state!=='CA'||!r.city?.value)continue;
    const slug=normalizeCompareSolarCitySlug(r.city.value),pagePath=`/california/${slug}/solar-permit-guide/`;
    const page=path.join(root,'src/pages/california',slug,'solar-permit-guide.astro');
    try{await stat(page);}catch{continue;}
    contexts.push({state:'CA',city:r.city.value,recordId:r.record_id,utility:r.utility,pageType:'locality_guide',pagePath,intent:intentMap.get(pagePath)?.intent??'UNKNOWN'});
  }
  // The exported crawl covers hubs, editorial and landing pages too; city or
  // intent is never invented for them from search queries.
  const paths=new Set(contexts.map(x=>x.pagePath));
  for(const f of await walkFiles(path.join(root,'dist/california'))){
    if(!f.endsWith('/index.html'))continue;const pagePath='/'+path.relative(path.join(root,'dist'),f).replace(/index\.html$/,'');
    if(paths.has(pagePath))continue;contexts.push({state:'CA',city:'',pageType:'hub',pagePath,intent:intentMap.get(pagePath)?.intent??'UNKNOWN'});
  }
  return contexts.sort((a,b)=>a.pagePath.localeCompare(b.pagePath));
}
export function importMismatchCsv(text,fieldMap={page_path:'page_path',intent:'intent',evidence_ref:'evidence_ref',reviewed_at:'reviewed_at'}){
  const required=['page_path','intent','evidence_ref','reviewed_at'];
  if(Object.keys(fieldMap).length!==4||required.some(k=>typeof fieldMap[k]!=='string')||new Set(Object.values(fieldMap)).size!==4)throw new Error('Explicit four-column field map required');
  const rows=parseCommercialCsv(text);
  const imported=rows.map(row=>{
    if(Object.keys(row).some(k=>!Object.values(fieldMap).includes(k)))throw new Error('Unmapped column; sanitize the review export before import');
    return Object.fromEntries(required.map(k=>[k,row[fieldMap[k]]]));
  });
  validateIntentMap({schema_version:1,pages:imported});
  return {schema_version:1,pages:imported,status:'REVIEW_ONLY_NOT_ACTIVATED'};
}
export function searchToRevenueMap(gsc,contexts,routing,analytics=[]){
  const lookup=new Map(contexts.map(c=>[c.pagePath,c])),routes=new Map(routing.map(r=>[r.page_path,r]));
  const metrics=new Map();
  for(const r of analytics){
    const allowed=['page_path','cta_rendered','cta_exposed','cta_clicked','window_start','window_end'];
    if(Object.keys(r).some(k=>!allowed.includes(k))||!safePagePath(r.page_path))throw new Error('Invalid analytics schema');
    if(metrics.has(r.page_path))throw new Error('Duplicate analytics page');
    for(const k of ['cta_rendered','cta_exposed','cta_clicked'])if(r[k]!==null&&(!Number.isSafeInteger(r[k])||r[k]<0))throw new Error('Analytics counts must be integers or null');
    metrics.set(r.page_path,r);
  }
  const seen=new Map();
  return gsc.map(r=>{
    if(!['query','landing_page','clicks','impressions','window_start','window_end'].every(k=>k in r))throw new Error('GSC normalized schema required');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(r.window_start)||!/^\d{4}-\d{2}-\d{2}$/.test(r.window_end)||Date.parse(r.window_start)>Date.parse(r.window_end))throw new Error('Invalid GSC window');
    if(!/^\d+$/.test(String(r.clicks))||!/^\d+$/.test(String(r.impressions))||!Number.isSafeInteger(Number(r.impressions))||Number(r.clicks)>Number(r.impressions))throw new Error('Invalid GSC metrics');
    let p=null;if(r.landing_page!=='UNKNOWN'){const u=new URL(r.landing_page);if(u.origin!=='https://mygridpermit.com'||u.search||u.hash||!safePagePath(u.pathname))throw new Error('Invalid GSC landing page');p=u.pathname;}
    const key=[r.window_start,r.window_end,r.query,r.landing_page].join('|');
    if(seen.has(key))throw new Error('Duplicate GSC dimensions; choose one snapshot before joining');seen.set(key,true);
    const c=lookup.get(p),route=routes.get(p),a=metrics.get(p),sameWindow=a&&a.window_start===r.window_start&&a.window_end===r.window_end;
    return {dimension:p?'PAGE':'QUERY',query:r.query,page_path:p??'UNKNOWN',search_clicks:Number(r.clicks),search_impressions:Number(r.impressions),
      window_start:r.window_start,window_end:r.window_end,window_evidence:'SUPPLIED_NORMALIZED_DATA_NOT_INDEPENDENTLY_DATED',
      intent:c?.intent??'UNKNOWN',cta_type:route?.selected_channel??'NONE',partner:route?.selected_partner??'NONE',
      legacy_cta_status:route?.legacy_cta??'UNKNOWN',routing_reason:route?.blocked_reasons??'NO_PAGE_JOIN',
      cta_rendered:sameWindow?a.cta_rendered:null,cta_exposed:sameWindow?a.cta_exposed:null,cta_clicked:sameWindow?a.cta_clicked:null,
      analytics_status:!a?'NOT_PROVIDED':sameWindow?'SAME_WINDOW':'WINDOW_MISMATCH_NOT_JOINED'};
  });
}
