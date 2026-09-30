#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';import vm from 'node:vm';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {buildCompareSolarReferralUrl} from '../src/lib/compare-solar-prices.ts';
export function verifyCspDeepLink(html){
 const start=html.indexOf('// Referral tracking — captures'),end=html.indexOf('// FAQ accordion',start);
 if(start<0||end<=start)throw new Error('Partner tracking source changed; inspect before updating test');
 const script=html.slice(start,end).replace(/<\/script>[\s\S]*$/,'');
 const cid='abc123abc123abc123abc123',url=new URL(buildCompareSolarReferralUrl('CA','Escondido',cid));
 const runs=[];
 for(const storageBlocked of [false,true]){
  const field={value:''},store=new Map();
  const context={URLSearchParams,Date,window:{location:{search:url.search}},document:{getElementById:id=>id==='referral'?field:null},localStorage:{setItem:(k,v)=>{if(storageBlocked)throw new Error('storage unavailable');store.set(k,v);},getItem:k=>store.get(k),removeItem:k=>store.delete(k)},sessionStorage:{getItem:()=>null}};
  // No fetch, network, browser, form events, customer data or telemetry exists
  // in this deliberately limited runtime.
  vm.runInNewContext(script,context,{timeout:1000});
  if(field.value!=='GridPermit|'+cid)throw new Error('Attribution did not reach form field');
  runs.push({storageBlocked,field_received_ref_and_cid:true});
 }
 if(url.hash!=='#quote'||url.pathname!=='/'||url.searchParams.get('ref')!=='GridPermit'||!html.match(/id=["']quote["']/)||!html.match(/id=["']referral["']/))throw new Error('Deep-link contract failure');
 return {status:'PASS',verification_mode:'EXACT_LIVE_SCRIPT_EXECUTED_OFFLINE_NO_SYNTHETIC_PARTNER_TRAFFIC',homepage_sha256:createHash('sha256').update(html).digest('hex'),script_sha256:createHash('sha256').update(script).digest('hex'),query_before_fragment:true,quote_anchor_exists:true,referral_field_exists:true,runs,commercial_approval_reference:'gmail:1a03a05e3fd3f646',live_form_submitted:false,live_partner_report_verified:false};
}
async function main(){const a=process.argv.slice(2);if(a.length!==4||a[0]!=='--html'||a[2]!=='--out')throw new Error('--html captured.html --out report.json required');const result=verifyCspDeepLink(await readFile(a[1],'utf8'));await writeFile(a[3],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));}
const isDirectRun=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isDirectRun)main().catch(e=>{console.error(e.message);process.exitCode=1;});
