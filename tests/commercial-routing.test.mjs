import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectCommercialRoute,auditCommercialRoutes,INTENT_CHANNELS} from '../src/lib/commercial/routing.ts';
import {buildCommercialCatalog} from '../src/lib/commercial/catalog.ts';
import {COMMERCIAL_INTENTS,CTA_CHANNELS} from '../src/lib/commercial/types.ts';
import {assignExperiment,selectExperimentRoute,observationStatus} from '../src/lib/commercial/experiments.ts';
import {newCommercialCid,buildCommercialOutbound,attributionEnvelope,commercialRouteCurrent} from '../src/lib/commercial/attribution.ts';
import {commercialEvent} from '../src/lib/commercial/events.ts';
import {commercialFixture,NOW,CID} from './fixtures/commercial.mjs';

test('verified permit route selects one configuration with disclosure',()=>{const f=commercialFixture();const s=selectCommercialRoute(f.context,f.catalog,{now:NOW});assert.equal(s.route.channel,'PERMIT_ENGINEERING');assert.match(s.disclosure,/Paid referral/);});
for(const intent of COMMERCIAL_INTENTS)for(const channel of CTA_CHANNELS)test(`intent/channel contract ${intent}/${channel}`,()=>{
  const f=commercialFixture();f.context.intent=intent;f.catalog.pages[0].intent=intent;f.route.allowedIntents=[intent];f.route.channel=channel;
  const s=selectCommercialRoute(f.context,f.catalog,{now:NOW});assert.equal(Boolean(s),INTENT_CHANNELS[intent].includes(channel));
});
const negativeCases={
  'partner inactive':f=>f.catalog.partners[0].active=false,'tracking inactive':f=>f.catalog.partners[0].trackingActive=false,
  'unknown partner':f=>f.route.partnerId='missing-partner','route disabled':f=>f.route.enabled=false,'test route':f=>f.route.testOnly=true,
  'missing approval':f=>f.route.evidence.approvalRef='','missing territory':f=>f.route.evidence.territoryRef='','missing tracking evidence':f=>f.route.evidence.trackingRef='',
  'stale approval':f=>f.route.evidence.expiresAt='2026-09-21','future approval':f=>f.route.evidence.verifiedAt='2027-01-01','impossible date':f=>f.route.evidence.verifiedAt='2026-02-31',
  'wrong state':f=>f.context.state='NV','wrong city':f=>f.context.city='Hemet','unknown utility':f=>f.context.utility=null,
  'split utility notes':f=>f.context.utility.notes='The city is genuinely split between providers','multi record':f=>f.context.recordId='ca-city-multi',
  'utility flag cannot bypass locality guard':f=>{f.route.utilityRequired=false;f.context.utility=null;},
  'page query PII':f=>f.context.pagePath+='?email=private','encoded path':f=>f.context.pagePath='/california/%65scondido/solar-permit-guide/',
  'unapproved page':f=>f.route.pagePaths=[],'page type':f=>f.context.pageType='blog_general','unknown intent':f=>f.context.intent='UNKNOWN',
  'broken destination':f=>f.catalog.destinationHealth[0].ok=false,'missing health':f=>f.catalog.destinationHealth=[],
  'stale destination':f=>f.catalog.destinationHealth[0].checkedAt='2026-09-01T00:00:00Z','future destination':f=>f.catalog.destinationHealth[0].checkedAt='2027-01-01T00:00:00Z',
  'dropped tracking':f=>f.catalog.destinationHealth[0].queryPreserved=false,'foreign redirect':f=>f.catalog.destinationHealth[0].finalUrl='https://evil.example.com/',
  'duplicate route ID':f=>f.catalog.routes.push(structuredClone(f.route)),'duplicate partner ID':f=>f.catalog.partners.push({...f.catalog.partners[0]}),
  'two eligible routes':f=>f.catalog.routes.push({...structuredClone(f.route),id:'second-route'}),
  'tracking PII key':f=>f.route.tracking.fixedParams={email:'secret'},'tracking CID collision':f=>f.route.tracking.cidParam='ref',
  'wrong tracking adapter':f=>f.route.tracking.mode='legacy_csp',
};
for(const [name,mutate]of Object.entries(negativeCases))test(`fail closed: ${name}`,()=>{const f=commercialFixture();mutate(f);assert.equal(selectCommercialRoute(f.context,f.catalog,{now:NOW}),null);});
for(const status of ['RESEARCH','READY','SHADOW'])test(`${status} never renders even during shadow inspection`,()=>{const f=commercialFixture();f.route.status=status;assert.equal(auditCommercialRoutes(f.context,f.catalog,{now:NOW,mode:'shadow'}).selected,null);});
test('approved and healthy fallback only',()=>{const f=commercialFixture();f.catalog.destinationHealth[0].ok=false;f.route.destination.fallbackUrl='https://provider.example.com/form/';f.catalog.destinationHealth.push({...f.catalog.destinationHealth[0],ok:true,url:f.route.destination.fallbackUrl,finalUrl:f.route.destination.fallbackUrl});assert.equal(selectCommercialRoute(f.context,f.catalog,{now:NOW}),null);f.route.destination.approvedFallback=true;assert.equal(selectCommercialRoute(f.context,f.catalog,{now:NOW}).destination,f.route.destination.fallbackUrl);});
test('real Mission Viejo stays blocked using original utility guard',()=>{
  const r=JSON.parse(readFileSync(new URL('../data/localities/ca-orange-mission-viejo-sce.json',import.meta.url)));
  const f=commercialFixture();f.context={...f.context,city:r.city.value,recordId:r.record_id,utility:r.utility,pagePath:'/california/mission-viejo/solar-permit-guide/'};
  f.route.citySlugs=['mission-viejo'];f.route.pagePaths=[f.context.pagePath];f.catalog.pages=[structuredClone(f.context)];assert.ok(auditCommercialRoutes(f.context,f.catalog,{now:NOW}).candidates[0].reasons.includes('UTILITY_UNSAFE'));assert.equal(selectCommercialRoute(f.context,f.catalog,{now:NOW}),null);
});
test('built-in shadow prototypes cannot activate by flipping status alone',()=>{const f=commercialFixture(),c=buildCommercialCatalog();for(const r of c.routes.filter(x=>x.status==='SHADOW')){r.status='ACTIVE';r.enabled=true;f.context.intent=r.allowedIntents[0];assert.equal(selectCommercialRoute(f.context,c,{now:NOW,routeId:r.id}),null);}});
test('page cohort assignment has no cookie or timing dependency; rollback instant',()=>{const f=commercialFixture();assert.equal(assignExperiment(f.experiment,f.context,NOW).variant,'variant');f.experiment.enabled=false;assert.equal(assignExperiment(f.experiment,f.context,NOW),null);});
test('anonymous assignment requires opaque session and is stable across 200 sessions',()=>{const f=commercialFixture();f.experiment.assignment='anonymous_session';assert.equal(assignExperiment(f.experiment,f.context,NOW,'email@example.com'),null);const variants=new Set();for(let i=0;i<200;i++){const id=i.toString(16).padStart(24,'0');const a=assignExperiment(f.experiment,f.context,NOW,id);assert.deepEqual(a,assignExperiment(f.experiment,f.context,NOW,id));variants.add(a.variant);}assert.equal(variants.size,2);});
test('experiment dates, overlap, and variants never override safety',()=>{const f=commercialFixture();assert.equal(assignExperiment(f.experiment,f.context,'2026-10-20T00:00:00Z'),null);assert.equal(selectExperimentRoute([f.experiment,{...f.experiment,id:'overlap'}],f.context,f.catalog,NOW).reason,'OVERLAPPING_EXPERIMENTS');f.catalog.partners[0].active=false;assert.equal(selectExperimentRoute([f.experiment],f.context,f.catalog,NOW).selected,null);});
test('sample language has no winner state and requires both arms',()=>{const f=commercialFixture();assert.equal(observationStatus(f.experiment,{days:28,controlExposures:100,variantExposures:1,reportComplete:true}),'INSUFFICIENT_DATA');assert.equal(observationStatus(f.experiment,{days:28,controlExposures:100,variantExposures:100,reportComplete:false}),'EARLY_SIGNAL');assert.equal(observationStatus(f.experiment,{days:28,controlExposures:100,variantExposures:100,reportComplete:true}),'OBSERVATION_COMPLETE');});
test('generic CIDs never occupy reserved legacy cohort prefixes',()=>{const ids=new Set(Array.from({length:500},newCommercialCid));assert.equal(ids.size,500);for(const cid of ids){assert.match(cid,/^[a-f0-9]{24}$/);assert.doesNotMatch(cid,/^(?:e10[1-3]|f10[1-6])/);}});
test('tracking URL and envelope reject contact values',()=>{const f=commercialFixture(),s=selectCommercialRoute(f.context,f.catalog,{now:NOW});assert.match(buildCommercialOutbound(s,CID),/ref=GridPermit&cid=/);assert.throws(()=>buildCommercialOutbound(s,'person@example.com'));assert.throws(()=>attributionEnvelope(s,CID,'email-list'));assert.equal(attributionEnvelope(s,CID,'organic','experiment-one','variant').channel,'PERMIT_ENGINEERING');s.route.tracking.fixedParams.email='secret';assert.throws(()=>buildCommercialOutbound(s,CID));});
test('generic event fields are explicit; clicks carry only opaque CID',()=>{const f=commercialFixture(),s=selectCommercialRoute(f.context,f.catalog,{now:NOW});assert.equal(commercialEvent('rendered',s).name,'commercial_cta_rendered');assert.throws(()=>commercialEvent('clicked',s));const event=commercialEvent('clicked',s,'none','none',CID);assert.equal(event.params.referral_cid,CID);assert.equal(event.params.email,undefined);});
test('legacy CSP outbound contract and event names preserved',()=>{const f=commercialFixture();f.context.intent='NEW_SOLAR';const c=buildCommercialCatalog([],[structuredClone(f.context)]),r=c.routes.find(r=>r.id==='csp-escondido');const at=new Date(Math.max(Date.parse(NOW),Date.parse(r.evidence.verifiedAt))).toISOString();c.destinationHealth=[{url:r.destination.landingUrl,finalUrl:r.destination.landingUrl,checkedAt:at,ok:true,status:200,queryPreserved:null}];const s=selectCommercialRoute(f.context,c,{now:at});assert.equal(buildCommercialOutbound(s,CID),`https://www.comparesolarprices.net/?ref=GridPermit&cid=${CID}#quote`);assert.equal(commercialEvent('clicked',s,'none','none',CID).name,'cpl_cta_clicked');});

test('invalid external context/config fails closed without throwing',()=>{const f=commercialFixture();assert.equal(selectCommercialRoute(null,f.catalog,{now:NOW}),null);f.catalog.destinationHealth=[null];assert.equal(selectCommercialRoute(f.context,f.catalog,{now:NOW}),null);});
test('same city with substituted utility fails trusted page identity',()=>{const f=commercialFixture();f.context.utility={value:'SCE',notes:'Verified'};assert.ok(auditCommercialRoutes(f.context,f.catalog,{now:NOW}).errors.includes('PAGE_CONTEXT_MISMATCH'));});
test('same-host redirect to wrong city or homepage fails closed',()=>{const f=commercialFixture();f.catalog.destinationHealth[0].finalUrl='https://provider.example.com/';assert.equal(selectCommercialRoute(f.context,f.catalog,{now:NOW}),null);});

test('unreviewed page intent cannot be promoted by caller context alone',()=>{const f=commercialFixture();f.catalog.pages[0].intent='UNKNOWN';assert.equal(selectCommercialRoute(f.context,f.catalog,{now:NOW}),null);});
test('selected generic route expires at health TTL even on a static page',()=>{const f=commercialFixture(),s=selectCommercialRoute(f.context,f.catalog,{now:NOW});assert.equal(s.validUntil,'2026-09-28T18:00:00.000Z');assert.ok(commercialRouteCurrent(s,Date.parse(NOW)));assert.equal(commercialRouteCurrent(s,Date.parse(s.validUntil)),false);});

test('experiment ending before health TTL limits the static CTA lifetime',()=>{const f=commercialFixture();f.experiment.endAt='2026-09-27T00:00:00Z';const r=selectExperimentRoute([f.experiment],f.context,f.catalog,NOW);assert.equal(r.selected.validUntil,'2026-09-27T00:00:00.000Z');});
