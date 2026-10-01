import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcile,parseCsv,normalizeOutboundExport} from '../scripts/reconcile-compare-solar-cids.mjs';
const cid='0123456789abcdef01234567';
const event={stage:'OUTBOUND_RECORDED',cid,partner_id:'compare-solar-prices',page_path:'/california/irvine/solar-permit-guide/',city:'Irvine',intent:'NEW_SOLAR',cta_id:'compare_solar_prices_locality',timestamp:'2026-08-01T00:00:00Z'};
const outbound={stage:'OUTBOUND_RECORDED',retention_days:37,rows:[event]};
const partner={cid,quote_status:'qualified',quote_status_date:'2026-08-20T00:00:00Z',quote_payout:'25',install_status:'pending',install_status_date:'',install_payout:'0',reason_code:'',payment_period:'2026-08',paid_or_accrued:'accrued',quote_requested_at:'2026-08-10T00:00:00Z'};
const codes=r=>r.discrepancies.map(d=>d.code);
test('duplicate and case-varied duplicate CIDs cannot inflate money or qualified counts',()=>{
 for(const duplicate of [{...partner},{...partner,cid:cid.toUpperCase()},{...partner,quote_status:'unqualified',quote_payout:'0'}]){
  const r=reconcile(outbound,[partner,duplicate]);assert.ok(codes(r).includes('duplicate_partner_cid'));
  assert.equal(r.summary.unique_partner_cids,1);assert.equal(r.summary.quarantined_partner_rows,2);
  assert.equal(r.summary.qualified_quotes,0);assert.equal(r.summary.expected_total_payout_usd,null);
  assert.equal(r.summary.reported_total_payout_usd,null);assert.equal(r.fully_reconciled,false);
 }
});
test('qualification after day30 is valid when request submission was within day30',()=>{
 const r=reconcile(outbound,[{...partner,quote_status_date:'2026-09-05T00:00:00Z'}]);
 assert.equal(r.summary.errors,0);assert.equal(r.summary.expected_total_payout_usd,25);
 assert.equal(r.fully_reconciled,true);assert.equal(r.commission_paid_usd,null);
});
test('missing request date remains unknown rather than using qualification date',()=>{
 const p={...partner};delete p.quote_requested_at;const r=reconcile(outbound,[p]);
 assert.ok(codes(r).includes('quote_request_date_missing'));assert.equal(r.fully_reconciled,false);
 assert.equal(r.summary.qualified_quotes,0);assert.equal(r.summary.qualified_quotes_unverified,1);
 assert.equal(r.summary.expected_total_payout_usd,null);assert.equal(r.summary.reported_total_payout_usd,25);
});
test('request boundary is inclusive at day30 and rejects a later request',()=>{
 const at=reconcile(outbound,[{...partner,quote_requested_at:'2026-08-31T00:00:00Z',quote_status_date:'2026-09-02T00:00:00Z'}]);
 const over=reconcile(outbound,[{...partner,quote_requested_at:'2026-08-31T00:00:01Z',quote_status_date:'2026-09-02T00:00:00Z'}]);
 assert.equal(at.summary.expected_total_payout_usd,25);assert.ok(codes(over).includes('quote_attribution_window_mismatch'));
 assert.equal(over.summary.expected_total_payout_usd,null);
});
test('request timestamps before click or after qualification fail closed',()=>{
 assert.ok(codes(reconcile(outbound,[{...partner,quote_requested_at:'2026-07-31T23:59:59Z'}])).includes('quote_before_click'));
 assert.ok(codes(reconcile(outbound,[{...partner,quote_requested_at:'2026-08-21T00:00:00Z'}])).includes('qualification_before_request'));
});
test('missing report rows and a paid label cannot establish received cash',()=>{
 const empty=reconcile(outbound,[]);assert.match(empty.partner_report_status,/NOT_PROOF_OF_NO_LEADS/);
 assert.equal(empty.fully_reconciled,false);assert.equal(empty.summary.expected_total_payout_usd,null);
 const labelled=reconcile(outbound,[{...partner,paid_or_accrued:'paid'}]);
 for(const r of [empty,labelled])for(const key of ['commission_approved_usd','commission_payable_usd','commission_paid_usd'])assert.equal(r[key],null);
});
test('invalid partner CID is redacted and unknown statuses cannot become money',()=>{
 const bad=reconcile(outbound,[{...partner,cid:'private-contact@example.test'}]);
 assert.equal(bad.summary.expected_total_payout_usd,null);assert.ok(!JSON.stringify(bad).includes('private-contact'));
 const other=reconcile(outbound,[{...partner,quote_status:'likely'}]);assert.ok(codes(other).includes('unrecognized_partner_status'));
});
test('no-PII schema rejects extra direct or CSV columns; export CIDs normalize case for dedupe',()=>{
 assert.throws(()=>reconcile(outbound,[{...partner,email:'private@example.test'}]),/privacy-safe/);
 const cols=Object.keys(partner).concat('notes');assert.throws(()=>parseCsv(cols.join(',')+'\n'),/unexpected report column/);
 assert.throws(()=>normalizeOutboundExport({...outbound,rows:[event,{...event,cid:cid.toUpperCase()}]}),/Duplicate/);
});
test('invalid calendar dates and timestamps without UTC are not accepted as request evidence',()=>{
 for(const value of ['2026-02-30T00:00:00Z','2026-08-10','2026-08-10T00:00:00','not-a-date']){
  const r=reconcile(outbound,[{...partner,quote_requested_at:value}]);
  assert.ok(codes(r).includes('invalid_quote_request_date'),value);assert.equal(r.summary.expected_total_payout_usd,null);
 }
});

test('unmatched partner outcomes are separated from verified headline counts',()=>{
 const other='89abcdef0123456789abcdef';
 const q=reconcile(outbound,[{...partner,cid:other}]);
 assert.equal(q.summary.qualified_quotes,0);assert.equal(q.summary.qualified_quotes_unverified,1);
 const f=reconcile(outbound,[{...partner,cid:other,quote_status:'unqualified',quote_payout:'0',reason_code:'not_qualified',install_status:'funded',install_status_date:'2026-09-20T00:00:00Z',install_payout:'200'}]);
 assert.equal(f.summary.funded_installs,0);assert.equal(f.summary.funded_installs_unverified,1);
});
test('errored matched outcomes do not inflate verified headline counts',()=>{
 const q=reconcile(outbound,[{...partner,quote_payout:'999'}]);
 assert.ok(codes(q).includes('quote_payout_mismatch'));assert.equal(q.summary.qualified_quotes,0);assert.equal(q.summary.qualified_quotes_unverified,1);
 const f=reconcile(outbound,[{...partner,install_status:'funded',install_status_date:'',install_payout:'200'}]);
 assert.ok(codes(f).includes('invalid_install_status_date'));assert.equal(f.summary.funded_installs,0);assert.equal(f.summary.funded_installs_unverified,1);
});
