import {readFile} from 'node:fs/promises';import path from 'node:path';
import {walkFiles,validateIntentMap} from './commercial-data.mjs';
import {stateSlug} from '../../src/lib/state-meta.ts';
import {normalizeCompareSolarCitySlug,isCompareSolarServedLocality} from '../../src/lib/compare-solar-prices.ts';
import {hasVerifiedUnambiguousUtility} from '../../src/lib/utility-split-guard.ts';
import {getLaunchReadyPartner} from '../../src/lib/partners.ts';
import {routePartnerSlot} from '../../src/lib/commercial/partner-platform.ts';
export async function factoryRoutes(root,registry,now=new Date().toISOString()){
 const intents=validateIntentMap(JSON.parse(await readFile(path.join(root,'data/commercial/page-intents.json')))),experiments=JSON.parse(await readFile(path.join(root,'data/commercial/partner-experiments.json')));
 const localities=new Map(registry.records.filter(r=>r.city?.value).map(r=>[`/${stateSlug(r.state)}/${normalizeCompareSolarCitySlug(r.city.value)}/solar-permit-guide/`,r]));
 const placements=registry.partners.filter(p=>p.status==='ACTIVE'&&['PRIMARY','BACKUP'].includes(p.placement)&&registry.verifications.some(v=>v.partner_id===p.partner_id&&v.reviewed)).flatMap(p=>p.placements??[]);
 const rows=[];
 for(const file of await walkFiles(path.join(root,'dist'))){
  if(!file.endsWith('/index.html'))continue;const page='/'+path.relative(path.join(root,'dist'),file).replace(/index\.html$/,'');
  const matches=placements.filter(p=>p.page_path===page),conflict=new Set(matches.map(m=>m.record_id+'|'+m.intent)).size>1;
  const record=conflict?null:matches.length?registry.records.find(r=>r.record_id===matches[0].record_id):localities.get(page);
  const locality=localities.has(page),legacy=locality&&record&&isCompareSolarServedLocality(record.state,record.city.value)&&hasVerifiedUnambiguousUtility(record)&&getLaunchReadyPartner('compare-solar-prices','cpl');
  const intent=conflict?'NONE':matches[0]?.intent??intents.get(page)?.intent??(legacy?'NEW_SOLAR':'UNKNOWN');
  const context={state:record?.state??'',city:record?.city.value??'',recordId:record?.record_id,utility:record?.utility,pagePath:page,pageType:locality?'locality_guide':'blog_general',intent,pageIntent:intent,...(intent==='BATTERY_RETROFIT'?{existingSolar:true,batteryIntent:'RETROFIT'}:{})};
  const audit=routePartnerSlot(context,registry,experiments,now);
  rows.push({page_path:page,context,selected:audit.selected,reason:conflict?'PLACEMENT_CONTEXT_CONFLICT':audit.reason,candidates:audit.candidates});
 }
 return rows;
}
export function coverageDelta(before,after,clickRows=null){
 const old=new Map(before.map(r=>[r.page_path,r.selected?.partner_id??'NONE']));const changes=after.filter(r=>(r.selected?.partner_id??'NONE')!==old.get(r.page_path)).map(r=>({page:r.page_path,before:old.get(r.page_path)??'NONE',after:r.selected?.partner_id??'NONE'}));
 const pages=new Set(changes.filter(r=>r.after!=='NONE').map(r=>r.page));
 return {before_routes:before.filter(r=>r.selected).length,after_routes:after.filter(r=>r.selected).length,changes,expected_click_coverage:clickRows===null?null:clickRows.filter(r=>pages.has(r.page_path)).reduce((s,r)=>s+Number(r.clicks),0),click_coverage_basis:clickRows===null?'UNKNOWN_NO_SAME_WINDOW_CLICK_EXPORT':'SUPPLIED_HISTORICAL_PAGE_CLICKS_NOT_A_FORECAST'};
}
