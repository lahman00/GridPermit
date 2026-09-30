#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {commercialCsv} from './lib/commercial-csv.mjs';import {aggregateOutbound,importCodexHandoffs,revenueLedger,firstLeadAlert,coverageReport,TOP8} from './lib/live-revenue-ops.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function runLiveRevenueOps({root=ROOT,out,outbound,handoffs,now=new Date().toISOString()}={}){
 if(!out||!outbound)throw new Error('Output directory and private outbound export required');await mkdir(out,{recursive:false});
 const exported=JSON.parse(await readFile(outbound,'utf8')),aggregated=aggregateOutbound(exported,{now});
 const partners=[];for(const partner_id of TOP8)partners.push(JSON.parse(await readFile(path.join(root,'data/commercial/partners',partner_id+'.json'),'utf8')));
 let handoff={status:'MISSING_CODEX_HANDOFFS_NO_IMPORT_NO_ACTIVATION',path:handoffs??null,accepted:[],rejected:0};if(handoffs){try{handoff={status:'VALIDATED_NOT_ACTIVATED',path:path.resolve(handoffs),accepted:importCodexHandoffs(JSON.parse(await readFile(handoffs,'utf8')),{now}),rejected:0};}catch(error){handoff={status:'REJECTED_NO_ACTIVATION',path:path.resolve(handoffs),accepted:[],rejected:1,error:error.message};}}
 const ledger=revenueLedger(aggregated.rows),alert=firstLeadAlert(ledger),partnerRows=partners.map(p=>({partner_id:p.partner_id,status:p.status,placement:p.placement,priority:p.priority,intents:p.categories.join(';'),territory:JSON.stringify(p.territories),tracking_active:p.tracking.active,approval_reference:p.approval_reference??'',destination:p.destination??'',activation_ready:p.status==='APPROVED'&&p.tracking.active&&Boolean(p.approval_reference)&&Boolean(p.destination),blocker:p.approval_reference?'TRACKING_OR_DESTINATION_OR_STATUS':'REAL_APPROVAL_AND_TRACKING_REQUIRED'}));
 await writeFile(path.join(out,'OUTBOUND_REPORT.csv'),commercialCsv(aggregated.report,['window','dimension','value','count','truth']));
 await writeFile(path.join(out,'REVENUE_LEDGER.csv'),commercialCsv(ledger,['event_id','stage','cid','partner_id','timestamp','evidence_ref','amount_cents','currency','payment_evidence_ref']));
 await writeFile(path.join(out,'PARTNER_HEALTH.csv'),commercialCsv(partnerRows));
 await writeFile(path.join(out,'COVERAGE_REPORT.json'),JSON.stringify(coverageReport(partners,aggregated.report),null,2)+'\n');
 await writeFile(path.join(out,'TELEMETRY_HEALTH.json'),JSON.stringify(aggregated.health,null,2)+'\n');
 await writeFile(path.join(out,'ACTIVATION_PIPELINE_VERIFY.json'),JSON.stringify({generated_at:now,handoff,first_lead_alert:alert,activated_partners:partnerRows.filter(x=>x.activation_ready).map(x=>x.partner_id),truth:'CONFIGURATION_ONLY; NO PARTNER ACTIVATED'},null,2)+'\n');
 return {telemetry:aggregated.health,handoff,ledger_rows:ledger.length,first_lead_alert:alert};
}
async function main(){const a=process.argv.slice(2),o={};for(let i=0;i<a.length;i++){if(!['--root','--out','--outbound','--handoffs','--now'].includes(a[i])||!a[i+1])throw new Error('Invalid option');o[a[i].slice(2)]=a[++i];}console.log(JSON.stringify(await runLiveRevenueOps(o),null,2));}
const isDirectRun=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);if(isDirectRun)main().catch(e=>{console.error(e.message);process.exitCode=1;});
