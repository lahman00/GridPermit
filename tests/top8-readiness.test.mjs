import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {partnerConfigErrors,partnerCities,debugPartnerRoutes} from '../src/lib/commercial/partner-platform.ts';
import {loadPlatformRegistry} from '../scripts/lib/partner-config-io.mjs';
import {partnerEvidenceHold} from '../src/lib/commercial/partner-evidence-holds.ts';

const ROOT=new URL('..',import.meta.url).pathname;
const IDS=['energysage','modernize','profitise','energyaid','oc-solar','norcal-solar-repair','greenlancer','permitdesign'];
const load=async id=>JSON.parse(await readFile(path.join(ROOT,'data/commercial/partners',id+'.json'),'utf8'));

test('canonical top-8 import remains entirely SHADOW with no invented approval, tracking or destination',async()=>{
  const partners=await Promise.all(IDS.map(load));
  assert.equal(partners.length,8);
  for(const p of partners){
    assert.deepEqual(partnerConfigErrors(p),[]);
    assert.equal(p.status,'SHADOW');
    assert.equal(p.commercial_status,'UNVERIFIED');
    assert.equal(p.tracking.active,false);
    assert.equal(p.destination,null);
    assert.equal(p.approval_reference,null);
    assert.equal(p.program,undefined);
    assert.equal(p.phone,null);
  }
});

test('canonical territory preparation is exact: statewide, SoCal four counties, NorCal nine counties',async()=>{
  const registry=await loadPlatformRegistry(ROOT);
  const byId=Object.fromEntries(registry.partners.map(p=>[p.partner_id,p]));
  for(const id of ['energysage','modernize','profitise','energyaid','greenlancer','permitdesign']){
    assert.deepEqual(byId[id].territories,{states:['CA'],cities:[],statewide_verified:true});
    assert.equal(partnerCities(byId[id],registry.records).length,334);
  }
  assert.equal(partnerCities(byId['oc-solar'],registry.records).length,119);
  assert.equal(partnerCities(byId['norcal-solar-repair'],registry.records).length,89);
});

test('EnergySage battery, Profitise call, PTO and permit capabilities cannot route before real evidence',async()=>{
  const registry=await loadPlatformRegistry(ROOT);
  const record=registry.records.find(r=>r.record_id==='ca-contra-costa-richmond-pge');
  assert.ok(record);
  for(const intent of ['NEW_SOLAR','BATTERY_RETROFIT','PAY_PER_CALL','PTO_RESCUE','PERMIT_ENGINEERING','INSTALLER_B2B']){
    const page=intent==='INSTALLER_B2B'?'/blog/tesla-powerwall-3-vs-enphase-iq5p/':'/california/richmond/solar-permit-guide/';
    const context={state:'CA',city:'Richmond',recordId:record.record_id,utility:record.utility,pagePath:page,pageType:page.startsWith('/blog/')?'blog_general':'locality_guide',intent,pageIntent:intent,...(intent==='BATTERY_RETROFIT'?{existingSolar:true,batteryIntent:'RETROFIT'}:{})};
    const result=debugPartnerRoutes(context,registry,'2026-09-27T00:00:00Z');
    const top8=result.candidates.filter(c=>IDS.includes(c.partner_id));
    assert.equal(top8.length,8);
    assert.ok(top8.every(c=>c.selected===null&&c.reasons.some(r=>r==='STATUS_SHADOW'||r==='INTENT_INCOMPATIBLE')));
  }
});

test('Profitise pay-per-call and native/manual workflows remain disabled',async()=>{
  const p=await load('profitise');
  assert.ok(p.categories.includes('PAY_PER_CALL'));
  assert.equal(p.phone,null);
  assert.equal(p.tracking.active,false);
  for(const id of ['energyaid','oc-solar','norcal-solar-repair','greenlancer','permitdesign'])assert.equal((await load(id)).tracking_type,'MANUAL');
});

test('PermitDesign is B2B-only and no permit partner activates a native form',async()=>{
  const permit=await load('permitdesign'),green=await load('greenlancer');
  assert.deepEqual(permit.categories,['INSTALLER_B2B']);
  assert.equal(permit.qualification.homeowner_required,false);
  assert.equal(green.qualification.homeowner_required,false);
  assert.ok([permit,green].every(p=>p.tracking_type==='MANUAL'&&p.destination===null));
});

test('new canonical record supersedes only the NorCal identity hold',async()=>{
  assert.equal(partnerEvidenceHold(await load('norcal-solar-repair')),null);
  assert.ok(partnerEvidenceHold({partner_id:'service-direct',name:'Service Direct',tracking:{network:'DIRECT'}}));
  assert.ok(partnerEvidenceHold({partner_id:'solar-com',tracking:{network:'PARTNERIZE'}}));
});

test('handoff provenance is bound exclusively to the canonical Top-20 receipt',async()=>{
  const p=JSON.parse(await readFile(path.join(ROOT,'data/commercial/handoff-provenance.json'),'utf8'));
  assert.equal(p.canonical_source.sha256,'acfbe9cd8cd683e4da1fd35c7508ccd61877e6d1a639f2271b367f67a279c20b');
  assert.equal(p.canonical_source.exclusive_for_this_import,true);
  assert.equal(p.imported.length,8);
  assert.equal(p.approval_records_created,0);
  assert.equal(p.active_partners_created,0);
});
