import {parseCommercialCsv} from './commercial-csv.mjs';
const STAGES=['REFERRAL','QUALIFIED','FUNDED','APPROVED','PAYABLE','PAID','REVERSED'];
import {CTA_CHANNELS} from '../../src/lib/commercial/types.ts';
const CHANNELS=CTA_CHANNELS.filter(c=>c!=='NONE');
const FIELDS=['cid','stage','channel','reported_at','amount_cents','currency','evidence_ref','payment_evidence_ref','partner_event_id'];
const safeId=s=>typeof s==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$/.test(s);
const validCid=s=>typeof s==='string'&&/^[a-f0-9]{24}$/.test(s);
export const PARTNER_REPORT_ADAPTERS=Object.freeze({
  'compare-solar-prices':{id:'normalized-v1',fields:FIELDS},
});
// Partner-specific parsing requires an explicit registered adapter. No guessing
// aliases or accepting arbitrary vendor columns which might contain PII.
export function normalizePartnerReport(partnerId,file,adapters=PARTNER_REPORT_ADAPTERS){
  const adapter=adapters[partnerId];
  if(!adapter||adapter.id!=='normalized-v1')throw new Error('Unknown partner report adapter');
  const rows=Array.isArray(file)?file:typeof file==='string'&&file.trim().startsWith('[')?JSON.parse(file):parseCommercialCsv(file);
  if(!Array.isArray(rows)||rows.length>10000)throw new Error('Invalid report size');
  return rows.map((r,index)=>{
    if(!r||typeof r!=='object'||Object.keys(r).some(k=>!adapter.fields.includes(k)))throw new Error(`Unexpected or PII-like column at row ${index+1}`);
    if(!validCid(r.cid)||!STAGES.includes(r.stage)||!CHANNELS.includes(r.channel)||!safeId(r.evidence_ref)||!safeId(r.partner_event_id))throw new Error(`Invalid partner report row ${index+1}`);
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(r.reported_at)||!Number.isFinite(Date.parse(r.reported_at)))throw new Error('UTC report timestamp required');
    const amount=r.amount_cents===''||r.amount_cents==null?null:Number(r.amount_cents);
    if(amount!==null&&(!/^\d+$/.test(String(r.amount_cents))||!Number.isSafeInteger(amount)||amount<0))throw new Error('Integer cents required');
    const money=['APPROVED','PAYABLE','PAID','REVERSED'].includes(r.stage);
    if(money&&(amount===null||r.currency!=='USD'))throw new Error('Money stage requires exact amount and currency');
    if(!money&&amount!==null)throw new Error('Lead or install is not money');
    if(r.stage==='PAID'&&!safeId(r.payment_evidence_ref))throw new Error('Paid requires payment evidence');
    return {partner:partnerId,cid:r.cid,stage:r.stage,channel:r.channel,reported_at:r.reported_at,amount_cents:amount,
      currency:money?'USD':null,evidence_ref:r.evidence_ref,payment_evidence_ref:r.payment_evidence_ref||null,partner_event_id:r.partner_event_id};
  });
}
export function reconcileCommercialRevenue(clicks,reports,options={}){
  const now=Date.parse(options.now??new Date().toISOString());
  if(!Number.isFinite(now))throw new Error('Invalid clock');
  const clickMap=new Map(),quarantine=[],accepted=[],seen=new Map(),eventIds=new Map(),conflicts=new Set();
  for(const c of clicks){
    if(!validCid(c.cid)||!safeId(c.partner)||!CHANNELS.includes(c.channel))throw new Error('Invalid click context');
    const prior=clickMap.get(c.cid);
    if(prior&&JSON.stringify(prior)!==JSON.stringify(c))throw new Error('CID ownership conflict');
    clickMap.set(c.cid,c);
  }
  for(const r of reports){
    // Revalidate at the join boundary too; bypassing the file adapter must not
    // turn a fabricated PAID stage without evidence into revenue.
    normalizePartnerReport(r.partner,[Object.fromEntries(FIELDS.map(k=>[k,r[k]??'']))],{[r.partner]:{id:'normalized-v1',fields:FIELDS}});
    const c=clickMap.get(r.cid),key=[r.cid,r.partner,r.stage,r.channel].join('|');
    const time=Date.parse(r.reported_at);
    if(!c||c.partner!==r.partner||c.channel!==r.channel){quarantine.push({key,reason:'NO_MATCHING_CLICK_CONTEXT'});continue;}
    const reportEvidence=options.evidence?.find(e=>e.ref===r.evidence_ref&&e.partner===r.partner&&e.kind==='partner_report'&&e.verified===true&&/^[a-f0-9]{64}$/.test(e.sha256??''));
    if(!reportEvidence){quarantine.push({key,reason:'REPORT_EVIDENCE_UNVERIFIED'});continue;}
    if(r.stage==='PAID'&&!options.evidence?.some(e=>e.ref===r.payment_evidence_ref&&e.partner===r.partner&&e.kind==='payment_receipt'&&e.verified===true&&e.cid===r.cid&&e.amount_cents===r.amount_cents&&e.currency==='USD'&&/^[a-f0-9]{64}$/.test(e.sha256??''))){quarantine.push({key,reason:'PAYMENT_EVIDENCE_UNVERIFIED'});continue;}
    if(!Number.isFinite(time)||time>now||(c.timestamp&&time<Date.parse(c.timestamp))){quarantine.push({key,reason:'INVALID_REPORT_TIME'});continue;}
    if(conflicts.has(key)){quarantine.push({key,reason:'CONFLICTING_STAGE'});continue;}
    const prior=seen.get(key);
    if(prior){
      if(prior.amount_cents!==r.amount_cents||prior.partner_event_id!==r.partner_event_id){quarantine.push({key,reason:'CONFLICTING_STAGE'});conflicts.add(key);const at=accepted.indexOf(prior);if(at>=0)accepted.splice(at,1);}
      else quarantine.push({key,reason:'DUPLICATE_STAGE'});
      continue;
    }
    const eventKey=`${r.partner}|${r.partner_event_id}`;
    if(eventIds.has(eventKey)){quarantine.push({key,reason:'DUPLICATE_PARTNER_EVENT'});continue;}
    seen.set(key,r);eventIds.set(eventKey,key);accepted.push(r);
  }
  const paid=accepted.filter(x=>x.stage==='PAID');
  let reversed=0;
  for(const r of accepted.filter(x=>x.stage==='REVERSED')){
    const payment=paid.find(x=>x.cid===r.cid&&x.partner===r.partner&&x.channel===r.channel);
    if(!payment||r.amount_cents>payment.amount_cents){quarantine.push({key:[r.cid,r.partner,r.stage,r.channel].join('|'),reason:'REVERSAL_WITHOUT_MATCHING_PAYMENT'});accepted.splice(accepted.indexOf(r),1);continue;}
    reversed+=r.amount_cents;
  }
  const stages=Object.fromEntries(STAGES.map(s=>[s,accepted.filter(r=>r.stage===s).length]));
  return {accepted,quarantine,stages,approved_cents:accepted.filter(r=>r.stage==='APPROVED').reduce((s,r)=>s+r.amount_cents,0),
    payable_cents:accepted.filter(r=>r.stage==='PAYABLE').reduce((s,r)=>s+r.amount_cents,0),
    paid_gross_cents:paid.reduce((s,r)=>s+r.amount_cents,0),reversed_cents:reversed,
    paid_net_cents:paid.reduce((s,r)=>s+r.amount_cents,0)-reversed,
    revenue_claim:paid.length?'EVIDENCE_BACKED_PAYMENT_RECORDS':'NO_VERIFIED_PAYMENT',
    actual_current_partner_totals:options.reportComplete===true?'REPORT_COMPLETE':'UNKNOWN',
    warnings:['Normalized partner records still require authentic documentary evidence; a source reference string is not authentication.','CTA events and funded installs are not cash.']};
}
export const FUNNEL_STEPS=['PAGE','CTA_RENDERED','CTA_EXPOSED','CTA_CLICK','FIRST_PARTY_OUTBOUND','PARTNER_DESTINATION','PARTNER_REPORT'];
export function reconcileFunnel(observed={}){
  return FUNNEL_STEPS.map(step=>({step,count:Number.isSafeInteger(observed[step])&&observed[step]>=0?observed[step]:null,status:Number.isSafeInteger(observed[step])&&observed[step]>=0?'OBSERVED':'UNKNOWN'}));
}
