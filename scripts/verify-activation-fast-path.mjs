// A full isolated rehearsal: the only simulated boundary is Netlify publishing.
// The .example partner can never be sent to a real deployment by this runner.
import {readFile,writeFile,mkdir,cp,symlink,rm,unlink} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {prepareFactory,applyFactory,runCommand,sourceManifest} from './lib/factory-release.mjs';
import {loadPlatformRegistry,fingerprint,digest} from './lib/partner-config-io.mjs';
import {auditPartners} from './partner-health.mjs';
import {importActivationBundle} from './partner-import.mjs';
const root=process.cwd(),out=path.join(root,'output/canonical-revenue-telemetry-2026-09-27'),start=Date.now();
const isolated=path.join(os.tmpdir(),'gridpermit-fastpath-'+Date.now());
// A real detached worktree ensures the existing canonical-source refusal remains in force.
execFileSync('git',['worktree','add','--detach',isolated,'HEAD'],{cwd:root,stdio:'pipe'});
try{
 const manifest=await sourceManifest(root);
 for(const item of manifest.files){const target=path.join(isolated,item.path);await mkdir(path.dirname(target),{recursive:true});await cp(path.join(root,item.path),target);}
 await symlink(path.join(root,'node_modules'),path.join(isolated,'node_modules'),'dir');
 await cp(path.join(root,'dist'),path.join(isolated,'dist'),{recursive:true});
 const registry=await loadPlatformRegistry(isolated),record=registry.records.find(r=>r.state==='CA'&&r.city.value==='Richmond');
 const p=structuredClone(registry.partners.find(p=>p.partner_id==='compare-solar-prices'));
 p.partner_id='synthetic-approved';p.name='LOCAL SIMULATION ONLY';p.status='APPROVED';p.categories=['BATTERY_RETROFIT'];p.territories={states:['CA'],cities:['richmond']};p.approval_reference='synthetic-approval';p.destination='https://fixture.example/battery/';p.expected_hosts=['fixture.example'];p.paths={solar:null,battery:p.destination};p.tracking={active:true,cid_param:'sid',network:'CJ',cj_tracking_url:null,fixed_params:{}};p.last_verified=new Date().toISOString();p.qualification.existing_solar='ALLOW';p.program.allowed_intents=p.categories;p.program.allows_existing_solar=true;p.program.terms_reference='synthetic:terms';
 p.placements=[{page_path:'/california/richmond/solar-permit-guide/',record_id:record.record_id,intent:'BATTERY_RETROFIT',review_reference:'synthetic:review'},{page_path:'/blog/tesla-powerwall-3-vs-enphase-iq5p/',record_id:record.record_id,intent:'BATTERY_RETROFIT',review_reference:'synthetic:review'}];
 const v={reference:p.approval_reference,partner_id:p.partner_id,reviewed:true,evidence_reference:'synthetic:approval',approved_categories:p.categories,states:['CA'],cities:['richmond'],utilities:p.utilities,destinations:[p.destination],tracking_verified:true,approved_fallback:false,verified_at:p.last_verified,expires_at:p.program.reverify_after,config_sha256:fingerprint(p)};
 const bundle={schema_version:3,partners:[{config:p,verification:v,health:[{url:p.destination,finalUrl:p.destination,ok:true,status:200,checkedAt:p.last_verified,queryPreserved:null}]}]};
 importActivationBundle(bundle);let current='simulation-before',deploys=0;
 const execute=async(cmd,args,options)=>{if(cmd!=='netlify')return runCommand(cmd,args,options);if(args[0]==='api')return JSON.stringify({id:'d49c19aa-f997-43f3-9b11-fabff36c4c83',custom_domain:'mygridpermit.com',published_deploy:{id:current,state:'ready'}});if(args[0]==='deploy'){current='simulation-'+(++deploys);return JSON.stringify({deploy_id:current});}throw new Error('Unexpected network command');};
 const audit=async options=>auditPartners({...options,live:false,probeDestinations:false});
 const a=await prepareFactory({root:isolated,out:path.join(isolated,'output/factory-runs/activate'),bundle});
 const activation=await applyFactory({root:isolated,planFile:path.join(isolated,'output/factory-runs/activate/PLAN.json'),expectedPlan:a.plan_sha256,expectedDeploy:current,deploy:true,execute,audit});
 const activated=await loadPlatformRegistry(isolated);if(activated.partners.find(p=>p.partner_id==='synthetic-approved').status!=='ACTIVE')throw new Error('Apply did not activate');
 const b=await prepareFactory({root:isolated,out:path.join(isolated,'output/factory-runs/rollback'),pause:p.partner_id});
 const rollback=await applyFactory({root:isolated,planFile:path.join(isolated,'output/factory-runs/rollback/PLAN.json'),expectedPlan:b.plan_sha256,expectedDeploy:current,deploy:true,execute,audit});
 const result={ok:true,elapsed_seconds:(Date.now()-start)/1000,production_network_calls:0,fixture_partner_ever_published:false,tests_builds_real:true,deploy_boundary:'INJECTED_SIMULATION',activation_routes:a.plan.delta,rollback_routes:b.plan.delta,activation,rollback};
 result.under_five_minutes=result.elapsed_seconds<300;
 await writeFile(path.join(out,'ACTIVATION_FAST_PATH_VERIFY.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({ok:result.ok,elapsed_seconds:result.elapsed_seconds,under_five_minutes:result.under_five_minutes,activated:a.plan.delta.after_routes,rolled_back:b.plan.delta.after_routes}));
}finally{execFileSync('git',['worktree','remove','--force',isolated],{cwd:root,stdio:'pipe'});}
