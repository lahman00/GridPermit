import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {loadPlatformRegistry} from '../scripts/lib/partner-config-io.mjs';
import {debugPartnerRoutes,selectPartner} from '../src/lib/commercial/partner-platform.ts';
import {qualificationPolicy} from '../src/lib/commercial/qualification.ts';
import {buildCommercialOutbound} from '../src/lib/commercial/attribution.ts';
import {inspectPartnerHtml} from '../scripts/partner-health.mjs';

const ROOT=path.resolve('.');
const NOW='2026-09-29T20:00:00Z';
const CID='a'.repeat(24);
const registry=await loadPlatformRegistry(ROOT);
const partner=registry.partners.find(p=>p.partner_id==='compare-solar-prices');

function record(id){const r=registry.records.find(x=>x.record_id===id);assert.ok(r,'missing '+id);return r;}
function contextFor(r,pagePath,intent='NEW_SOLAR'){
  return {state:r.state,city:r.city.value,recordId:r.record_id,utility:r.utility,pagePath,pageType:pagePath.startsWith('/blog/')?'blog_general':'locality_guide',intent,pageIntent:intent,...(intent==='BATTERY_RETROFIT'?{existingSolar:true,batteryIntent:'RETROFIT'}:{})};
}

test('Aaron written approval binds CSP to new-solar plus existing-solar battery retrofit only',()=>{
  assert.deepEqual(partner.categories,['NEW_SOLAR','BATTERY_RETROFIT']);
  assert.deepEqual(partner.program.allowed_intents,['NEW_SOLAR','BATTERY_RETROFIT']);
  assert.equal(partner.program.allows_existing_solar,true);
  assert.equal(partner.qualification.existing_solar,'ALLOW');
  assert.equal(partner.paths.battery,'https://www.comparesolarprices.net/#quote');
  assert.ok(!partner.categories.includes('BATTERY_NEW_INSTALL'));
  assert.equal(partner.approval_reference,'csp-aaron-email-20260929');
  assert.equal(partner.program.terms_reference,'gmail:1a0eafa285b84cf3');
});

test('reviewed SDGE battery page selects CSP without GridPermit PII and preserves approved direct quote tracking',async()=>{
  const r=record('ca-san-diego-san-diego-sdge');
  const context=contextFor(r,'/blog/sdge-battery-roi-guide/','BATTERY_RETROFIT');
  const selected=selectPartner(context,registry,NOW);
  assert.equal(selected?.partner_id,'compare-solar-prices');
  assert.equal(selected?.selected?.route.channel,'BATTERY_SERVICE');
  assert.equal(selected?.selected?.context.existingSolar,true);
  assert.equal(qualificationPolicy(partner).label,'I own this home.');
  assert.equal(buildCommercialOutbound(selected.selected,CID),'https://www.comparesolarprices.net/?ref=GridPermit&cid='+CID+'#quote');
  const source=await readFile(new URL('../src/components/PartnerCTA.astro',import.meta.url),'utf8');
  assert.match(source,/Object\.entries\(\{cid,page_path:window\.location\.pathname,qualified:/);
  assert.doesNotMatch(source,/Object\.entries\(\{[^}]*email/i);
  assert.doesNotMatch(source,/Object\.entries\(\{[^}]*phone/i);
  const manifestSource=await readFile(new URL('../scripts/build-outbound-manifest.mjs',import.meta.url),'utf8');
  assert.match(manifestSource,/html\.includes\('data-qualification'\)/);
});

test('new-solar remains live on verified unambiguous Aaron-territory locality records',()=>{
  for(const [id,slug] of [
    ['ca-los-angeles-norwalk-sce','norwalk'],
    ['ca-orange-orange-sce','orange'],
    ['ca-san-bernardino-victorville-sce','victorville'],
  ]){
    const r=record(id),ctx=contextFor(r,'/california/'+slug+'/solar-permit-guide/');
    assert.equal(selectPartner(ctx,registry,NOW)?.partner_id,'compare-solar-prices',slug);
  }
});

test('Corona and Mission Viejo remain fail-closed despite CSP commercial territory coverage',()=>{
  for(const [id,slug] of [
    ['ca-riverside-corona-multi','corona'],
    ['ca-orange-mission-viejo-sce','mission-viejo'],
  ]){
    const r=record(id),ctx=contextFor(r,'/california/'+slug+'/solar-permit-guide/');
    const audit=debugPartnerRoutes(ctx,registry,NOW);
    assert.equal(audit.selected,null,slug);
    assert.ok(audit.candidates.find(c=>c.partner_id==='compare-solar-prices')?.reasons.includes('UTILITY_UNSAFE'),slug);
  }
});

test('CSP remains California-only and cannot borrow a non-CA page context',()=>{
  const r=registry.records.find(x=>x.state!=='CA'&&x.city?.value&&x.utility?.value);
  assert.ok(r,'need a non-CA canonical record');
  const slug=r.city.value.toLowerCase().replace(/[^a-z0-9]+/g,'-');
  const ctx=contextFor(r,'/'+r.state.toLowerCase()+'/'+slug+'/solar-permit-guide/');
  assert.equal(selectPartner(ctx,registry,NOW),null);
});


test('partner health accepts the generic CSP battery disclosure while keeping legacy disclosure checks scoped',()=>{
  const r=record('ca-san-diego-san-diego-sdge');
  const context=contextFor(r,'/blog/sdge-battery-roi-guide/','BATTERY_RETROFIT');
  const selected=selectPartner(context,registry,NOW);
  const payload=JSON.stringify({selected:selected.selected}).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  const html='<section data-partner-v2="'+payload+'"><p>'+selected.selected.disclosure+'</p></section>';
  assert.deepEqual(inspectPartnerHtml(html,selected).errors,[]);
});
