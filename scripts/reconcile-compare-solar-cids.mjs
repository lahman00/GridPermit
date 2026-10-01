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
const OPTIONAL_PARTNER_HEADERS=["quote_requested_at"];
const PARTNER_HEADERS=["cid","quote_status","quote_status_date","quote_payout","install_status","install_status_date","install_payout","reason_code","payment_period","paid_or_accrued"];

export function parseCsv(text,sourceName="partner.csv"){
 let rows=[],row=[],field="",quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else quoted=false;}else field+=c;continue;}if(c==='"')quoted=true;else if(c===','){row.push(field);field="";}else if(c==='\n'){row.push(field.replace(/\r$/,""));rows.push(row);row=[];field="";}else field+=c;}
 if(quoted)throw new Error(sourceName+": unterminated quoted field");if(field.length||row.length){row.push(field.replace(/\r$/,""));rows.push(row);}
 rows=rows.filter(r=>r.some(v=>v.trim()!==""));if(!rows.length)throw new Error(sourceName+": missing header");
 const headers=rows[0].map(v=>v.trim());if(new Set(headers).size!==headers.length||headers.some(h=>!h))throw new Error(sourceName+": invalid headers");
 for(const h of headers)if(FORBIDDEN_PII_HEADER.test(h))throw new Error(sourceName+": forbidden PII-like header '"+h+"'");
 if(headers.some(h=>!PARTNER_HEADERS.includes(h)&&!OPTIONAL_PARTNER_HEADERS.includes(h)))throw new Error(sourceName+": unexpected report column");
 const missing=PARTNER_HEADERS.filter(h=>!headers.includes(h));if(missing.length)throw new Error(sourceName+": missing headers: "+missing.join(", "));
 return rows.slice(1).map((values,i)=>{if(values.length!==headers.length)throw new Error(sourceName+": row "+(i+2)+" column mismatch");return Object.fromEntries(headers.map((h,j)=>[h,values[j].trim()]));});
}
const money=v=>{if(v===""||v==null)return 0;const n=Number(String(v).replace(/[$,\s]/g,""));return Number.isFinite(n)?n:NaN;};
const when=v=>{const n=Date.parse(v);return Number.isFinite(n)?n:NaN;};
const validUtc=v=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v)&&Number.isFinite(when(v))&&new Date(v).toISOString()===v.replace(/(?<!\.\d{3})Z$/,".000Z");
const status=v=>String(v??"").trim().toLowerCase().replace(/[\s-]+/g,"_");
const csv=v=>{v=String(v??"");return /[",\n\r]/.test(v)?'"'+v.replaceAll('"','""')+'"':v;};

export function normalizeOutboundExport(envelope){
 if(!envelope||envelope.stage!=="OUTBOUND_RECORDED"||envelope.retention_days!==RETENTION_DAYS||!Array.isArray(envelope.rows))throw new Error("Invalid current outbound export envelope");
 const rows=[],expected=["stage","cid","partner_id","page_path","city","intent","cta_id","timestamp"].sort();
 for(const r of envelope.rows){
  if(JSON.stringify(Object.keys(r).sort())!==JSON.stringify(expected)||r.stage!=="OUTBOUND_RECORDED"||!CID_RE.test(r.cid)||!r.page_path?.startsWith("/")||!Number.isFinite(when(r.timestamp)))throw new Error("Invalid no-PII outbound row");
  if(r.partner_id==="compare-solar-prices")rows.push(r);
 }
 const seen=new Set();for(const r of rows){if(seen.has(r.cid.toLowerCase()))throw new Error("Duplicate retained CompareSolarPrices CID");seen.add(r.cid.toLowerCase());}
 return rows;
}

export function reconcile(outboundEnvelope,partnerRows){
 const clicks=normalizeOutboundExport(outboundEnvelope),byCid=new Map(clicks.map(r=>[r.cid.toLowerCase(),r]));
 const discrepancies=[],seenPartner=new Set();let qualified=0,qualifiedUnverified=0,funded=0,fundedUnverified=0,reportedQuote=0,reportedInstall=0;
 const add=(severity,code,cid,detail)=>discrepancies.push({severity,code,cid,detail});
 if(!Array.isArray(partnerRows))throw new Error("Partner rows must be an array");
 const groups=new Map();
 for(const p of partnerRows){
  if(!p||typeof p!=="object"||Object.keys(p).some(k=>!PARTNER_HEADERS.includes(k)&&!OPTIONAL_PARTNER_HEADERS.includes(k))||PARTNER_HEADERS.some(k=>typeof p[k]!=="string"))throw new Error("Invalid privacy-safe partner row");
  if(!CID_RE.test(p.cid)){add("error","invalid_partner_cid","","CID must be 24 hexadecimal characters; invalid value withheld");continue;}
  const key=p.cid.toLowerCase();groups.set(key,[...(groups.get(key)??[]),p]);
 }
 for(const [cid,group] of groups){
  seenPartner.add(cid);
  if(group.length!==1){add("error","duplicate_partner_cid",cid,"Multiple rows for this CID are excluded from outcome and amount totals until resolved; no first/last row is silently chosen.");continue;}
  const p=group[0];
  if(!["qualified","unqualified","pending","duplicate","reversed","unknown"].includes(status(p.quote_status))||!["funded","not_funded","pending","unknown"].includes(status(p.install_status))){add("error","unrecognized_partner_status",cid,"Unsupported status; normalize from the original statement without guessing.");continue;}
  const issueStart=discrepancies.length;
  const click=byCid.get(cid);if(!click)add("error","cid_not_in_retained_outbound",p.cid,"CID is not present in the retained GridPermit outbound export. Do not infer that the referral is invalid; preserve partner evidence and investigate retention/export timing.");
  const qs=status(p.quote_status),ins=status(p.install_status),qp=money(p.quote_payout),ip=money(p.install_payout);reportedQuote+=Number.isFinite(qp)?qp:0;reportedInstall+=Number.isFinite(ip)?ip:0;
  if(!Number.isFinite(qp))add("error","invalid_quote_payout",p.cid,"quote_payout is not numeric");
  if(!Number.isFinite(ip))add("error","invalid_install_payout",p.cid,"install_payout is not numeric");
  if(qs==="qualified"){
   if(qp!==QUOTE_PAYOUT)add("error","quote_payout_mismatch",p.cid,`Qualified quote expected $${QUOTE_PAYOUT}; reported amount differs`);
   const qd=when(p.quote_status_date);if(!Number.isFinite(qd))add("error","invalid_quote_status_date",p.cid,"Qualified quote needs a valid status date");
   // The commercial clock ends at request submission, NOT later qualification.
   // Never substitute quote_status_date when the submission date is missing.
   const requestedAt=p.quote_requested_at;
   if(!requestedAt)add("warning","quote_request_date_missing",cid,"Quote request date is unknown; qualification date is not a substitute. Attribution remains unverified.");
   else {
    const requestAt=when(requestedAt);
    if(!validUtc(requestedAt))add("error","invalid_quote_request_date",cid,"quote_requested_at must be an explicit valid UTC timestamp");
    else {
     if(Number.isFinite(qd)&&qd<requestAt)add("error","qualification_before_request",cid,"Qualification predates request; verify the source dates.");
     if(click){const elapsed=requestAt-when(click.timestamp);if(elapsed<0)add("error","quote_before_click",cid,"Quote request predates retained click");else if(elapsed>ATTRIBUTION_DAYS*86400000)add("error","quote_attribution_window_mismatch",cid,"Quote request occurred outside the 30-day click-to-request window.");}
    }
   }
  } else if(Number.isFinite(qp)&&qp!==0)add("error","nonqualified_quote_has_payout",p.cid,"Non-qualified quote has non-zero payout");
  if(ins==="funded"){
   if(ip!==INSTALL_PAYOUT)add("error","install_payout_mismatch",p.cid,`Funded install expected $${INSTALL_PAYOUT}; reported amount differs`);
   if(!Number.isFinite(when(p.install_status_date)))add("error","invalid_install_status_date",p.cid,"Funded install needs a valid status date");
  } else if(Number.isFinite(ip)&&ip!==0)add("error","nonfunded_install_has_payout",p.cid,"Non-funded install has non-zero payout");
  if(["unqualified","duplicate","reversed"].includes(qs)&&!p.reason_code)add("warning","missing_reason_code",p.cid,"Non-PII reason_code is recommended for this quote status");
  const rowVerified=Boolean(click)&&discrepancies.slice(issueStart).length===0;
  if(qs==="qualified"){if(rowVerified)qualified++;else qualifiedUnverified++;}
  if(ins==="funded"){if(rowVerified)funded++;else fundedUnverified++;}
 }
 const matched=[...groups].filter(([cid,group])=>group.length===1&&byCid.has(cid)).length;
 const errors=discrepancies.filter(x=>x.severity==="error").length,warnings=discrepancies.filter(x=>x.severity==="warning").length;
 const fullyReconciled=partnerRows.length>0&&errors===0&&warnings===0;
 return {partner_report_status:partnerRows.length?"ROWS_PROVIDED_AUTHENTICITY_REQUIRES_OPERATOR_VERIFICATION":"NO_ROWS_PROVIDED_NOT_PROOF_OF_NO_LEADS",fully_reconciled:fullyReconciled,commission_approved_usd:null,commission_payable_usd:null,commission_paid_usd:null,generated_at:new Date().toISOString(),evidence_stage:"RECONCILIATION_ONLY",constants:{retention_days:RETENTION_DAYS,quote_attribution_days:ATTRIBUTION_DAYS,quote_payout_usd:QUOTE_PAYOUT,install_payout_usd:INSTALL_PAYOUT},summary:{retained_compare_solar_outbounds:clicks.length,partner_rows:partnerRows.length,matched_cids:matched,qualified_quotes:qualified,qualified_quotes_unverified:qualifiedUnverified,funded_installs:funded,funded_installs_unverified:fundedUnverified,expected_total_payout_usd:fullyReconciled?qualified*QUOTE_PAYOUT+funded*INSTALL_PAYOUT:null,reported_total_payout_usd:errors?null:reportedQuote+reportedInstall,quarantined_partner_rows:[...groups.values()].filter(g=>g.length>1).reduce((n,g)=>n+g.length,0),unique_partner_cids:groups.size,clicks_without_partner_row:clicks.filter(r=>!seenPartner.has(r.cid.toLowerCase())).length,errors,warnings},discrepancies};
}
function write(report,out){
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,"reconciliation.json"),JSON.stringify(report,null,2)+"\n");
 const h=["severity","code","cid","detail"];fs.writeFileSync(path.join(out,"discrepancies.csv"),h.join(",")+"\n"+report.discrepancies.map(r=>h.map(k=>csv(r[k])).join(",")).join("\n")+(report.discrepancies.length?"\n":""));
}
function args(argv){const o={};for(let i=0;i<argv.length;i++){const a=argv[i];if(a==="--self-test")o.self=true;else if(["--outbound","--partner","--out"].includes(a)){if(!argv[i+1])throw new Error("Missing "+a);o[a.slice(2)]=argv[++i];}else throw new Error("Unknown argument "+a);}return o;}
function selfTest(){
 const outbound={stage:"OUTBOUND_RECORDED",retention_days:RETENTION_DAYS,rows:[{stage:"OUTBOUND_RECORDED",cid:"0123456789abcdef01234567",partner_id:"compare-solar-prices",page_path:"/california/irvine/solar-permit-guide/",city:"Irvine",intent:"NEW_SOLAR",cta_id:"compare_solar_prices_locality",timestamp:"2026-09-01T12:00:00.000Z"}]};
 const partner=parseCsv("cid,quote_status,quote_status_date,quote_payout,install_status,install_status_date,install_payout,reason_code,payment_period,paid_or_accrued,quote_requested_at\n0123456789abcdef01234567,qualified,2026-09-20T12:00:00Z,25,funded,2026-10-20T12:00:00Z,200,,2026-09,accrued,2026-09-10T12:00:00Z\n");
 const r=reconcile(outbound,partner);assert.equal(r.summary.errors,0);assert.equal(r.summary.expected_total_payout_usd,225);
 const d=fs.mkdtempSync(path.join(os.tmpdir(),"gp-reconcile-"));write(r,d);assert.ok(fs.existsSync(path.join(d,"reconciliation.json")));fs.rmSync(d,{recursive:true,force:true});console.log("Self-test passed");
}
function main(){try{const a=args(process.argv.slice(2));if(a.self)return selfTest();if(!a.outbound||!a.partner||!a.out)throw new Error("--outbound, --partner and --out are required");const outbound=JSON.parse(fs.readFileSync(a.outbound,"utf8"));const partner=parseCsv(fs.readFileSync(a.partner,"utf8"));const r=reconcile(outbound,partner);write(r,a.out);console.log(JSON.stringify(r.summary,null,2));if(r.summary.errors)process.exitCode=2;}catch(e){console.error(e instanceof Error?e.message:String(e));process.exitCode=1;}}
const isDirectRun=Boolean(process.argv[1])&&import.meta.url===pathToFileURL(process.argv[1]).href;
if(isDirectRun)main();
