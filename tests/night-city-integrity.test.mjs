import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hasVerifiedUnambiguousUtility} from '../src/lib/utility-split-guard.ts';
import {REQUIRED_CITY_SLUGS} from '../scripts/release-preservation-check.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const ids=['ca-los-angeles-lancaster-sce','ca-riverside-cathedral-city-sce','ca-riverside-indio-iid','ca-riverside-palm-springs-sce'];
test('all four new city guides retain unknown fees and conditional paired program, never fabricated awards',()=>{
 for(const id of ids){const r=read('data/localities/'+id+'.json');assert.equal(r.permit_fees.value,null,id);assert.equal(hasVerifiedUnambiguousUtility(r),true,id);assert.ok(REQUIRED_CITY_SLUGS.includes(r.city.value.toLowerCase().replaceAll(' ','-')));for(const program of r.rebates.value){assert.equal(program.status,'unknown');assert.equal(program.value_usd_flat,null);assert.equal(program.value_usd_per_watt,null);assert.match(program.description,/paired/i);assert.match(program.description,/waitlist/i);} }
});
test('unverified earlier checklist, fees and one-day timing were not imported as factual data',()=>{
 const l=read('data/localities/ca-los-angeles-lancaster-sce.json'),c=read('data/localities/ca-riverside-cathedral-city-sce.json');assert.equal(l.required_documents.value,null);assert.equal(l.timeline_days.value,null);assert.equal(c.permit_fees.value,null);assert.equal(c.generation_supplier.value,null);
});
test('IID electric distribution is never misrepresented as SCE or SoCalGas distribution',()=>{
 const r=read('data/localities/ca-riverside-indio-iid.json');assert.equal(r.utility.value,'Imperial Irrigation District');assert.match(r.rebates.value[0].administrator,/SoCalGas/);assert.equal(r.generation_supplier.value,null);assert.match(r.battery_programs.notes,/not a claim about gas service/);
});
