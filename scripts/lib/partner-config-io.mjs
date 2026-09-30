import {readFile,readdir,mkdir,writeFile,rename,realpath,stat,unlink} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {stateSlug} from '../../src/lib/state-meta.ts';
import {approvalPayload} from '../../src/lib/commercial/approval-payload.ts';
import {partnerConfigErrors,partnerCities,debugPartnerRoutes} from '../../src/lib/commercial/partner-platform.ts';
export const fingerprint=p=>createHash('sha256').update(approvalPayload(p)).digest('hex');
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function jsonFiles(dir){const files=(await readdir(dir)).filter(f=>f.endsWith('.json')).sort();return Promise.all(files.map(async name=>JSON.parse(await readFile(path.join(dir,name),'utf8'))));}
export async function loadPlatformRegistry(root){
 const base=path.join(root,'data/commercial');
 const [partners,records,verifications,health]=await Promise.all([jsonFiles(path.join(base,'partners')),jsonFiles(path.join(root,'data/localities')),jsonFiles(path.join(base,'verifications')),readFile(path.join(base,'destination-health.json'),'utf8').then(JSON.parse)]);
 for(const p of partners){const e=partnerConfigErrors(p);if(e.length)throw new Error(p.partner_id+': '+e.join(';'));}
 return {partners,records,health,verifications:verifications.map(v=>({...v,reviewed:v.reviewed===true&&fingerprint(partners.find(p=>p.partner_id===v.partner_id)??{})===v.config_sha256}))};
}
export async function assertIsolated(root){const resolved=await realpath(root);if(!(await stat(path.join(resolved,'.git'))).isFile())throw new Error('Apply requires an isolated Git worktree; canonical checkout refused');return resolved;}
export async function atomicConfigWrite(file,expectedSha,value){
 await mkdir(path.dirname(file),{recursive:true});
 const lock=file+'.lock',temp=file+'.'+randomUUID()+'.tmp';
 await writeFile(lock,'partner-config-write\n',{flag:'wx'}); // Existing lock fails; never bypass it.
 try {
  let previous=null;try{previous=await readFile(file);}catch(e){if(e.code!=='ENOENT')throw e;}
  if((previous?digest(previous):null)!==expectedSha)throw new Error('Concurrent modification: expected config hash no longer matches');
  await writeFile(temp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
  const latest=previous?await readFile(file):null;
  if((latest?digest(latest):null)!==expectedSha)throw new Error('Concurrent modification during preparation');
  await rename(temp,file);
 } finally {await unlink(temp).catch(e=>{if(e.code!=='ENOENT')throw e;});await unlink(lock);}
}
export function activationPlan(registry,{partner,cities,intent,approval_reference,now=new Date().toISOString()}){
 const current=registry.partners.find(p=>p.partner_id===partner);if(!current)throw new Error('Unknown partner');
 if(current.status!=='APPROVED')throw new Error('Activation requires APPROVED status');
 if(!current.program?.terms_reference||Date.parse(current.program.reverify_after)<=Date.parse(now))throw new Error('Current reviewed program terms required');
 if(!Array.isArray(cities)||!cities.length||new Set(cities).size!==cities.length||cities.some(c=>typeof c!=='string'||!partnerCities(current,registry.records).includes(c)))throw new Error('Cities must be explicitly configured and unique');
 if(!current.categories.includes(intent)||!approval_reference||current.approval_reference!==approval_reference)throw new Error('Intent or approval reference mismatch');
 const updated=structuredClone(current);updated.categories=[intent];updated.status='ACTIVE';updated.placement=['PRIMARY','BACKUP'].includes(current.placement)?current.placement:'PRIMARY';updated.territories.cities=cities;delete updated.territories.source;delete updated.territories.counties;delete updated.territories.statewide_verified;
 const trial={...registry,partners:registry.partners.map(p=>p.partner_id===partner?updated:p)};
 const failures=[];
 for(const city of cities){
  const records=registry.records.filter(r=>current.territories.states.includes(r.state)&&r.city?.value?.toLowerCase().replace(/[^a-z0-9]+/g,'-')===city);
  if(records.length!==1){failures.push({city,reasons:['CANONICAL_CITY_UNRESOLVED']});continue;}
  const r=records[0],ctx={state:r.state,city:r.city.value,recordId:r.record_id,utility:r.utility,pageType:'locality_guide',pagePath:`/${stateSlug(r.state)}/${city}/solar-permit-guide/`,intent,pageIntent:intent,...(intent==='BATTERY_RETROFIT'?{existingSolar:true,batteryIntent:'RETROFIT'}:{})};
  const audit=debugPartnerRoutes(ctx,trial,now),candidate=audit.candidates.find(c=>c.partner_id===partner);
  if(candidate?.reasons.length||!candidate?.selected||audit.reason==='AMBIGUOUS_PRIORITY'||updated.placement!=='BACKUP'&&audit.selected?.partner_id!==partner)failures.push({city,reasons:[...(candidate?.reasons??[]),...(audit.selected?.partner_id!==partner?[audit.reason]:[])]});
 }
 return {ok:failures.length===0,partner:updated,failures,production_deploy:false};
}
