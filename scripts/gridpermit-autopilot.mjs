#!/usr/bin/env node
import {access,mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {buildHebrewAutopilotReport,collectAutopilotFindings,publicAutopilotStatus,reconcileAutopilotState} from './lib/autopilot-system.mjs';

const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i++){if(!['--mode','--out','--operations','--partner-health','--probe','--sources','--state','--expected-commit','--now'].includes(args[i])||!args[i+1])throw new Error(`Invalid option: ${args[i]}`);options[args[i].slice(2).replaceAll('-','_')]=args[++i];}
if(!['daily','weekly'].includes(options.mode)||!options.out||!options.operations||!options.partner_health||!options.probe||!options.sources||!/^[a-f0-9]{40}$/.test(options.expected_commit??''))throw new Error('Missing required autopilot options');
const json=async file=>JSON.parse(await readFile(file,'utf8')),optional=async file=>{if(!file)return null;try{return await json(file);}catch(error){if(error.code==='ENOENT')return null;throw error;}};
const now=options.now??new Date().toISOString();
const [operations,partnerHealth,probe,sources,priorState]=await Promise.all([json(options.operations),json(options.partner_health),json(options.probe),json(options.sources),optional(options.state)]);
const findings=collectAutopilotFindings({operations,partnerHealth,probe,sources,expectedCommit:options.expected_commit});
findings.operations_outbounds=Number.isSafeInteger(operations?.revenue?.stage_counts?.OUTBOUND_RECORDED)?operations.revenue.stage_counts.OUTBOUND_RECORDED:null;
const transition=reconcileAutopilotState({priorState,findings,mode:options.mode,now});
const report=buildHebrewAutopilotReport({mode:options.mode,now,findings,transition});
const dailyReport=buildHebrewAutopilotReport({mode:'daily',now,findings,transition});
const publicStatus=publicAutopilotStatus({mode:options.mode,now,findings,transition});
const out=path.resolve(options.out);try{await access(out);throw new Error(`Output already exists: ${out}`);}catch(error){if(error.code!=='ENOENT')throw error;}
const partial=`${out}.partial-${process.pid}`;try{await mkdir(partial);await writeFile(path.join(partial,'DAILY_OPERATIONS_REPORT_HE.md'),dailyReport,{flag:'wx'});if(options.mode==='weekly')await writeFile(path.join(partial,'WEEKLY_OWNER_REPORT_HE.md'),report,{flag:'wx'});await writeFile(path.join(partial,'AUTOPILOT_PUBLIC_STATUS.json'),JSON.stringify(publicStatus,null,2)+'\n',{flag:'wx'});await writeFile(path.join(partial,'AUTOPILOT_STATE.json'),JSON.stringify(transition.state,null,2)+'\n',{flag:'wx'});await writeFile(path.join(partial,'ALERT_NOTIFICATION.json'),JSON.stringify({schema_version:1,generated_at:now,alerts:transition.notifications.map(({code,severity,subject})=>({code,severity,subject})),external_notification_sent:false},null,2)+'\n',{flag:'wx'});await rename(partial,out);}catch(error){await rm(partial,{recursive:true,force:true});throw error;}
console.log(JSON.stringify({mode:options.mode,out,new_alerts:transition.notifications.length,critical_alerts:transition.notifications.filter(item=>item.severity==='CRITICAL').length,changed:transition.changed},null,2));
