import test from "node:test";
import assert from "node:assert/strict";
import {parseCsv,normalizeOutboundExport,reconcile} from "../scripts/reconcile-compare-solar-cids.mjs";
import {RETENTION_DAYS} from "../src/lib/commercial/outbound-service.mjs";

const cid="0123456789abcdef01234567";
const outbound={stage:"OUTBOUND_RECORDED",retention_days:RETENTION_DAYS,rows:[{
 stage:"OUTBOUND_RECORDED",cid,partner_id:"compare-solar-prices",
 page_path:"/california/irvine/solar-permit-guide/",city:"Irvine",
 intent:"NEW_SOLAR",cta_id:"compare_solar_prices_locality",
 timestamp:"2026-09-01T12:00:00.000Z"
}]};
const partner=(line)=>parseCsv("cid,quote_status,quote_status_date,quote_payout,install_status,install_status_date,install_payout,reason_code,payment_period,paid_or_accrued,quote_requested_at\n"+line+",2026-09-10T12:00:00Z\n");

test("current outbound export reconciles a qualified quote and later funded install",()=>{
 const r=reconcile(outbound,partner(cid+",qualified,2026-09-20T12:00:00Z,25,funded,2026-10-20T12:00:00Z,200,,2026-09,accrued"));
 assert.equal(r.summary.errors,0);assert.equal(r.summary.matched_cids,1);assert.equal(r.summary.qualified_quotes,1);assert.equal(r.summary.qualified_quotes_unverified,0);assert.equal(r.summary.funded_installs,1);assert.equal(r.summary.funded_installs_unverified,0);assert.equal(r.summary.expected_total_payout_usd,225);
});
test("quote outside 30-day attribution is flagged while funded install has no invented time limit",()=>{
 const r=reconcile(outbound,partner(cid+",qualified,2026-10-05T12:00:00Z,25,funded,2026-12-20T12:00:00Z,200,,2026-10,accrued").map(r=>({...r,quote_requested_at:"2026-10-05T12:00:00Z"})));
 assert.equal(r.discrepancies.some(x=>x.code==="quote_attribution_window_mismatch"),true);
 assert.equal(r.discrepancies.some(x=>x.code.includes("install")&&x.code.includes("window")),false);
});
test("unknown partner CID is not silently treated as invalid lead",()=>{
 const other="89abcdef0123456789abcdef";
 const r=reconcile(outbound,partner(other+",qualified,2026-09-20T12:00:00Z,25,pending,,0,,2026-09,accrued"));
 const d=r.discrepancies.find(x=>x.code==="cid_not_in_retained_outbound");assert.ok(d);assert.match(d.detail,/Do not infer that the referral is invalid/);assert.equal(r.summary.qualified_quotes,0);assert.equal(r.summary.qualified_quotes_unverified,1);
});
test("PII-like partner report columns are rejected",()=>{
 assert.throws(()=>parseCsv("cid,email,quote_status,quote_status_date,quote_payout,install_status,install_status_date,install_payout,reason_code,payment_period,paid_or_accrued\n"+cid+",person@example.com,qualified,2026-09-20T12:00:00Z,25,pending,,0,,2026-09,accrued\n"),/forbidden PII-like header/);
});
test("old seven-day export envelope is rejected after retention migration",()=>{
 assert.throws(()=>normalizeOutboundExport({...outbound,retention_days:7}),/Invalid current outbound export envelope/);
});
