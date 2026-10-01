import {test} from 'node:test';import assert from 'node:assert/strict';
import {aggregateOutbound,importCodexHandoffs,revenueLedger,firstLeadAlert,currentLeadStates,preflightPriorityConflicts,REVENUE_STAGES} from '../scripts/lib/live-revenue-ops.mjs';
import {RETENTION_DAYS} from '../src/lib/commercial/outbound-service.mjs';
import {PARTNERS} from '../src/lib/partners.ts';import {CHANNEL_PRIORITY} from '../src/lib/partner-routing.ts';
const now='2026-09-27T08:00:00.000Z',base={stage:'OUTBOUND_RECORDED',cid:'a'.repeat(24),partner_id:'energysage',page_path:'/california/richmond/solar-permit-guide/',city:'Richmond',intent:'NEW_SOLAR',cta_id:'solar_quote',timestamp:'2026-09-27T07:00:00.000Z'};
test('reporter keeps 24h/7d truth and dimensions separate',()=>{const x=aggregateOutbound({stage:'OUTBOUND_RECORDED',retention_days:RETENTION_DAYS,rows:[base],duplicates_suppressed:0,expired_suppressed:0},{now});assert.equal(x.report.find(r=>r.window==='OUTBOUND_CLICKS_24H'&&r.dimension==='TOTAL').count,1);assert.equal(x.report.find(r=>r.dimension==='BY_CITY').value,'Richmond');assert.equal(x.health.partner_referrals,null);assert.equal(x.health.commission_paid_cents,null);});
test('reporter rejects PII, stale rows and conflicting CID ownership',()=>{for(const row of [{...base,email:'x@y.test'},{...base,timestamp:'2026-08-01T00:00:00.000Z'}])assert.throws(()=>aggregateOutbound({stage:'OUTBOUND_RECORDED',retention_days:RETENTION_DAYS,rows:[row]},{now}));assert.throws(()=>aggregateOutbound({stage:'OUTBOUND_RECORDED',retention_days:RETENTION_DAYS,rows:[base,{...base,city:'Oakland'}]},{now}));});
test('handoff requires exact top8 approval tracking destination territory and intent',()=>{const h={partner_id:'energysage',approval_reference:'approval-1',approval_evidence_ref:'cj:approval',tracking_type:'CID_QUERY',tracking_url:'https://www.energysage.com/?sid=x',destination:'https://www.energysage.com/',territories:{states:['CA'],cities:[],counties:[],utilities:['VERIFIED_LOCAL_RECORD'],statewide_verified:true},intents:['NEW_SOLAR'],verified_at:'2026-09-27T07:00:00.000Z',expires_at:'2026-10-27T07:00:00.000Z'};assert.equal(importCodexHandoffs({schema_version:1,partners:[h]},{now})[0].status,'VERIFIED_HANDOFF_READY_FOR_CONFIG_NOT_ACTIVE');for(const bad of [{...h,approval_reference:null},{...h,partner_id:'unknown'},{...h,email:'pii'}])assert.throws(()=>importCodexHandoffs({schema_version:1,partners:[bad]},{now}));});
test('ledger keeps approval payable and paid distinct; first lead alerts locally',()=>{assert.equal(new Set(REVENUE_STAGES).size,11);const reported=['PARTNER_REPORTED_REFERRAL','COMMISSION_APPROVED','COMMISSION_PAYABLE','COMMISSION_PAID'].map((stage,i)=>({stage,cid:'b'.repeat(24),partner_id:'modernize',timestamp:`2026-09-27T07:0${i}:00.000Z`,evidence_ref:'report-1',amount_cents:stage.startsWith('COMMISSION_')?1000:null,currency:stage.startsWith('COMMISSION_')?'USD':null,...(stage==='COMMISSION_PAID'?{payment_evidence_ref:'payment-1'}:{})}));const ledger=revenueLedger([],reported);assert.deepEqual(ledger.map(x=>x.stage),reported.map(x=>x.stage));assert.equal(firstLeadAlert(ledger).status,'ACTION_REQUIRED_FIRST_REPORTED_LEAD');});

// --- Reversal lifecycle (LEAD_REVERSED) ---
// Historical qualified event vs current active qualified state vs financial
// settlement state must be three independently answerable questions.
const revCid='c'.repeat(24),revPartner='energyaid';
const qualifiedRow=(ts)=>({stage:'QUALIFIED_LEAD',cid:revCid,partner_id:revPartner,timestamp:ts,evidence_ref:'partner-report-1',amount_cents:null,currency:null});
const reversedRow=(ts,evidence_ref='partner-report-2')=>({stage:'LEAD_REVERSED',cid:revCid,partner_id:revPartner,timestamp:ts,evidence_ref,amount_cents:null,currency:null});

test('outbound -> referral -> qualified -> reversed: earlier events survive unmodified, state flips to not-active',()=>{
 const outboundRows=[{...base,cid:revCid,partner_id:revPartner,timestamp:'2026-09-01T00:00:00.000Z'}];
 const reported=[
  {stage:'PARTNER_REPORTED_REFERRAL',cid:revCid,partner_id:revPartner,timestamp:'2026-09-02T00:00:00.000Z',evidence_ref:'report-1',amount_cents:null,currency:null},
  qualifiedRow('2026-09-05T00:00:00.000Z'),
  reversedRow('2026-09-10T00:00:00.000Z'),
 ];
 const ledger=revenueLedger(outboundRows,reported);
 assert.deepEqual(ledger.map(r=>r.stage),['OUTBOUND_RECORDED','PARTNER_REPORTED_REFERRAL','QUALIFIED_LEAD','LEAD_REVERSED']);
 const [state]=currentLeadStates(ledger);
 assert.equal(state.historical_qualified_event,true);
 assert.equal(state.currently_active_qualified,false);
 assert.equal(state.reversed,true);
 assert.equal(state.reversed_at,'2026-09-10T00:00:00.000Z');
 assert.equal(state.financial_settlement_state,null);
});

test('qualified -> duplicate reversal is rejected, cannot double-adjust',()=>{
 const reported=[qualifiedRow('2026-09-05T00:00:00.000Z'),reversedRow('2026-09-10T00:00:00.000Z'),reversedRow('2026-09-11T00:00:00.000Z')];
 assert.throws(()=>revenueLedger([],reported),/Duplicate ledger stage/);
});

test('reversed before qualification fails closed',()=>{
 const reported=[reversedRow('2026-09-05T00:00:00.000Z')];
 assert.throws(()=>revenueLedger([],reported),/LEAD_REVERSED requires a prior QUALIFIED_LEAD/);
});

test('reversal timestamped before its own qualification fails closed',()=>{
 const reported=[qualifiedRow('2026-09-10T00:00:00.000Z'),reversedRow('2026-09-05T00:00:00.000Z')];
 assert.throws(()=>revenueLedger([],reported),/LEAD_REVERSED requires a prior QUALIFIED_LEAD/);
});

test('qualified -> commission approved -> reversed: approval evidence is preserved, not erased',()=>{
 const reported=[
  qualifiedRow('2026-09-05T00:00:00.000Z'),
  {stage:'COMMISSION_APPROVED',cid:revCid,partner_id:revPartner,timestamp:'2026-09-07T00:00:00.000Z',evidence_ref:'approval-1',amount_cents:2500,currency:'USD'},
  reversedRow('2026-09-10T00:00:00.000Z'),
 ];
 const ledger=revenueLedger([],reported);
 assert.equal(ledger.some(r=>r.stage==='COMMISSION_APPROVED'&&r.amount_cents===2500),true);
 const [state]=currentLeadStates(ledger);
 assert.equal(state.currently_active_qualified,false);
 assert.equal(state.financial_settlement_state,'COMMISSION_APPROVED');
});

test('qualified -> paid -> reversed: paid cash is never silently zeroed by a reversal',()=>{
 const reported=[
  qualifiedRow('2026-09-05T00:00:00.000Z'),
  {stage:'COMMISSION_APPROVED',cid:revCid,partner_id:revPartner,timestamp:'2026-09-06T00:00:00.000Z',evidence_ref:'approval-1',amount_cents:2500,currency:'USD'},
  {stage:'COMMISSION_PAYABLE',cid:revCid,partner_id:revPartner,timestamp:'2026-09-07T00:00:00.000Z',evidence_ref:'payable-1',amount_cents:2500,currency:'USD'},
  {stage:'COMMISSION_PAID',cid:revCid,partner_id:revPartner,timestamp:'2026-09-08T00:00:00.000Z',evidence_ref:'paid-1',amount_cents:2500,currency:'USD',payment_evidence_ref:'payment-1'},
  reversedRow('2026-09-10T00:00:00.000Z'),
 ];
 const ledger=revenueLedger([],reported);
 const paidRow=ledger.find(r=>r.stage==='COMMISSION_PAID');
 assert.equal(paidRow.amount_cents,2500);assert.equal(paidRow.payment_evidence_ref,'payment-1');
 const [state]=currentLeadStates(ledger);
 assert.equal(state.financial_settlement_state,'COMMISSION_PAID');
 assert.equal(state.reversed,true);
 // Reversal never invents a refund/clawback amount - no such stage exists yet,
 // and none is fabricated here. A real clawback needs its own future evidence-gated stage.
 assert.equal(ledger.some(r=>r.stage.includes('CLAWBACK')||r.stage.includes('REFUND')),false);
});

test('malformed reversal evidence fails closed',()=>{
 const baseQualified=[qualifiedRow('2026-09-05T00:00:00.000Z')];
 assert.throws(()=>revenueLedger([],[...baseQualified,{...reversedRow('2026-09-10T00:00:00.000Z'),evidence_ref:''}]),/Invalid evidence-gated revenue row/);
 assert.throws(()=>revenueLedger([],[...baseQualified,{...reversedRow('2026-09-10T00:00:00.000Z'),cid:'not-a-cid'}]),/Invalid evidence-gated revenue row/);
 assert.throws(()=>revenueLedger([],[...baseQualified,{...reversedRow('2026-09-10T00:00:00.000Z'),amount_cents:100}]),/Non-commission stage cannot claim money/);
 assert.throws(()=>revenueLedger([],[...baseQualified,{...reversedRow('2026-09-10T00:00:00.000Z'),timestamp:'not-a-date'}]),/Invalid evidence-gated revenue row/);
});

test('two CIDs, only one reversed: unrelated leads are unaffected',()=>{
 const otherCid='d'.repeat(24);
 const reported=[
  qualifiedRow('2026-09-05T00:00:00.000Z'),
  reversedRow('2026-09-10T00:00:00.000Z'),
  {stage:'QUALIFIED_LEAD',cid:otherCid,partner_id:revPartner,timestamp:'2026-09-06T00:00:00.000Z',evidence_ref:'report-3',amount_cents:null,currency:null},
 ];
 const ledger=revenueLedger([],reported);
 const states=currentLeadStates(ledger);
 const reversedState=states.find(s=>s.cid===revCid),activeState=states.find(s=>s.cid===otherCid);
 assert.equal(reversedState.currently_active_qualified,false);
 assert.equal(activeState.currently_active_qualified,true);
});

test('firstLeadAlert behavior after reversal: the historical first-reported event remains discoverable, never erased',()=>{
 const reported=[qualifiedRow('2026-09-05T00:00:00.000Z'),reversedRow('2026-09-10T00:00:00.000Z')];
 const ledger=revenueLedger([],reported);
 const alert=firstLeadAlert(ledger);
 assert.equal(alert.status,'ACTION_REQUIRED_FIRST_REPORTED_LEAD');
 assert.equal(alert.stage,'QUALIFIED_LEAD');
 assert.equal(alert.timestamp,'2026-09-05T00:00:00.000Z');
});

test('summary counts before/after reversal: currently_active_qualified count drops, historical count never does',()=>{
 const before=currentLeadStates(revenueLedger([],[qualifiedRow('2026-09-05T00:00:00.000Z')]));
 const after=currentLeadStates(revenueLedger([],[qualifiedRow('2026-09-05T00:00:00.000Z'),reversedRow('2026-09-10T00:00:00.000Z')]));
 const activeCount=states=>states.filter(s=>s.currently_active_qualified).length;
 const historicalCount=states=>states.filter(s=>s.historical_qualified_event).length;
 assert.equal(activeCount(before),1);assert.equal(activeCount(after),0);
 assert.equal(historicalCount(before),1);assert.equal(historicalCount(after),1);
});
test('Service Direct is hard-blocked from every solar pay-per-call path',()=>{const p=PARTNERS.find(x=>x.id==='service-direct');assert.equal(p.status,'blocked');assert.equal(p.vertical,'general_home_services');assert.match(p.notes,/ELECTRICAL_ONLY/);assert.ok(!CHANNEL_PRIORITY.pay_per_call.includes('service-direct'));});
test('first-five simultaneous preflight resolves intent, geography and explicit priority deterministically',async()=>{const {readFile}=await import('node:fs/promises');const first=await Promise.all(['energysage','modernize','profitise','energyaid','oc-solar'].map(async id=>JSON.parse(await readFile(new URL(`../data/commercial/partners/${id}.json`,import.meta.url)))));const drill=preflightPriorityConflicts(first,[{state:'CA',county:'Orange',intent:'NEW_SOLAR'},{state:'CA',county:'Orange',intent:'PTO_RESCUE'},{state:'CA',county:'Alameda',intent:'PTO_RESCUE'},{state:'CA',county:'Alameda',intent:'PAY_PER_CALL'},{state:'CA',county:'Alameda',intent:'BATTERY_RETROFIT'}]);assert.equal(drill.ok,true);assert.deepEqual(drill.results.map(x=>x.selected),['energysage','oc-solar','energyaid','profitise','energysage']);});

test('retention covers the 30-day attribution window plus reporting buffer',()=>{const within={...base,timestamp:'2026-08-22T08:00:00.000Z'};assert.doesNotThrow(()=>aggregateOutbound({stage:'OUTBOUND_RECORDED',retention_days:RETENTION_DAYS,rows:[within]},{now:'2026-09-27T08:00:00.000Z'}));const expired={...base,timestamp:'2026-08-20T07:59:59.000Z'};assert.throws(()=>aggregateOutbound({stage:'OUTBOUND_RECORDED',retention_days:RETENTION_DAYS,rows:[expired]},{now:'2026-09-27T08:00:00.000Z'}));});
