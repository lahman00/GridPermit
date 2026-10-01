#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { ATTRIBUTION_DAYS, RETENTION_DAYS } from "../src/lib/commercial/outbound-service.mjs";

const CID_RE=/^[a-f0-9]{24}$/i;
const QUOTE_PAYOUT=25, INSTALL_PAYOUT=200;
const FORBIDDEN_PII_HEADER=/(^|_)(first_?name|last_?name|full_?name|name|email|e_?mail|phone|telephone|mobile|street|address|postal_?address|ip|ip_?address|utility_?account|account_?number|bill_?amount|ssn|tin|tax_?id)(_|$)/i;
const PARTNER_HEADERS=["cid","quote_status","quote_status_date","quote_payout","install_status","install_status_date","install_payout","reason_code","payment_period","paid_or_accrued"];

export function parseCsv(text,sourceName="partner.csv"){
 let rows=[],row=[],field="",quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else quoted=false;}else field+=c;continue;}if(c==='"')quoted=true;else if(c===','){row.push(field);field="";}else if(c==='\n'){row.push(field.replace(/\r$/,""));rows.push(row);row=[];field="";}else field+=c;}
 if(quoted)throw new Error(sourceName+": unterminated quoted field");if(field.length||row.length){row.push(field.replace(/\r$/,""));rows.push(row);}
 rows=rows.filter(r=>r.some(v=>v.trim()!==""));if(!rows.length)throw new Error(sourceName+": missing header");
 const headers=rows[0].map(v=>v.trim());if(new Set(headers).size!==headers.length||headers.some(h=>!h))throw new Error(sourceName+": invalid headers");
 for(const h of headers)if(FORBIDDEN_PII_HEADER.test(h))throw new Error(sourceName+": forbidden PII-like header '"+h+"'");
 const missing=PARTNER_HEADERS.filter(h=>!headers.includes(h));if(missing.length)throw new Error(sourceName+": missing headers: "+missing.join(", "));
 return rows.slice(1).map((values,i)=>{if(values.length!==headers.length)throw new Error(sourceName+": row "+(i+2)+" column mismatch");return Object.fromEntries(headers.map((h,j)=>[h,values[j].trim()]));});
}
const money=v=>{if(v===""||v==null)return 0;const n=Number(String(v).replace(/[$,\s]/g,""));return Number.isFinite(n)?n:NaN;};
const when=v=>{const n=Date.parse(v);return Number.isFinite(n)?n:NaN;};
const status=v=>String(v??"").trim().toLowerCase().replace(/[\s-]+/g,"_");
const csv=v=>{v=String(v??"");return /[",\n\r]/.test(v)?'"'+v.replaceAll('"','""')+'"':v;};

export function normalizeOutboundExport(envelope){
 if(!envelope||envelope.stage!=="OUTBOUND_RECORDED"||envelope.retention_days!==RETENTION_DAYS||!Array.isArray(envelope.rows))throw new Error("Invalid current outbound export envelope");
 const rows=[],expected=["stage","cid","partner_id","page_path","city","intent","cta_id","timestamp"].sort();
 for(const r of envelope.rows){
  if(JSON.stringify(Object.keys(r).sort())!==JSON.stringify(expected)||r.stage!=="OUTBOUND_RECORDED"||!CID_RE.test(r.cid)||!r.page_path?.startsWith("/")||!Number.isFinite(when(r.timestamp)))throw new Error("Invalid no-PII outbound row");
  if(r.partner_id==="compare-solar-prices")rows.push(r);
 }
 const seen=new Set();for(const r of rows){if(seen.has(r.cid))throw new Error("Duplicate retained CompareSolarPrices CID");seen.add(r.cid);}
 return rows;
}

export function reconcile(outboundEnvelope,partnerRows){
 const clicks=normalizeOutboundExport(outboundEnvelope),byCid=new Map(clicks.map(r=>[r.cid.toLowerCase(),r]));
 const discrepancies=[],seenPartner=new Set();let qualified=0,funded=0,reportedQuote=0,reportedInstall=0;
 const add=(severity,code,cid,detail)=>discrepancies.push({severity,code,cid,detail});
 for(const p of partnerRows){
  const cid=p.cid.toLowerCase();if(!CID_RE.test(cid))add("error","invalid_partner_cid",p.cid,"CID must be 24 hexadecimal characters");
  if(seenPartner.has(cid))add("error","duplicate_partner_cid",p.cid,"CID appears more than once in partner report");seenPartner.add(cid);
  const click=byCid.get(cid);if(!click)add("error","cid_not_in_retained_outbound",p.cid,"CID is not present in the retained GridPermit outbound export. Do not infer that the referral is invalid; preserve partner evidence and investigate retention/export timing.");
  const qs=status(p.quote_status),ins=status(p.install_status),qp=money(p.quote_payout),ip=money(p.install_payout);reportedQuote+=Number.isFinite(qp)?qp:0;reportedInstall+=Number.isFinite(ip)?ip:0;
  if(!Number.isFinite(qp))add("error","invalid_quote_payout",p.cid,"quote_payout is not numeric");
  if(!Number.isFinite(ip))add("error","invalid_install_payout",p.cid,"install_payout is not numeric");
  if(qs==="qualified"){
   qualified++;if(qp!==QUOTE_PAYOUT)add("error","quote_payout_mismatch",p.cid,`Qualified quote expected $${QUOTE_PAYOUT}; reported $${p.quote_payout}`);
   const qd=when(p.quote_status_date);if(!Number.isFinite(qd))add("error","invalid_quote_status_date",p.cid,"Qualified quote needs a valid status date");
   if(click&&Number.isFinite(qd)){const days=(qd-when(click.timestamp))/86400000;if(days<0)add("error","quote_before_click",p.cid,"Qualified quote predates retained click");else if(days>ATTRIBUTION_DAYS)add("error","quote_attribution_window_mismatch",p.cid,`Qualified quote occurred ${days.toFixed(2)} days after click; expected <= ${ATTRIBUTION_DAYS}`);}
  } else if(Number.isFinite(qp)&&qp!==0)add("error","nonqualified_quote_has_payout",p.cid,"Non-qualified quote has non-zero payout");
  if(ins==="funded"){
   funded++;if(ip!==INSTALL_PAYOUT)add("error","install_payout_mismatch",p.cid,`Funded install expected $${INSTALL_PAYOUT}; reported $${p.install_payout}`);
   if(!Number.isFinite(when(p.install_status_date)))add("error","invalid_install_status_date",p.cid,"Funded install needs a valid status date");
  } else if(Number.isFinite(ip)&&ip!==0)add("error","nonfunded_install_has_payout",p.cid,"Non-funded install has non-zero payout");
  if(["unqualified","duplicate","reversed"].includes(qs)&&!p.reason_code)add("warning","missing_reason_code",p.cid,"Non-PII reason_code is recommended for this quote status");
 }
 const matched=partnerRows.filter(p=>byCid.has(p.cid.toLowerCase())).length;
 const errors=discrepancies.filter(x=>x.severity==="error").length,warnings=discrepancies.filter(x=>x.severity==="warning").length;
 return {generated_at:new Date().toISOString(),evidence_stage:"RECONCILIATION_ONLY",constants:{retention_days:RETENTION_DAYS,quote_attribution_days:ATTRIBUTION_DAYS,quote_payout_usd:QUOTE_PAYOUT,install_payout_usd:INSTALL_PAYOUT},summary:{retained_compare_solar_outbounds:clicks.length,partner_rows:partnerRows.length,matched_cids:matched,qualified_quotes:qualified,funded_installs:funded,expected_total_payout_usd:qualified*QUOTE_PAYOUT+funded*INSTALL_PAYOUT,reported_total_payout_usd:reportedQuote+reportedInstall,clicks_without_partner_row:clicks.filter(r=>!seenPartner.has(r.cid.toLowerCase())).length,errors,warnings},discrepancies};
}
function write(report,out){
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,"reconciliation.json"),JSON.stringify(report,null,2)+"\n");
 const h=["severity","code","cid","detail"];fs.writeFileSync(path.join(out,"discrepancies.csv"),h.join(",")+"\n"+report.discrepancies.map(r=>h.map(k=>csv(r[k])).join(",")).join("\n")+(report.discrepancies.length?"\n":""));
}
function args(argv){const o={};for(let i=0;i<argv.length;i++){const a=argv[i];if(a==="--self-test")o.self=true;else if(["--outbound","--partner","--out"].includes(a)){if(!argv[i+1])throw new Error("Missing "+a);o[a.slice(2)]=argv[++i];}else throw new Error("Unknown argument "+a);}return o;}
function selfTest(){
 const outbound={stage:"OUTBOUND_RECORDED",retention_days:RETENTION_DAYS,rows:[{stage:"OUTBOUND_RECORDED",cid:"0123456789abcdef01234567",partner_id:"compare-solar-prices",page_path:"/california/irvine/solar-permit-guide/",city:"Irvine",intent:"NEW_SOLAR",cta_id:"compare_solar_prices_locality",timestamp:"2026-09-01T12:00:00.000Z"}]};
 const partner=parseCsv("cid,quote_status,quote_status_date,quote_payout,install_status,install_status_date,install_payout,reason_code,payment_period,paid_or_accrued\n0123456789abcdef01234567,qualified,2026-09-20T12:00:00Z,25,funded,2026-10-20T12:00:00Z,200,,2026-09,accrued\n");
 const r=reconcile(outbound,partner);assert.equal(r.summary.errors,0);assert.equal(r.summary.expected_total_payout_usd,225);
 const d=fs.mkdtempSync(path.join(os.tmpdir(),"gp-reconcile-"));write(r,d);assert.ok(fs.existsSync(path.join(d,"reconciliation.json")));fs.rmSync(d,{recursive:true,force:true});console.log("Self-test passed");
}
function main(){try{const a=args(process.argv.slice(2));if(a.self)return selfTest();if(!a.outbound||!a.partner||!a.out)throw new Error("--outbound, --partner and --out are required");const outbound=JSON.parse(fs.readFileSync(a.outbound,"utf8"));const partner=parseCsv(fs.readFileSync(a.partner,"utf8"));const r=reconcile(outbound,partner);write(r,a.out);console.log(JSON.stringify(r.summary,null,2));if(r.summary.errors)process.exitCode=2;}catch(e){console.error(e instanceof Error?e.message:String(e));process.exitCode=1;}}
const isDirectRun=Boolean(process.argv[1])&&import.meta.url===pathToFileURL(process.argv[1]).href;
if(isDirectRun)main();
