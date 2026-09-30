#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {commercialDryRun} from './commercial-experiment.mjs';
import {checkCommercialDestination} from './lib/commercial-destination-check.mjs';
import {commercialCsv} from './lib/commercial-csv.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function inspectCommercialHtml(html){
  const paid=/<[a-z][^>]*\sdata-compare-solar-cta-root(?:\s|=|>)/i.test(html);
  const external=/href="https:\/\/www\.energysage\.com\/?"/.test(html);
  return {paid_cta_present:paid,cta_type:paid?'SOLAR_QUOTE':external?'UNCOMPENSATED_RESOURCE':'NONE',partner:paid?'compare-solar-prices':external?'energysage':'NONE',
    disclosure:paid?/Paid referral disclosure:/.test(html):external?/not.*tracked|not.*earning|not.*compensation/i.test(html):null,
    tracking:paid?/data-compare-solar-cta(?:\s|=|>)/.test(html):null};
}
export async function crawlCommercialPages({root=ROOT,live=false,out,fetchImpl=globalThis.fetch}={}){
  if(!out)throw new Error('Explicit output directory required');
  const plan=await commercialDryRun({root});const pages=[];
  // Sequential, bounded read-only requests. HTML is never executed, and no
  // partner CTA is clicked. This cannot produce browser GA4 conversion events.
  for(const context of plan.contexts){
    let status=200,html='',error=null;
    try{
      if(live){const res=await fetchImpl('https://mygridpermit.com'+context.pagePath,{redirect:'manual',signal:AbortSignal.timeout(7000),headers:{'User-Agent':'GridPermit-ReadOnly-Route-Audit/1.0'}});status=res.status;if(status===200)html=await res.text();}
      else html=await readFile(path.join(root,'dist',context.pagePath,'index.html'),'utf8');
    }catch(e){status=null;error=e.message;}
    const observed=inspectCommercialHtml(html),expected=plan.routing.find(r=>r.page_path===context.pagePath);
    pages.push({page:context.pagePath,intent:context.intent,utility:context.utility?.value??'UNKNOWN',status,...observed,
      expected_paid:expected.legacy_cta==='CSP_PAID',routing_reason:expected.blocked_reasons,
      anomaly:status!==200?'PAGE_NOT_200':observed.paid_cta_present!==(expected.legacy_cta==='CSP_PAID')?'LEGACY_RENDER_MISMATCH':observed.paid_cta_present&&(!observed.disclosure||!observed.tracking)?'MISSING_CONTRACT_FIELD':'NONE',error});
    if(live)await new Promise(resolve=>setTimeout(resolve,120));
  }
  const health=[];
  if(live){
    const destinations=plan.catalog.routes.filter(r=>r.status==='ACTIVE'&&!r.testOnly&&pages.some(p=>p.page===r.pagePaths[0]&&p.paid_cta_present)).map(r=>r.destination.landingUrl);
    for(const url of [...new Set(destinations)]){
      health.push(await checkCommercialDestination(url,{expectedHosts:['www.comparesolarprices.net'],fetchImpl}));
      await new Promise(resolve=>setTimeout(resolve,120));
    }
  }
  const summary={generated_at:new Date().toISOString(),mode:live?'LIVE_READ_ONLY_HTTP':'LOCAL_BUILD',pages:pages.length,paid_cta_pages:pages.filter(p=>p.paid_cta_present).length,
    anomalies:pages.filter(p=>p.anomaly!=='NONE').length,destinations_checked:health.length,broken_or_unverified_destinations:health.filter(h=>!h.ok).length,
    tracking_query_preservation:'OFFLINE_CONTRACT_TESTED; NOT_PROBED_LIVE_WITH_SYNTHETIC_CID',analytics_collection:'NOT_TESTED_BY_HTTP_CRAWL',
    intent_contract:'UNKNOWN_FOR_LEGACY_PAGES; NEW_FRAMEWORK_FAILS_CLOSED',production_changed:false};
  await mkdir(out,{recursive:true});
  await writeFile(path.join(out,'PRODUCTION_ROUTE_CRAWL.csv'),commercialCsv(pages));
  await writeFile(path.join(out,'DESTINATION_HEALTH.json'),JSON.stringify(health,null,2)+'\n');
  await writeFile(path.join(out,'LIVE_CONTRACT_VERIFY.json'),JSON.stringify(summary,null,2)+'\n');
  return summary;
}
async function main(){const args=process.argv.slice(2);const allowed=['--live-read-only','--out'];for(let i=0;i<args.length;i++){if(!allowed.includes(args[i]))throw new Error('Unknown crawl argument');if(args[i]==='--out')i++;}const i=args.indexOf('--out');if(i<0||!args[i+1])throw new Error('--out required');console.log(JSON.stringify(await crawlCommercialPages({live:args.includes('--live-read-only'),out:path.resolve(args[i+1])}),null,2));}
const isDirectRun=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isDirectRun)main().catch(e=>{console.error(e.message);process.exitCode=1;});
