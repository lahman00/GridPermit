import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {load as loadYaml} from 'js-yaml';
import {assertPublicSafe,buildHebrewAutopilotReport,collectAutopilotFindings,emptyAutopilotState,publicAutopilotStatus,reconcileAutopilotState} from '../scripts/lib/autopilot-system.mjs';

const now='2026-10-09T10:00:00.000Z',commit='a'.repeat(40);
const operations={revenue:{stage_counts:{OUTBOUND_RECORDED:null,PARTNER_REPORTED_REFERRAL:null,QUALIFIED_LEAD:null,FUNDED_INSTALL:null,COMMISSION_APPROVED:null,COMMISSION_PAYABLE:null,COMMISSION_PAID:null},paid_revenue_cents:null}};
const health={ok:true,pages:462,paid_pages:86,failures:[],stale_programs:[],destination_failures:[]};
const probe={production:{available:true,ok:true,release_commit:commit},telemetry:{available:true,ok:true}};
const sources={outbound:'BLOCKED',partner_report:'BLOCKED',gsc:'BLOCKED',ga4:'BLOCKED',notifications:'BLOCKED'};

test('healthy unavailable evidence stays BLOCKED or UNKNOWN rather than zero',()=>{
  const findings=collectAutopilotFindings({operations,partnerHealth:health,probe,sources,expectedCommit:commit});
  assert.equal(findings.statuses.production,'VERIFIED');
  assert.equal(findings.statuses.telemetry,'VERIFIED');
  assert.equal(findings.statuses.partner_report,'BLOCKED');
  assert.equal(findings.counts.QUALIFIED_LEAD,null);
  assert.equal(findings.paid_revenue_cents,null);
});

test('failed source build does not imply a production outage or a successful release',()=>{
  const findings=collectAutopilotFindings({operations,partnerHealth:health,probe,sources,expectedCommit:commit,buildStatus:'failure'});
  assert.equal(findings.statuses.source_build,'NEEDS ATTENTION');
  assert.equal(findings.statuses.production,'VERIFIED');
  assert.equal(findings.statuses.telemetry,'VERIFIED');
  assert.deepEqual(findings.events.map(({code,severity})=>({code,severity})),[{code:'WORKFLOW_FAILURE',severity:'CRITICAL'}]);
  assert.equal(collectAutopilotFindings().statuses.source_build,'UNKNOWN');
});

test('expired partner evidence cannot look healthy when no eligible routes remain',()=>{
  const findings=collectAutopilotFindings({operations,partnerHealth:{...health,paid_pages:0,stale_programs:['synthetic-partner'],ok:false},probe,sources,expectedCommit:commit,buildStatus:'failure'});
  assert.equal(findings.statuses.commercial_routes,'NEEDS ATTENTION');
  assert.equal(findings.statuses.partner_programs,'NEEDS ATTENTION');
  assert.equal(findings.statuses.destination,'VERIFIED');
  assert.deepEqual(findings.events.map(x=>x.code),['WORKFLOW_FAILURE','EVIDENCE_EXPIRED']);
  const transition=reconcileAutopilotState({findings,mode:'weekly',now});
  for(const mode of ['daily','weekly']){
    const report=buildHebrewAutopilotReport({mode,now,findings,transition});
    assert.match(report,/לאמת מחדש את ראיות השותף/);
    assert.match(report,/לא להאריך תוקף/);
    assert.match(report,/UNKNOWN/);
  }
  assert.equal(collectAutopilotFindings().statuses.partner_programs,'UNKNOWN');
});

test('workflow continues independent evidence and reporting after build or audit failure without masking failed steps',async()=>{
  const workflow=loadYaml(await readFile(new URL('../.github/workflows/autopilot.yml',import.meta.url),'utf8'));
  const steps=workflow.jobs.operate.steps;
  const build=steps.find(s=>s.id==='build');
  assert.equal(build.run,'npm run build');
  assert.equal(build['continue-on-error'],undefined);
  const independent=['Probe production','Audit live','Record integration','Run the existing','Build daily'];
  for(const prefix of independent){
    const step=steps.find(s=>s.name?.startsWith(prefix));
    assert.equal(step['continue-on-error'],undefined);
    const expression=step.if.replace(/^\$\{\{\s*|\s*\}\}$/g,'');
    const context={cancelled:()=>false,steps:{install:{outcome:'success'},mode:{outcome:'success'},build:{outcome:'failure'}}};
    assert.equal(runInNewContext(expression,context),true,step.name);
    assert.equal(runInNewContext(expression,{...context,cancelled:()=>true}),false,step.name);
    assert.equal(runInNewContext(expression,{...context,steps:{...context.steps,install:{outcome:'failure'}}}),false,step.name);
  }
  const reporter=steps.find(s=>s.id==='autopilot');
  assert.equal(reporter.env.BUILD_STATUS,'${{ steps.build.outcome }}');
  assert.match(reporter.run,/--build-status "\$BUILD_STATUS"/);
  // Private export and delivery retain the default success() gate on a failed run.
  assert.equal(steps.find(s=>s.id==='outbound').if,undefined);
  assert.doesNotMatch(steps.find(s=>s.name?.startsWith('Deliver private')).if,/always\(|cancelled\(|failure\(/);
});

test('CLI writes both reports and public failure evidence after a failed build with expired approval',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'gp-autopilot-failure-'));
  const inputs={operations,health:{...health,paid_pages:0,stale_programs:['synthetic-partner'],ok:false},probe,sources};
  for(const [name,value] of Object.entries(inputs))await writeFile(path.join(root,name+'.json'),JSON.stringify(value));
  const result=spawnSync(process.execPath,[path.resolve(import.meta.dirname,'../scripts/gridpermit-autopilot.mjs'),'--mode','weekly','--build-status','failure','--out',path.join(root,'result'),'--operations',path.join(root,'operations.json'),'--partner-health',path.join(root,'health.json'),'--probe',path.join(root,'probe.json'),'--sources',path.join(root,'sources.json'),'--expected-commit',commit],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const summary=JSON.parse(result.stdout);
  assert.equal(summary.critical_alerts,1);
  const publicStatus=JSON.parse(await readFile(path.join(root,'result/AUTOPILOT_PUBLIC_STATUS.json'),'utf8'));
  assert.equal(publicStatus.statuses.source_build,'NEEDS ATTENTION');
  assert.equal(publicStatus.statuses.production,'VERIFIED');
  assert.equal(publicStatus.statuses.commercial_routes,'NEEDS ATTENTION');
  assert.equal(publicStatus.statuses.partner_programs,'NEEDS ATTENTION');
  assert.doesNotThrow(()=>assertPublicSafe(publicStatus));
  for(const name of ['DAILY_OPERATIONS_REPORT_HE.md','WEEKLY_OWNER_REPORT_HE.md'])assert.match(await readFile(path.join(root,'result',name),'utf8'),/לאמת מחדש את ראיות השותף/);
});

test('production, route, destination and telemetry failures create critical events',()=>{
  const findings=collectAutopilotFindings({operations,partnerHealth:{...health,failures:[{}],destination_failures:[{}]},probe:{production:{available:true,ok:false,release_commit:'b'.repeat(40)},telemetry:{available:true,ok:false}},sources,expectedCommit:commit});
  assert.deepEqual(new Set(findings.events.filter(item=>item.severity==='CRITICAL').map(item=>item.code)),new Set(['PRODUCTION_OUTAGE','RELEASE_DRIFT','ACTIVE_ROUTE_BROKEN','DESTINATION_BROKEN','TELEMETRY_CRITICAL']));
});

test('same unresolved alert is deduplicated until cooldown and state survives serialization',()=>{
  const findings=collectAutopilotFindings({operations,partnerHealth:{...health,failures:[{}]},probe,sources,expectedCommit:commit});
  const first=reconcileAutopilotState({findings,mode:'daily',now});
  assert.equal(first.notifications.length,1);
  const restored=JSON.parse(JSON.stringify(first.state));
  const second=reconcileAutopilotState({priorState:restored,findings,mode:'daily',now:'2026-10-09T11:00:00.000Z'});
  assert.equal(second.notifications.length,0);
  const afterCooldown=reconcileAutopilotState({priorState:second.state,findings,mode:'daily',now:'2026-10-13T11:00:00.000Z'});
  assert.equal(afterCooldown.notifications.length,1);
});

test('switching from daily to weekly does not count as an operational change',()=>{
  const findings=collectAutopilotFindings({operations,partnerHealth:health,probe,sources,expectedCommit:commit});
  const daily=reconcileAutopilotState({findings,mode:'daily',now});
  const weekly=reconcileAutopilotState({priorState:daily.state,findings,mode:'weekly',now:'2026-10-09T11:00:00.000Z'});
  assert.equal(weekly.changed,false);
  assert.equal(weekly.state.last_mode,'weekly');
});

test('new verified conversion stages alert only on an observed increase',()=>{
  const baseline=collectAutopilotFindings({operations:{revenue:{stage_counts:{...operations.revenue.stage_counts,QUALIFIED_LEAD:0},paid_revenue_cents:0}},partnerHealth:health,probe,sources,expectedCommit:commit});
  const first=reconcileAutopilotState({priorState:emptyAutopilotState(now),findings:baseline,mode:'daily',now});
  const changed=collectAutopilotFindings({operations:{revenue:{stage_counts:{...operations.revenue.stage_counts,QUALIFIED_LEAD:1},paid_revenue_cents:0}},partnerHealth:health,probe,sources,expectedCommit:commit});
  const second=reconcileAutopilotState({priorState:first.state,findings:changed,mode:'daily',now:'2026-10-09T12:00:00.000Z'});
  assert.equal(second.notifications[0].code,'NEW_VERIFIED_CONVERSION');
});

test('public output rejects private fields and secret-like values',()=>{
  assert.throws(()=>assertPublicSafe({cid:'0123456789abcdef01234567'}),/private field/);
  const syntheticToken=['g','hp_','abcdefghijklmnopqrstuvwxyz'].join('');
  assert.throws(()=>assertPublicSafe({message:syntheticToken}),/secret-like/);
});

test('Hebrew reports preserve UNKNOWN and weekly action logic',()=>{
  const findings=collectAutopilotFindings({operations,partnerHealth:health,probe,sources,expectedCommit:commit});
  const transition=reconcileAutopilotState({findings,mode:'weekly',now});
  assert.match(buildHebrewAutopilotReport({mode:'weekly',now,findings,transition}),/UNKNOWN/);
  assert.doesNotThrow(()=>publicAutopilotStatus({mode:'weekly',now,findings,transition}));
});

test('autopilot workflows are bounded, persistent and never merge or deploy',async()=>{
  const root=path.resolve(import.meta.dirname,'..');
  const workflow=await readFile(path.join(root,'.github/workflows/autopilot.yml'),'utf8');
  assert.equal((workflow.match(/cron:/g)??[]).length,1);
  assert.match(workflow,/concurrency:/);
  assert.match(workflow,/timeout-minutes: 15/);
  assert.match(workflow,/actions\/cache\/restore@v4/);
  assert.match(workflow,/actions\/cache\/save@v4/);
  assert.match(workflow,/NETLIFY_AUTH_TOKEN/);
  assert.doesNotMatch(workflow,/\$\{\{\s*runner\.temp\s*\}\}/);
  assert.doesNotMatch(workflow,/^\s+actions:\s+write$/m);
  assert.doesNotMatch(workflow,/gh pr merge|netlify deploy|curl.+\/go\//i);
  const ci=await readFile(path.join(root,'.github/workflows/ci.yml'),'utf8');
  assert.match(ci,/gridpermit-release-guardian/);
  assert.match(ci,/Partner health and commercial route preservation/);
  assert.doesNotMatch(ci,/gh pr merge|netlify deploy/i);
});

test('missing notification credentials fail closed before network access',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'gp-autopilot-'));
  const alerts=path.join(root,'alerts.json'),report=path.join(root,'report.md');
  await writeFile(alerts,JSON.stringify({alerts:[{code:'PRODUCTION_OUTAGE'}]}));
  await writeFile(report,'safe');
  const {spawnSync}=await import('node:child_process');
  const result=spawnSync(process.execPath,[path.resolve(import.meta.dirname,'../scripts/autopilot-notify.mjs'),'--alerts',alerts,'--report',report],{encoding:'utf8',env:{PATH:process.env.PATH}});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/not configured/);
});
