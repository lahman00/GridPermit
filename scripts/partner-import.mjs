#!/usr/bin/env node
import {partnerEvidenceHold} from '../src/lib/commercial/partner-evidence-holds.ts';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';
import Ajv from 'ajv';import addFormats from 'ajv-formats';
import {parseCommercialCsv} from './lib/commercial-csv.mjs';
import {partnerConfigErrors,verificationErrors} from '../src/lib/commercial/partner-platform.ts';
import {fingerprint} from './lib/partner-config-io.mjs';
import {PARTNER_IMPORT_SCHEMA} from './lib/partner-import-schema.mjs';
const ajv=new Ajv({allErrors:true,strict:false});addFormats(ajv);const validate=ajv.compile(PARTNER_IMPORT_SCHEMA);
export function importPartnerCsv(text){
 const rows=parseCommercialCsv(text);if(rows.length>500)throw new Error('Batch limited to 500 partners');const seen=new Set();
 return rows.map(row=>{
  if(Object.keys(row).sort().join(',')!=='config_json,partner_id,verification_json')throw new Error('Explicit partner_id,config_json,verification_json schema required; no extra columns');
  const config=JSON.parse(row.config_json),verification=JSON.parse(row.verification_json);
  if(partnerConfigErrors(config).length||config.partner_id!==row.partner_id||seen.has(row.partner_id))throw new Error('Invalid or duplicate partner');seen.add(row.partner_id);
  if(verificationErrors(verification).length||verification.partner_id!==config.partner_id||verification.reference!==config.approval_reference||verification.config_sha256!==fingerprint(config)||verification.reviewed!==true)throw new Error('Verification must match the exact commercial configuration');
  return {config,verification,status:'REVIEWED_IMPORT_STAGED_NOT_ACTIVATED'};
 });
}
export function importActivationBundle(input,{now=new Date().toISOString()}={}){
 const bundle=typeof input==='string'?JSON.parse(input):input;
 if(!validate(bundle))throw new Error('Invalid activation bundle: '+ajv.errorsText(validate.errors));
 const seen=new Set();
 for(const {config:p,verification:v} of bundle.partners){
  if(seen.has(p.partner_id))throw new Error('Duplicate partner ID');seen.add(p.partner_id);
  if(partnerEvidenceHold(p))throw new Error('Partner evidence hold: '+partnerEvidenceHold(p));
  if(p.status!=='APPROVED')throw new Error('Only APPROVED partners may enter activation');
  if(partnerConfigErrors(p).length||verificationErrors(v).length||v.partner_id!==p.partner_id||v.reference!==p.approval_reference||v.config_sha256!==fingerprint(p))throw new Error('Approval/config binding mismatch');
  if(Date.parse(v.verified_at)>Date.parse(now)||Date.parse(p.last_verified)>Date.parse(now)||Date.parse(v.expires_at)<=Date.parse(now)||Date.parse(p.program.reverify_after)<=Date.parse(now))throw new Error('Stale or future approval/program verification');
  if(!p.categories.every(i=>v.approved_categories.includes(i)&&p.program.allowed_intents.includes(i)))throw new Error('Intent restrictions conflict');
  if(!p.program.allowed_tracking_types.includes(p.tracking_type))throw new Error('Tracking mode conflicts with program terms');
 }
 return structuredClone(bundle);
}
export function importActivationCsv(text,options){
 const rows=parseCommercialCsv(text);
 if(rows.some(r=>Object.keys(r).sort().join(',')!=='config_json,health_json,partner_id,verification_json'))throw new Error('Factory CSV requires partner_id,config_json,verification_json,health_json');
 const partners=rows.map(r=>{const config=JSON.parse(r.config_json);if(config.partner_id!==r.partner_id)throw new Error('CSV identity mismatch');return {config,verification:JSON.parse(r.verification_json),health:JSON.parse(r.health_json)};});
 return importActivationBundle({schema_version:3,partners},options);
}
async function main(){
 const a=process.argv.slice(2);if(a.length!==4||!['--csv','--json'].includes(a[0])||a[2]!=='--out')throw new Error('--json INPUT (or --csv INPUT) --out STAGING_DIR required');
 const text=await readFile(a[1],'utf8');const bundle=a[0]==='--json'?importActivationBundle(text):importActivationCsv(text);
 const out=path.resolve(a[3]);if(!out.split(path.sep).includes('output'))throw new Error('Imports must stage under output');await mkdir(out,{recursive:true});
 await writeFile(path.join(out,'PARTNER_IMPORT_REVIEW.json'),JSON.stringify(bundle,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({partners:bundle.partners.length,activated:0,out}));
}
const isDirectRun=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isDirectRun)main().catch(e=>{console.error(e.message);process.exitCode=1;});
