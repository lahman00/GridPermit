import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {hasVerifiedUnambiguousUtility} from '../src/lib/utility-split-guard.ts';
import {isCompareSolarServedLocality,buildCompareSolarReferralUrl} from '../src/lib/compare-solar-prices.ts';
import {calculateCompleteness,classifyReadiness} from '../scripts/lib/revenue-intelligence.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const evaluation=read('output/aaron-approved-city-batch-evaluation.json');
const published=new Set(['palmdale','long-beach','santa-clarita']);
test('all ten records retain independent computed readiness and only the three READY records have routes',()=>{
 assert.equal(evaluation.records.length,10);
 for(const row of evaluation.records){
  const r=read('data/localities/'+row.record_id+'.json'),v=read('output/validation-reports/'+row.record_id+'.json'),c=calculateCompleteness(r);
  const readiness=classifyReadiness({completenessPct:c.completeness_pct,validationScore:v.score,errorCount:v.errors.length});
  assert.equal(row.readiness,readiness,row.record_id);assert.equal(v.errors.length,0,row.record_id);
  const slug=r.city.value.toLowerCase().replaceAll(' ','-');
  assert.equal(existsSync(new URL('../src/pages/california/'+slug+'/solar-permit-guide.astro',import.meta.url)),published.has(slug),slug);
  if(published.has(slug)){assert.equal(readiness,'READY');assert.equal(hasVerifiedUnambiguousUtility(r),true);assert.equal(isCompareSolarServedLocality('CA',r.city.value),true);
   const u=new URL(buildCompareSolarReferralUrl('CA',r.city.value,'a'.repeat(24)));assert.equal(u.searchParams.get('ref'),'GridPermit');assert.equal(u.hash,'#quote');}
 }
});
for(const slug of ['indian-wells','palm-desert','rancho-mirage'])test(slug+' remains a real split-utility hold despite commercial city approval',()=>{
 const r=read('data/localities/ca-riverside-'+slug+'-multi.json');assert.equal(r.utility.value,null);assert.equal(hasVerifiedUnambiguousUtility(r),false);assert.match(r.utility.notes,/split-territory/i);
});
test('Aaron-confirmed September 30 seven-city batch now passes commercial geography while keeping existing page and utility gates',()=>{
 for(const city of ['Duarte','Norco','Brea','Inglewood','Baldwin Park','Fountain Valley','Del Mar']){
  assert.equal(isCompareSolarServedLocality('CA',city),true,city);
  const slug=city.toLowerCase().replaceAll(' ','-');
  assert.equal(existsSync(new URL('../src/pages/california/'+slug+'/solar-permit-guide.astro',import.meta.url)),true,slug);
  const u=new URL(buildCompareSolarReferralUrl('CA',city,'b'.repeat(24)));
  assert.equal(u.searchParams.get('ref'),'GridPermit');assert.equal(u.searchParams.get('cid'),'b'.repeat(24));assert.equal(u.hash,'#quote');
 }
});
test('Long Beach old fees cannot be presented without their explicit September 30 cutoff',()=>{
 const f=read('data/localities/ca-los-angeles-long-beach-sce.json').permit_fees;assert.match(f.notes,/must NOT be treated as current.*2026-10-01/);
 for(const row of f.value){assert.match(row.name,/through 2026-09-30/);assert.match(row.notes,/Not verified.*2026-10-01/);}
});
