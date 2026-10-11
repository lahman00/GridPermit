import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {refreshBuildHealth} from '../scripts/partner-platform.mjs';
import {fingerprint,loadPlatformRegistry} from '../scripts/lib/partner-config-io.mjs';
import {selectPartner} from '../src/lib/commercial/partner-platform.ts';

const root=path.resolve(import.meta.dirname,'..');
const base=JSON.parse(await readFile(path.join(root,'data/commercial/partners/compare-solar-prices.json')));
const context={state:'CA',city:'Escondido',recordId:'fixture-escondido',utility:{value:'SDGE',notes:'Verified'},pagePath:'/california/escondido/solar-permit-guide/',pageType:'locality_guide',intent:'NEW_SOLAR',pageIntent:'NEW_SOLAR'};
const iso=offset=>new Date(Date.now()+offset).toISOString();

async function fixture(t,{ageHours=49,tracked=false,query=false,invalidHost=false}={}){
 const dir=await mkdtemp(path.join(os.tmpdir(),'gp-build-health-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 for(const d of ['data/localities','data/commercial/partners','data/commercial/verifications'])await mkdir(path.join(dir,d),{recursive:true});
 const url=`https://provider.${invalidHost?'invalid':'example.com'}/quote/${query?'?ref=fixture':''}`;
 const p={...structuredClone(base),partner_id:'fixture-partner',approval_reference:'fixture-approval',territories:{states:['CA'],cities:['escondido']},expected_hosts:[new URL(url).hostname],destination:url,paths:{solar:url,battery:url},placements:[]};
 p.program.reverify_after=iso(30*86400000);
 if(tracked)p.tracking.cj_tracking_url='https://network.example.com/click-111-222';
 const proof={reference:p.approval_reference,partner_id:p.partner_id,reviewed:true,evidence_reference:'fixture:source',approved_categories:p.categories,states:['CA'],cities:['escondido'],utilities:['VERIFIED_LOCAL_RECORD'],destinations:[url],tracking_verified:true,approved_fallback:false,verified_at:iso(-86400000),expires_at:iso(30*86400000),config_sha256:fingerprint(p)};
 await writeFile(path.join(dir,'data/commercial/partners/fixture.json'),JSON.stringify(p));
 await writeFile(path.join(dir,'data/commercial/verifications/fixture.json'),JSON.stringify(proof));
 await writeFile(path.join(dir,'data/localities/fixture.json'),JSON.stringify({record_id:context.recordId,state:context.state,city:{value:context.city},utility:context.utility}));
 const file=path.join(dir,'data/commercial/destination-health.json');
 const old=[{url,ok:true,status:200,finalUrl:url,checkedAt:iso(-ageHours*3600000),queryPreserved:null,chain:[{url,status:200}],reason:'OK'}];
 await writeFile(file,JSON.stringify(old));
 return {dir,file,url,old};
}

test('expired input blocks routing; real refresh restores it only for the unchanged 48-hour TTL',async t=>{
 const f=await fixture(t);
 assert.equal(selectPartner(context,await loadPlatformRegistry(f.dir)),null);
 const start=Date.now(),calls=[];
 const result=await refreshBuildHealth({root:f.dir,fetchImpl:async(url,options)=>{calls.push({url,options});return new Response(null,{status:200});}});
 assert.equal(result.ok,true);assert.equal(calls.length,1);
 assert.equal(calls[0].url,f.url);assert.equal(calls[0].options.method,'HEAD');assert.equal(calls[0].options.redirect,'manual');
 assert.equal(new URL(calls[0].url).search,'');assert.equal(calls[0].options.headers.Cookie,undefined);
 const registry=await loadPlatformRegistry(f.dir),checked=Date.parse(registry.health[0].checkedAt);
 assert.ok(checked>=start&&checked<=Date.now());
 assert.equal(selectPartner(context,registry)?.partner_id,'fixture-partner');
 assert.ok(selectPartner(context,registry,new Date(checked+48*3600000-1).toISOString()));
 assert.equal(selectPartner(context,registry,new Date(checked+48*3600000).toISOString()),null);
});

test('valid input is checked again instead of having its timestamp relabeled',async t=>{
 const f=await fixture(t,{ageHours:1});let requests=0;
 assert.ok(selectPartner(context,await loadPlatformRegistry(f.dir)));
 await refreshBuildHealth({root:f.dir,fetchImpl:async()=>{requests++;return new Response(null,{status:200});}});
 assert.equal(requests,1);
 assert.notEqual(JSON.parse(await readFile(f.file))[0].checkedAt,f.old[0].checkedAt);
});

for(const failure of ['503','timeout','tracked redirect'])test(`${failure} refresh stops the build and replaces old success with failed evidence`,async t=>{
 const f=await fixture(t,{ageHours:1}),calls=[];
 await assert.rejects(refreshBuildHealth({root:f.dir,fetchImpl:async url=>{
  calls.push(url);
  if(failure==='timeout')throw new Error('timeout');
  return failure==='503'?new Response(null,{status:503}):new Response(null,{status:302,headers:{location:'/affiliate/click/fixture'}});
 }}),/BUILD_HEALTH_REFRESH_FAILED/);
 assert.deepEqual(calls,[f.url]);
 assert.equal(JSON.parse(await readFile(f.file))[0].ok,false);
 assert.equal(selectPartner(context,await loadPlatformRegistry(f.dir)),null);
});

for(const kind of ['tracked','query'])test(`${kind} destinations are refused before any request or evidence rewrite`,async t=>{
 const f=await fixture(t,{[kind]:true}),before=await readFile(f.file,'utf8');
 await assert.rejects(refreshBuildHealth({root:f.dir,fetchImpl:()=>assert.fail('must not issue a request')}),/BUILD_HEALTH_.*(REFUSED|SEPARATE_EVIDENCE)/);
 assert.equal(await readFile(f.file,'utf8'),before);
});

test('concurrent evidence changes are not overwritten by a refresh',async t=>{
 const f=await fixture(t);
 await assert.rejects(refreshBuildHealth({root:f.dir,fetchImpl:async()=>{await writeFile(f.file,'[]');return new Response(null,{status:200});}}),/Concurrent modification/);
 assert.equal(await readFile(f.file,'utf8'),'[]');
});

test('npm build stops before its consumer when the real prebuild refresh fails',async t=>{
 const f=await fixture(t,{invalidHost:true});
 const pkg=JSON.parse(await readFile(path.join(root,'package.json')));
 assert.equal(pkg.scripts.prebuild,'node --experimental-strip-types scripts/partner-platform.mjs --refresh-build-health');
 const script=path.join(root,'scripts/partner-platform.mjs');
 await writeFile(path.join(f.dir,'package.json'),JSON.stringify({scripts:{prebuild:`node --experimental-strip-types ${JSON.stringify(script)} --refresh-build-health --root .`,build:'node -e "require(\'fs\').writeFileSync(\'consumer-ran\',\'bad\')"'}}));
 const run=spawnSync('npm',['run','build'],{cwd:f.dir,encoding:'utf8'});
 assert.notEqual(run.status,0);assert.match(run.stderr,/BUILD_HEALTH_REFRESH_FAILED/);
 await assert.rejects(access(path.join(f.dir,'consumer-ran')));
});

test('build refresh CLI refuses caller-supplied time',()=>{
 const run=spawnSync(process.execPath,[path.join(root,'scripts/partner-platform.mjs'),'--refresh-build-health','--now','2026-10-08T00:00:00Z'],{encoding:'utf8'});
 assert.notEqual(run.status,0);assert.match(run.stderr,/no clock override/);
});
