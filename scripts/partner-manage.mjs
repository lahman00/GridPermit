#!/usr/bin/env node
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPlatformRegistry,activationPlan,assertIsolated,atomicConfigWrite,digest,fingerprint} from './lib/partner-config-io.mjs';
import {partnerCities} from '../src/lib/commercial/partner-platform.ts';
export async function managePartner({root,partner,action,mode='check',expectedHash,snapshot,now=new Date().toISOString()}){
 if(!['pause','remove','rollback'].includes(action)||!['check','dry-run','apply'].includes(mode))throw new Error('Invalid management action or mode');
 const registry=await loadPlatformRegistry(root),current=registry.partners.find(p=>p.partner_id===partner);if(!current)throw new Error('Unknown partner');
 const file=path.join(root,'data/commercial/partners',partner+'.json'),before=await readFile(file),hash=digest(before);
 let updated={...current,status:'PAUSED',placement:'DISABLED'};
 if(action==='rollback'){
  const actual=await realpath(snapshot),base=await realpath(path.join(root,'output/partner-change-journal'));
  if(!actual.startsWith(base+path.sep)||path.basename(actual)!=='before.json')throw new Error('Rollback requires a local journal snapshot');
  const bytes=await readFile(actual),journal=JSON.parse(await readFile(path.join(path.dirname(actual),'plan.json')));
  if(digest(bytes)!==journal.current_sha256)throw new Error('Snapshot hash mismatch');
  updated=JSON.parse(bytes);if(updated.partner_id!==partner)throw new Error('Snapshot partner mismatch');
  if(['ACTIVE','APPROVED'].includes(updated.status)&&['PRIMARY','BACKUP'].includes(updated.placement)){
   const verification=registry.verifications.find(v=>v.reference===updated.approval_reference&&v.partner_id===partner);
   if(!verification?.reviewed||fingerprint(updated)!==verification.config_sha256)throw new Error('Rollback evidence no longer valid');
   const trial={...registry,partners:registry.partners.map(p=>p.partner_id===partner?{...updated,status:'APPROVED'}:p)};
   for(const intent of updated.categories){const plan=activationPlan(trial,{partner,cities:partnerCities(updated,registry.records),intent,approval_reference:updated.approval_reference,now});if(!plan.ok)throw new Error('Rollback blocked by current routing/health gates');}
  }
 }
 const result={action,partner:updated,current_sha256:hash,applied:false,production_deploy:false,note:action==='remove'?'Soft removal: disabled and retained for audit':'Static production requires a reviewed rebuild/deploy'};
 if(mode==='apply'){
  await assertIsolated(root);if(expectedHash!==hash)throw new Error('--expected-hash from reviewed dry-run required');
  const dir=path.join(root,'output/partner-change-journal',new Date().toISOString().replace(/[:.]/g,'-'));await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'before.json'),before);await writeFile(path.join(dir,'plan.json'),JSON.stringify(result,null,2));
  await atomicConfigWrite(file,hash,updated);result.applied=true;result.journal=dir;
 }
 return result;
}
async function main(){const args=process.argv.slice(2),input={},allowed=new Set(['--root','--partner','--action','--mode','--expected-hash','--snapshot','--now']);for(let i=0;i<args.length;i+=2){if(!allowed.has(args[i])||!args[i+1])throw new Error('Invalid argument');input[args[i].slice(2)]=args[i+1];}console.log(JSON.stringify(await managePartner({...input,root:input.root??path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),expectedHash:input['expected-hash']}),null,2));}
const isDirectRun=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isDirectRun)main().catch(e=>{console.error(e.message);process.exitCode=1;});
