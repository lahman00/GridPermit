import {createHash} from 'node:crypto';
import {RETENTION_DAYS,RETENTION_MS} from '../../src/lib/commercial/outbound-service.mjs';

export const REVENUE_STAGES=['CTA_RENDERED','CTA_EXPOSED','CTA_CLICKED','OUTBOUND_RECORDED','PARTNER_REPORTED_REFERRAL','QUALIFIED_LEAD','FUNDED_INSTALL','COMMISSION_APPROVED','COMMISSION_PAYABLE','COMMISSION_PAID'];
export const TOP8=['energysage','modernize','profitise','energyaid','oc-solar','norcal-solar-repair','greenlancer','permitdesign'];
const CLICK_FIELDS=['stage','cid','partner_id','page_path','city','intent','cta_id','timestamp'];
const HANDOFF_FIELDS=['partner_id','approval_reference','approval_evidence_ref','tracking_type','tracking_url','destination','territories','intents','verified_at','expires_at'];
const id=/^[a-z][a-z0-9-]{1,79}$/;
const cid=/^[a-f0-9]{24}$/;
const utc=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function exactFields(value,fields){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>fields.includes(k))&&fields.every(k=>Object.hasOwn(value,k));}
function safePath(value){return typeof value==='string'&&/^\/[a-z0-9/_-]*\/$/.test(value);}
function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash;}catch{return false;}}
function validateClick(row){
 if(!exactFields(row,CLICK_FIELDS)||row.stage!=='OUTBOUND_RECORDED'||!cid.test(row.cid)||!id.test(row.partner_id)||!safePath(row.page_path)||typeof row.city!=='string'||typeof row.intent!=='string'||typeof row.cta_id!=='string'||!utc.test(row.timestamp)||!Number.isFinite(Date.parse(row.timestamp)))throw new Error('Invalid no-PII outbound row');
 return row;
}
export function aggregateOutbound(exportFile,{now=new Date().toISOString()}={}){
 if(!exportFile||exportFile.stage!=='OUTBOUND_RECORDED'||exportFile.retention_days!==RETENTION_DAYS||!Array.isArray(exportFile.rows))throw new Error('Invalid outbound export envelope');
 const nowMs=Date.parse(now);if(!Number.isFinite(nowMs))throw new Error('Invalid clock');
 const unique=new Map();for(const row of exportFile.rows){validateClick(row);if(Date.parse(row.timestamp)>nowMs||nowMs-Date.parse(row.timestamp)>RETENTION_MS)throw new Error('Outbound row outside verified retention window');const key=row.partner_id+'|'+row.cid,prior=unique.get(key);if(prior&&JSON.stringify(prior)!==JSON.stringify(row))throw new Error('CID/partner click conflict');unique.set(key,row);}
 const rows=[...unique.values()];const report=[];
 for(const [window,hours] of [['OUTBOUND_CLICKS_24H',24],['OUTBOUND_CLICKS_7D',168]]){
  const selected=rows.filter(r=>nowMs-Date.parse(r.timestamp)<=hours*3600000);report.push({window,dimension:'TOTAL',value:'ALL',count:selected.length,truth:'OUTBOUND_RECORDED'});
  for(const [dimension,key] of [['BY_PARTNER','partner_id'],['BY_INTENT','intent'],['BY_CITY','city'],['BY_PAGE','page_path']]){const counts=new Map();for(const r of selected)counts.set(r[key],(counts.get(r[key])??0)+1);for(const [value,count] of [...counts].sort(([a],[b])=>a.localeCompare(b)))report.push({window,dimension,value,count,truth:'OUTBOUND_RECORDED'});}
 }
 return {rows,report,health:{generated_at:now,retention_days:RETENTION_DAYS,unique_recorded_outbounds:rows.length,duplicates_suppressed:exportFile.duplicates_suppressed??0,expired_suppressed:exportFile.expired_suppressed??0,pii_fields_persisted:false,human_clicks_proven:false,partner_referrals:null,qualified_leads:null,funded_installs:null,commission_approved_cents:null,commission_payable_cents:null,commission_paid_cents:null,empty_baseline:rows.length===0}};
}

export function importCodexHandoffs(input,{now=new Date().toISOString()}={}){
 if(!input||input.schema_version!==1||!Array.isArray(input.partners)||Object.keys(input).some(k=>!['schema_version','partners'].includes(k)))throw new Error('CODEX_HANDOFFS schema_version 1 required');
 const seen=new Set(),nowMs=Date.parse(now);
 return input.partners.map((p,index)=>{
  if(!exactFields(p,HANDOFF_FIELDS)||!TOP8.includes(p.partner_id)||seen.has(p.partner_id))throw new Error(`Invalid or duplicate handoff row ${index+1}`);seen.add(p.partner_id);
  if(typeof p.approval_reference!=='string'||!id.test(p.approval_reference)||typeof p.approval_evidence_ref!=='string'||p.approval_evidence_ref.length<3||!['CID_QUERY','UTM','PHONE_TRACKING','MANUAL'].includes(p.tracking_type)||!safeUrl(p.tracking_url)||!safeUrl(p.destination))throw new Error(`Missing approval/destination/tracking at row ${index+1}`);
  if(!p.territories||Object.keys(p.territories).some(k=>!['states','cities','counties','utilities','statewide_verified'].includes(k))||!Array.isArray(p.territories.states)||!p.territories.states.length||p.territories.states.some(s=>!/^([A-Z]{2})$/.test(s))||!Array.isArray(p.territories.cities)||!Array.isArray(p.territories.counties)||!Array.isArray(p.territories.utilities)||!p.territories.utilities.length)throw new Error(`Unknown territory at row ${index+1}`);
  if(!Array.isArray(p.intents)||!p.intents.length||p.intents.some(x=>typeof x!=='string')||!utc.test(p.verified_at)||!utc.test(p.expires_at)||Date.parse(p.verified_at)>nowMs||Date.parse(p.expires_at)<=nowMs)throw new Error(`Unknown intent or stale evidence at row ${index+1}`);
  return {...structuredClone(p),status:'VERIFIED_HANDOFF_READY_FOR_CONFIG_NOT_ACTIVE'};
 });
}

export function revenueLedger(outboundRows=[],reportedRows=[]){
 const rows=outboundRows.map(r=>({event_id:createHash('sha256').update(`OUTBOUND_RECORDED|${r.partner_id}|${r.cid}`).digest('hex'),stage:'OUTBOUND_RECORDED',cid:r.cid,partner_id:r.partner_id,timestamp:r.timestamp,evidence_ref:'first-party-private-store',amount_cents:null,currency:null,payment_evidence_ref:null}));
 for(const r of reportedRows){if(!REVENUE_STAGES.includes(r.stage)||r.stage==='OUTBOUND_RECORDED'||!cid.test(r.cid)||!id.test(r.partner_id)||!utc.test(r.timestamp)||typeof r.evidence_ref!=='string')throw new Error('Invalid evidence-gated revenue row');const money=r.stage.startsWith('COMMISSION_');if(money&&(!Number.isSafeInteger(r.amount_cents)||r.amount_cents<0||r.currency!=='USD'))throw new Error('Commission stage needs integer USD cents');if(!money&&r.amount_cents!=null)throw new Error('Non-commission stage cannot claim money');if(r.stage==='COMMISSION_PAID'&&typeof r.payment_evidence_ref!=='string')throw new Error('Paid stage requires payment evidence');rows.push({...r,event_id:createHash('sha256').update(`${r.stage}|${r.partner_id}|${r.cid}|${r.evidence_ref}`).digest('hex'),amount_cents:money?r.amount_cents:null,currency:money?'USD':null,payment_evidence_ref:r.payment_evidence_ref??null});}
 const keys=new Set();for(const row of rows){const key=`${row.stage}|${row.partner_id}|${row.cid}`;if(keys.has(key))throw new Error('Duplicate ledger stage');keys.add(key);}
 return rows.sort((a,b)=>a.timestamp.localeCompare(b.timestamp)||a.event_id.localeCompare(b.event_id));
}

export function firstLeadAlert(ledger){const first=ledger.filter(r=>r.stage==='PARTNER_REPORTED_REFERRAL'||r.stage==='QUALIFIED_LEAD').sort((a,b)=>a.timestamp.localeCompare(b.timestamp))[0];return first?{status:'ACTION_REQUIRED_FIRST_REPORTED_LEAD',partner_id:first.partner_id,cid:first.cid,stage:first.stage,timestamp:first.timestamp,evidence_ref:first.evidence_ref,external_notification_sent:false}:{status:'NO_PARTNER_REPORTED_LEAD',external_notification_sent:false};}

export function coverageReport(partners,report){
 const clicks=report.filter(r=>r.window==='OUTBOUND_CLICKS_7D'&&r.dimension==='BY_PARTNER'),total=report.find(r=>r.window==='OUTBOUND_CLICKS_7D'&&r.dimension==='TOTAL')?.count??0;
 return {active_partners:partners.filter(p=>p.status==='ACTIVE').length,shadow_partners:partners.filter(p=>p.status==='SHADOW').length,top8:TOP8.map(partner_id=>{const p=partners.find(x=>x.partner_id===partner_id);return {partner_id,status:p?.status??'MISSING',intents:p?.categories??[],territory:p?.territories??null,clicks_7d:clicks.find(x=>x.value===partner_id)?.count??0};}),partner_concentration:total?clicks.map(x=>({partner_id:x.value,clicks:x.count,percent:100*x.count/total,over_70_percent:x.count/total>0.7})):{status:'NO_OBSERVED_CLICKS',over_70_percent:null},revenue_truth:'CLICKS_ARE_NOT_LEADS_OR_REVENUE'};
}

export function preflightPriorityConflicts(partners,contexts){
 const results=contexts.map(context=>{const eligible=partners.filter(p=>p.categories.includes(context.intent)&&p.territories.states.includes(context.state)&&(p.territories.statewide_verified===true||p.territories.counties?.some(c=>c.state===context.state&&c.county.toLowerCase()===context.county.toLowerCase()))).sort((a,b)=>(a.placement==='PRIMARY'?0:1)-(b.placement==='PRIMARY'?0:1)||a.priority-b.priority||a.partner_id.localeCompare(b.partner_id));const tied=eligible.length>1&&eligible[0].placement===eligible[1].placement&&eligible[0].priority===eligible[1].priority;return {...context,candidates:eligible.map(p=>p.partner_id),selected:tied?null:eligible[0]?.partner_id??null,status:tied?'AMBIGUOUS_PRIORITY':eligible.length?'DETERMINISTIC':'NO_ROUTE'};});return {ok:results.every(r=>r.status!=='AMBIGUOUS_PRIORITY'),results};
}
