import {normalizePartnerReport,reconcileCommercialRevenue} from './commercial-reconciliation.mjs';
export const LIFECYCLE_EVENTS=['cta_rendered','cta_exposed','cta_clicked','partner_outbound','partner_reported_referral','qualified_lead','funded_install','commission_approved','commission_payable','commission_paid'];
export const EVENT_ALIASES={cta_rendered:'commercial_cta_rendered',cta_exposed:'commercial_cta_exposed',cta_clicked:'commercial_cta_clicked'};
const FIELDS=['cid','stage','channel','reported_at','amount_cents','currency','evidence_ref','payment_evidence_ref','partner_event_id'];
// Explicit input contract, not a guess at raw CJ/Modernize/Profitise exports.
// Export operators map vendor columns into this sanitized contract first.
export const NETWORK_REPORT_ADAPTERS=Object.fromEntries(['compare-solar-prices','energysage','modernize','profitise'].map(id=>[id,{id:'normalized-v1',fields:FIELDS}]));
export function normalizeNetworkReport(partner,file,registry=NETWORK_REPORT_ADAPTERS){return normalizePartnerReport(partner,file,registry);}
export function reportedLifecycle(clicks,reports,options){const ledger=reconcileCommercialRevenue(clicks,reports,options);const names={REFERRAL:'partner_reported_referral',QUALIFIED:'qualified_lead',FUNDED:'funded_install',APPROVED:'commission_approved',PAYABLE:'commission_payable',PAID:'commission_paid'};return {ledger,events:ledger.accepted.filter(r=>names[r.stage]).map(r=>({event:names[r.stage],cid:r.cid,partner:r.partner,channel:r.channel,evidence_ref:r.evidence_ref,...(['APPROVED','PAYABLE','PAID'].includes(r.stage)?{amount_cents:r.amount_cents}:{}),...(r.stage==='PAID'?{payment_evidence_ref:r.payment_evidence_ref}:{})}))};}
export function partnerConcentration(rows,knownPartners){
 if(rows===null)return {status:'UNKNOWN_NO_CLICK_EXPORT',clicks:null,partners:[],over_70_percent:null};
 const unique=new Map();for(const r of rows){
  if(Object.keys(r).some(k=>!['cid','partner','page_path','timestamp'].includes(k))||!/^[a-f0-9]{24}$/.test(r.cid)||!knownPartners.includes(r.partner))throw new Error('Invalid click export');
  const previous=unique.get(r.cid);if(previous&&previous!==r.partner)throw new Error('CID partner ownership conflict');unique.set(r.cid,r.partner);
 }
 const counts=new Map();for(const partner of unique.values())counts.set(partner,(counts.get(partner)??0)+1);
 return {status:unique.size?'OBSERVED':'NO_OBSERVED_CLICKS',clicks:unique.size,partners:[...counts].sort(([a],[b])=>a.localeCompare(b)).map(([partner,clicks])=>({partner,clicks,percent:100*clicks/unique.size,concentrated:clicks/unique.size>0.7})),over_70_percent:unique.size?[...counts.values()].some(n=>n/unique.size>0.7):null};
}
export function queryIntentHypothesis(query){
 if(!query||query==='UNKNOWN')return 'UNKNOWN';const q=query.toLowerCase();
 if(/battery|powerwall|storage/.test(q)){if(/existing|retrofit|add|nem.?2/.test(q))return 'BATTERY_RETROFIT';return 'UNKNOWN_BATTERY_SUBTYPE';}
 if(/pto|permission to operate|failed inspection|orphan/.test(q))return 'PTO_RESCUE';
 if(/permit.*(?:service|plan|engineering)|(?:service|plan).*permit/.test(q))return 'PERMIT_ENGINEERING';
 if(/installer|installation company/.test(q))return 'LOCAL_INSTALLER';
 if(/solar (?:quote|price|cost)|buy solar/.test(q))return 'NEW_SOLAR';return 'INFORMATIONAL';
}

// Reviewed column maps allow real vendor exports to be normalized without
// inventing their layouts or silently retaining names/contact fields.
export function normalizeMappedReport(partner,rows,{field_map,stage_map,review_reference},registry=NETWORK_REPORT_ADAPTERS){
 if(!review_reference||!field_map||!stage_map||!Array.isArray(rows)||Object.keys(field_map).some(k=>!FIELDS.includes(k))||new Set(Object.values(field_map)).size!==Object.keys(field_map).length)throw new Error('Reviewed explicit field/stage mapping required');
 const allowed=new Set(Object.values(field_map));
 const normalized=rows.map(row=>{if(Object.keys(row).some(k=>!allowed.has(k)))throw new Error('Unmapped source column; sanitize before import');const out=Object.fromEntries(Object.entries(field_map).map(([target,source])=>[target,row[source]]));if(!Object.hasOwn(stage_map,out.stage))throw new Error('Unmapped vendor stage');out.stage=stage_map[out.stage];return out;});
 return normalizeNetworkReport(partner,normalized,registry);
}
export function joinSearchPartnerResults(search,clicks,ledger,{click_window_start,click_window_end,reports_complete=false}={}){
 // The caller supplies an explicit export window; absence is never zero.
 const validWindow=/^\d{4}-\d{2}-\d{2}$/.test(click_window_start??'')&&/^\d{4}-\d{2}-\d{2}$/.test(click_window_end??'')&&click_window_start<=click_window_end;
 const unique=new Map();
 for(const c of clicks??[]){if(!/^\/[a-z0-9/_-]*\/$/.test(c.page_path??'')||!/^[a-f0-9]{24}$/.test(c.cid)||!Number.isFinite(Date.parse(c.timestamp)))throw new Error('Page, anonymous CID and timestamp required for click join');if(unique.has(c.cid)&&JSON.stringify(unique.get(c.cid))!==JSON.stringify(c))throw new Error('CID join conflict');unique.set(c.cid,c);}
 return search.map(r=>{
  if(r.dimension==='QUERY')return {...r,outbound_clicks:null,partner_result:null,join_status:'NO_QUERY_PAGE_JOIN_AVAILABLE'};
  if(clicks===null||!validWindow||r.window_start!==click_window_start||r.window_end!==click_window_end)return {...r,outbound_clicks:null,partner_result:null,join_status:'MISSING_OR_MISMATCHED_CLICK_WINDOW'};
  const matched=[...unique.values()].filter(c=>c.page_path===r.page_path&&c.partner===r.partner&&c.timestamp.slice(0,10)>=r.window_start&&c.timestamp.slice(0,10)<=r.window_end);
  const cids=new Set(matched.map(c=>c.cid));const reports=(ledger?.accepted??[]).filter(x=>cids.has(x.cid)&&x.partner===r.partner);
  return {...r,outbound_clicks:matched.length,partner_result:ledger?JSON.stringify(Object.fromEntries(['REFERRAL','QUALIFIED','FUNDED','APPROVED','PAYABLE','PAID','REVERSED'].map(s=>[s,reports.filter(x=>x.stage===s).length]))):null,partner_result_completeness:reports_complete?'COMPLETE_EXPLICITLY_ATTESTED':'PARTIAL_OR_UNKNOWN',join_status:ledger?'PAGE_CID_PARTNER_JOIN_REPORT_EVIDENCE_GATED':'PAGE_CID_JOIN_NO_PARTNER_EXPORT'};
 });
}

export function reportAdaptersFromPartners(partners){
 return Object.fromEntries(partners.filter(p=>['APPROVED','ACTIVE','PAUSED'].includes(p.status)&&p.commercial_status==='VERIFIED').map(p=>[p.partner_id,{id:'normalized-v1',fields:FIELDS}]));
}
export function normalizeCallReport(partner,rows,campaign,adapters=NETWORK_REPORT_ADAPTERS){
 if(campaign?.campaign_active!==true||!Number.isSafeInteger(campaign.minimum_call_seconds)||campaign.minimum_call_seconds<0)throw new Error('Approved active call campaign with duration policy required');
 const sanitized=rows.map(row=>{const {call_duration_seconds,...core}=row;if(!Number.isSafeInteger(call_duration_seconds)||call_duration_seconds<0)throw new Error('Call duration required');if(['QUALIFIED','APPROVED','PAID'].includes(core.stage)&&call_duration_seconds<campaign.minimum_call_seconds)throw new Error('Call below approved qualification duration');return core;});
 return normalizeNetworkReport(partner,sanitized,adapters);
}
