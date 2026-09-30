import {readFile,writeFile,mkdir,copyFile,symlink,readdir,stat,unlink} from 'node:fs/promises';
import path from 'node:path';import {createHash,randomUUID} from 'node:crypto';import {spawn} from 'node:child_process';
import {walkFiles} from './commercial-data.mjs';
import {loadPlatformRegistry,activationPlan,atomicConfigWrite,digest,assertIsolated} from './partner-config-io.mjs';
import {partnerCities} from '../../src/lib/commercial/partner-platform.ts';
import {factoryRoutes,coverageDelta} from './factory-context.mjs';
import {importActivationBundle} from '../partner-import.mjs';
import {auditPartners} from '../partner-health.mjs';
export const SITE_ID='d49c19aa-f997-43f3-9b11-fabff36c4c83';
const SOURCE_DIRS=['src','scripts','data','tests','public','docs','.github','netlify'];
const SOURCE_FILES=['package.json','package-lock.json','tsconfig.json','netlify.toml','astro.config.mjs','AGENTS.md','.gitignore','.nvmrc'];
export async function sourceManifest(root){
 const files=(await Promise.all(SOURCE_DIRS.map(d=>walkFiles(path.join(root,d))))).flat();for(const name of SOURCE_FILES){try{await stat(path.join(root,name));files.push(path.join(root,name));}catch(e){if(e.code!=='ENOENT')throw e;}}
 const rows=[];for(const file of files.sort())rows.push({path:path.relative(root,file),sha256:digest(await readFile(file))});
 return {files:rows,sha256:digest(Buffer.from(JSON.stringify(rows)))};
}
export async function runCommand(command,args,{cwd,log}={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{cwd,env:{...process.env,PATH:path.dirname(process.execPath)+path.delimiter+process.env.PATH},stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
  child.stdout.on('data',b=>{stdout+=b;});child.stderr.on('data',b=>{stderr+=b;});child.on('error',reject);
  child.on('close',async code=>{if(log)await writeFile(log,stdout+'\n'+stderr);code===0?resolve(stdout):reject(new Error(`${command} failed (${code}); see ${log??'command output'}`));});
 });
}
export function mergeApprovedBundle(registry,bundle,{now=new Date().toISOString()}={}){
 const next=structuredClone(registry);
 for(const item of bundle.partners){
  const p=item.config;next.partners=next.partners.filter(x=>x.partner_id!==p.partner_id);next.partners.push(structuredClone(p));
  next.verifications=next.verifications.filter(v=>!(v.partner_id===p.partner_id&&v.reference===item.verification.reference));next.verifications.push(item.verification);
  for(const h of item.health){next.health=next.health.filter(x=>x.url!==h.url);next.health.push(h);}
 }
 const plans=[];
 for(const {config:p} of bundle.partners){
  const scope=partnerCities(p,next.records);if(!scope.length)throw new Error('Territory does not resolve to canonical cities');
  for(const intent of p.categories){const placements=(p.placements??[]).filter(x=>x.intent===intent);const cities=placements.length?[...new Set(placements.map(x=>{const record=next.records.find(r=>r.record_id===x.record_id);if(!record)throw new Error('Placement canonical record missing');return record.city.value.toLowerCase().replace(/[^a-z0-9]+/g,'-');}))]:scope;const plan=activationPlan(next,{partner:p.partner_id,cities,intent,approval_reference:p.approval_reference,now});plans.push(plan);if(!plan.ok)throw new Error('Activation gates failed: '+JSON.stringify(plan.failures));}
 }
 for(const {config:p}of bundle.partners){const target=next.partners.find(x=>x.partner_id===p.partner_id);target.status='ACTIVE';if(!['PRIMARY','BACKUP'].includes(target.placement))target.placement='PRIMARY';}
 return {registry:next,plans};
}
async function snapshot(root,dest,manifest){
 await mkdir(dest,{recursive:true});
 for(const item of manifest.files){const target=path.join(dest,item.path);await mkdir(path.dirname(target),{recursive:true});await copyFile(path.join(root,item.path),target);}
 // Existing non-mission report fixtures are test inputs. They are not deployed.
 for(const file of await walkFiles(path.join(root,'output'))){const relative=path.relative(path.join(root,'output'),file);if(/^(?:factory-runs|partner-activation-factory-|multipartner-platform-|codex-multirevenue-)/.test(relative))continue;const target=path.join(dest,'output',relative);await mkdir(path.dirname(target),{recursive:true});await copyFile(file,target);}
 await symlink(path.join(root,'node_modules'),path.join(dest,'node_modules'),'dir');
}
async function writeRegistry(root,registry,bundle){
 for(const item of bundle.partners){const p=registry.partners.find(x=>x.partner_id===item.config.partner_id);await writeFile(path.join(root,'data/commercial/partners',p.partner_id+'.json'),JSON.stringify(p,null,2)+'\n');await writeFile(path.join(root,'data/commercial/verifications',item.verification.reference+'.json'),JSON.stringify(item.verification,null,2)+'\n');}
 await writeFile(path.join(root,'data/commercial/destination-health.json'),JSON.stringify(registry.health,null,2)+'\n');
}
export async function prepareFactory({root,out,bundle:input,infrastructure=false,pause,now=new Date().toISOString(),execute=runCommand}={}){
 await assertIsolated(root);if(!path.resolve(out).startsWith(path.resolve(root,'output/factory-runs')+path.sep))throw new Error('Output must be a new output/factory-runs/RUN directory');if(!infrastructure&&!input&&!pause)throw new Error('Approved bundle required');if([Boolean(infrastructure),Boolean(input),Boolean(pause)].filter(Boolean).length!==1)throw new Error('Choose infrastructure or partner bundle');
 const bundle=infrastructure||pause?{schema_version:3,partners:[]}:importActivationBundle(input,{now});
 const before=await loadPlatformRegistry(root),merged=mergeApprovedBundle(before,bundle,{now}),source=await sourceManifest(root);
 if(pause){const partner=merged.registry.partners.find(p=>p.partner_id===pause);if(!partner)throw new Error('Unknown partner to pause');partner.status='PAUSED';partner.placement='DISABLED';}
 const priorRoutes=await factoryRoutes(root,before,now),afterRoutes=await factoryRoutes(root,merged.registry,now),delta=coverageDelta(priorRoutes,afterRoutes);
 const conflicts=afterRoutes.filter(r=>['AMBIGUOUS_PRIORITY','PLACEMENT_CONTEXT_CONFLICT','OVERLAPPING_EXPERIMENTS'].includes(r.reason));if(conflicts.length)throw new Error('Routing conflicts must be resolved before activation');
 for(const item of bundle.partners){const p=merged.registry.partners.find(x=>x.partner_id===item.config.partner_id);if(p.placement!=='BACKUP'&&!afterRoutes.some(r=>r.selected?.partner_id===p.partner_id))throw new Error('Approved partner has no renderable placement');}
 await mkdir(out,{recursive:true});const staging=path.join(out,'source');await mkdir(staging,{recursive:false});await snapshot(root,staging,source);await writeRegistry(staging,merged.registry,bundle);if(pause){const p=merged.registry.partners.find(p=>p.partner_id===pause);await writeFile(path.join(staging,'data/commercial/partners',pause+'.json'),JSON.stringify(p,null,2)+'\n');}
 const phases=[];
 for(const [name,args] of [['tests',['test']],['typecheck',['run','astro','--','check']],['build',['run','build']]]){const start=Date.now();await execute('npm',args,{cwd:staging,log:path.join(out,name+'.log')});phases.push({name,milliseconds:Date.now()-start,passed:true});}
 const audited=await auditPartners({root:staging,out:path.join(out,'local-audit'),now});if(!audited.ok)throw new Error('Staged render/health contract failed');
 if((await sourceManifest(root)).sha256!==source.sha256)throw new Error('Source changed during preparation');
 const stagedSource=await sourceManifest(staging),baseCommit=(await execute('git',['rev-parse','HEAD'],{cwd:root})).trim();
 const release=JSON.parse(await readFile(path.join(staging,'dist/gridpermit-release.json'),'utf8'));
 if(release.schema_version!==2||release.base_commit!==baseCommit||release.source_sha256!==stagedSource.sha256)throw new Error('Build release metadata does not match exact staged source');
 // Preserve deterministic build metadata. A clean npm run build must produce
 // the same bytes the factory publishes, without a post-build rewrite.
 const built=await sourceFilesManifest(path.join(staging,'dist'));
 const plan={schema_version:3,created_at:now,root:path.resolve(root),staging:path.resolve(staging),source_before:source.sha256,source_before_files:source.files,source_release:stagedSource.sha256,base_commit:baseCommit,bundle,infrastructure,pause:pause??null,delta,phases,local_audit:{ok:audited.ok,pages:audited.pages,paid_pages:audited.paid_pages},dist_sha256:built.sha256,dist_files:built.files};
 await writeFile(path.join(out,'SOURCE_MANIFEST.json'),JSON.stringify(stagedSource,null,2)+'\n');await writeFile(path.join(out,'PLAN.json'),JSON.stringify(plan,null,2)+'\n');
 return {plan,plan_sha256:digest(await readFile(path.join(out,'PLAN.json')))};
}
export async function sourceFilesManifest(dir){const files=[];for(const f of await walkFiles(dir))files.push({path:path.relative(dir,f),sha256:digest(await readFile(f))});return {files,sha256:digest(Buffer.from(JSON.stringify(files)))};}
export async function rollbackFactory({root,journal,expectedDeploy,productionDeployed=false,execute=runCommand}={}){
 const result={attempted:true,local_restored:false,production_restore_attempted:false,production_restored:false,target_deploy:expectedDeploy??null};
 // Restore only bytes written by this run. A concurrent edit makes rollback
 // stop visibly instead of overwriting someone else's work.
 for(const entry of [...journal].reverse()){
  const file=path.join(root,entry.path);let current=null;try{current=await readFile(file);}catch(e){if(e.code!=='ENOENT')throw e;}
  if((current?digest(current):null)!==entry.applied_sha256)throw new Error('Rollback concurrent modification: '+entry.path);
  if(entry.old_bytes_base64===null)await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});else await writeFile(file,Buffer.from(entry.old_bytes_base64,'base64'));
 }
 result.local_restored=true;
 if(productionDeployed){
  if(!expectedDeploy)throw new Error('Rollback target deploy required');result.production_restore_attempted=true;
  await execute('netlify',['api','restoreSiteDeploy','--data',JSON.stringify({site_id:SITE_ID,deploy_id:expectedDeploy})],{cwd:root});
  const site=JSON.parse(await execute('netlify',['api','getSite','--data',JSON.stringify({site_id:SITE_ID})],{cwd:root}));
  if(site.id!==SITE_ID||site.published_deploy?.id!==expectedDeploy||site.published_deploy?.state!=='ready')throw new Error('Production rollback identity not confirmed');result.production_restored=true;
 }
 return result;
}
export async function applyConfigChanges({root,staging,changes,sourceBeforeFiles,journal,journalFile}) {
 if(new Set(changes).size!==changes.length)throw new Error('Duplicate configuration path');
 for(const relative of changes){
  const file=path.join(root,relative);let before=null;
  try{before=await readFile(file);}catch(e){if(e.code!=='ENOENT')throw e;}
  const expected=sourceBeforeFiles.find(x=>x.path===relative)?.sha256??null;
  if((before?digest(before):null)!==expected)throw new Error('Concurrent config modification: '+relative);
  const value=JSON.parse(await readFile(path.join(staging,relative),'utf8'));
  const applied=Buffer.from(JSON.stringify(value,null,2)+'\n');
  journal.push({path:relative,old_sha256:expected,old_bytes_base64:before?.toString('base64')??null,applied_sha256:digest(applied)});
  await writeFile(journalFile,JSON.stringify(journal,null,2)+'\n');
  await atomicConfigWrite(file,expected,value);
 }
}
export async function applyFactory({root,planFile,expectedPlan,expectedDeploy,deploy=false,execute=runCommand,audit=auditPartners}={}){
 await assertIsolated(root);const bytes=await readFile(planFile);if(digest(bytes)!==expectedPlan)throw new Error('Plan hash mismatch');const plan=JSON.parse(bytes),out=path.dirname(planFile);
 if(plan.schema_version!==3||path.resolve(root)!==plan.root||path.resolve(plan.staging)!==path.resolve(out,'source')||Date.now()-Date.parse(plan.created_at)>3600000||Date.parse(plan.created_at)>Date.now())throw new Error('Wrong root or stale plan');
 if((await sourceManifest(root)).sha256!==plan.source_before||(await sourceManifest(plan.staging)).sha256!==plan.source_release||(await sourceFilesManifest(path.join(plan.staging,'dist'))).sha256!==plan.dist_sha256)throw new Error('Source or build changed after review');
 const baseline=await loadPlatformRegistry(root);mergeApprovedBundle(baseline,plan.bundle);const local=await audit({root:plan.staging});if(!local.ok)throw new Error('Current health or rendered contract failed');
 const lock=path.join(root,'data/commercial/factory.lock');await writeFile(lock,'factory '+randomUUID()+'\n',{flag:'wx'});
 const ledger={started_at:new Date().toISOString(),base_commit:plan.base_commit,source_worktree:root,source_snapshot:plan.staging,source_sha256:plan.source_release,plan_sha256:expectedPlan,partners_changed:[...plan.bundle.partners.map(x=>x.config.partner_id),...(plan.pause?[plan.pause]:[])],routes_changed:plan.delta.changes,production_deployed:false,rollback_target:expectedDeploy??null};let journal=[];
 try{
  if(deploy){if(!expectedDeploy)throw new Error('Expected current deploy ID required');const site=JSON.parse(await execute('netlify',['api','getSite','--data',JSON.stringify({site_id:SITE_ID})],{cwd:root}));if(site.id!==SITE_ID||site.custom_domain!=='mygridpermit.com'||site.published_deploy.id!==expectedDeploy||site.published_deploy.locked||site.published_deploy.pending_review_reason)throw new Error('Site, concurrent deployment or deployment hold gate failed');}
  // The staged source is the exact reviewed and tested release; local configs
  // are applied with guarded per-file writes and original-byte journal.
  const changes=plan.pause?['data/commercial/partners/'+plan.pause+'.json']:[];for(const item of plan.bundle.partners){for(const relative of ['partners/'+item.config.partner_id+'.json','verifications/'+item.verification.reference+'.json'])changes.push('data/commercial/'+relative);}if(plan.bundle.partners.length)changes.push('data/commercial/destination-health.json');
  await applyConfigChanges({root,staging:plan.staging,changes,sourceBeforeFiles:plan.source_before_files,journal,journalFile:path.join(out,'APPLY_JOURNAL.json')});
  ledger.local_applied=true;
  if(deploy){const raw=await execute('netlify',['deploy','--site',SITE_ID,'--dir',path.join(plan.staging,'dist'),'--functions',path.join(plan.staging,'netlify/functions'),'--no-build','--prod','--json','--message','GridPermit activation factory '+plan.source_release.slice(0,12)],{cwd:plan.staging,log:path.join(out,'deploy.log')});const result=JSON.parse(raw);ledger.netlify_deploy_id=result.deploy_id;ledger.production_deployed=true;await writeFile(path.join(out,'DEPLOYMENT_LEDGER.json'),JSON.stringify(ledger,null,2)+'\n');const site=JSON.parse(await execute('netlify',['api','getSite','--data',JSON.stringify({site_id:SITE_ID})],{cwd:root}));if(site.published_deploy.id!==result.deploy_id||site.published_deploy.state!=='ready')throw new Error('Deploy returned but production identity not confirmed');const smoke=await audit({root:plan.staging,out:path.join(out,'live-audit'),live:true,probeDestinations:true});ledger.smoke_passed=smoke.ok;if(!smoke.ok)throw new Error('Post-deploy smoke failed');}
  ledger.completed_at=new Date().toISOString();await writeFile(path.join(out,'DEPLOYMENT_LEDGER.json'),JSON.stringify(ledger,null,2)+'\n');return ledger;
 }catch(error){ledger.error=error.message;ledger.status='STOPPED_NO_RETRY';if(journal.length){try{ledger.rollback=await rollbackFactory({root,journal,expectedDeploy,productionDeployed:ledger.production_deployed,execute});ledger.status=ledger.rollback.production_restore_attempted&&!ledger.rollback.production_restored?'ROLLBACK_UNCONFIRMED':'ROLLED_BACK_NO_RETRY';}catch(rollbackError){ledger.rollback={attempted:true,confirmed:false,error:rollbackError.message};ledger.status='ROLLBACK_FAILED_NO_RETRY';}}await writeFile(path.join(out,'DEPLOYMENT_LEDGER.json'),JSON.stringify(ledger,null,2)+'\n');throw error;}finally{await unlink(lock);}
}
