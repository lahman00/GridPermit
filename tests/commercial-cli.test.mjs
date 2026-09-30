import {test} from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv';
import {mkdtemp,writeFile,readFile,rm,readdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {commercialSchemas,commercialDryRun,writeCommercialDryRun} from '../scripts/commercial-experiment.mjs';
import {buildCommercialCatalog} from '../src/lib/commercial/catalog.ts';
import {commercialFixture,NOW} from './fixtures/commercial.mjs';
import {inspectCommercialHtml} from '../scripts/commercial-crawl.mjs';

test('exported JSON schemas compile and cover every derived route',()=>{
 const schemas=commercialSchemas(),ajv=new Ajv(),validate=ajv.compile(schemas.route);
 assert.ok(ajv.compile(schemas.intent)('UNKNOWN'));
 for(const route of buildCommercialCatalog().routes)assert.ok(validate(route),JSON.stringify(validate.errors));
 const bad={...commercialFixture().route,channel:'ARBITRARY'};assert.equal(validate(bad),false);
});
test('CLI dry run is read only; artifacts write only to explicit temp output',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'gridpermit-commercial-cli-'));
 try{
  const data=await commercialDryRun({now:NOW});assert.equal(data.summary.active_generic_cta_pages,0);assert.equal(data.summary.active_experiments,0);
  assert.deepEqual(await readdir(dir),[]);await writeCommercialDryRun(data,dir);
  assert.equal(JSON.parse(await readFile(path.join(dir,'OBSERVABILITY.json'),'utf8')).production_migration,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('review import cannot silently classify current pages; Mission Viejo debug is blocked',async()=>{
 const r=await commercialDryRun({now:NOW,journey:'https://mygridpermit.com/california/mission-viejo/solar-permit-guide/',intentOverride:'NEW_SOLAR'});
 assert.equal(r.debug.simulation,true);assert.equal(r.debug.routing.selected,null);
 assert.ok(r.debug.routing.candidates.some(c=>c.reasons.includes('UTILITY_UNSAFE')));
 assert.ok(r.routing.every(r=>r.intent==='UNKNOWN'));
});
test('experiments accept reviewed JSON configuration and reject malformed input',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'gridpermit-experiments-'));
 try{const file=path.join(dir,'experiments.json');await writeFile(file,'[null]');await assert.rejects(()=>commercialDryRun({now:NOW,experimentsFile:file}));
  await writeFile(file,'[]');assert.deepEqual((await commercialDryRun({now:NOW,experimentsFile:file})).experiments,[]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('HTML inspection does not mistake source script strings for rendered CTA',()=>{
 assert.equal(inspectCommercialHtml('<script>const selector="[data-compare-solar-cta-root]"</script>').paid_cta_present,false);
 assert.equal(inspectCommercialHtml('<div data-compare-solar-cta-root><button data-compare-solar-cta>Go</button>Paid referral disclosure:</div>').paid_cta_present,true);
});
