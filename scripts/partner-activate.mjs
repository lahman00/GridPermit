#!/usr/bin/env node
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPlatformRegistry,activationPlan,assertIsolated,atomicConfigWrite,digest} from './lib/partner-config-io.mjs';
export async function runPartnerActivation({root,partner,cities,intent,approval_reference,mode='check',expectedHash,now}={}){
 if(!['check','dry-run','apply'].includes(mode))throw new Error('Invalid mode');
 const registry=await loadPlatformRegistry(root),plan=activationPlan(registry,{partner,cities,intent,approval_reference,now});
 const file=path.join(root,'data/commercial/partners',partner+'.json'),bytes=await readFile(file);plan.current_sha256=digest(bytes);
 if(mode==='apply'){
  if(!plan.ok)throw new Error('Activation gates failed: '+JSON.stringify(plan.failures));
  await assertIsolated(root);if(expectedHash!==plan.current_sha256)throw new Error('--expected-hash from a reviewed dry-run is required');
  const dir=path.join(root,'output/partner-change-journal',new Date().toISOString().replace(/[:.]/g,'-'));await mkdir(dir,{recursive:true});
  await writeFile(path.join(dir,'before.json'),bytes);await writeFile(path.join(dir,'plan.json'),JSON.stringify(plan,null,2)+'\n');
  await atomicConfigWrite(file,expectedHash,plan.partner);plan.applied=true;plan.journal=dir;
 }
 return plan;
}
async function main(){
 const args=process.argv.slice(2),flags=new Set(['--root','--partner','--cities','--territory','--intent','--approval-reference','--approval_reference','--mode','--expected-hash','--now','--tracking-config']),modes=new Set(['--check','--dry-run','--apply']),input={};
 for(let i=0;i<args.length;i++){const key=args[i];if(modes.has(key)){if(input.mode)throw new Error('Choose one activation mode');input.mode=key.slice(2);continue;}if(!flags.has(key)||!args[i+1]||args[i+1].startsWith('--'))throw new Error('Invalid argument');const normalized=key.slice(2);if(input[normalized]!==undefined)throw new Error('Duplicate argument');input[normalized]=args[++i];}
 const root=input.root??path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 if(input['tracking-config']){const expected=JSON.parse(await readFile(input['tracking-config'],'utf8'));const current=(await loadPlatformRegistry(root)).partners.find(p=>p.partner_id===input.partner);if(JSON.stringify(expected)!==JSON.stringify(current?.tracking))throw new Error('Tracking input does not match the reviewed config');}
 const result=await runPartnerActivation({root,partner:input.partner,cities:(input.cities??input.territory)?.split(','),intent:input.intent==='SOLAR_NEW'?'NEW_SOLAR':input.intent,approval_reference:input['approval-reference']??input.approval_reference,mode:input.mode,expectedHash:input['expected-hash'],now:input.now});console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=2;
}
const isDirectRun=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isDirectRun)main().catch(e=>{console.error(e.message);process.exitCode=1;});
