import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {formatTimeline,buildFaqs,NOT_VERIFIED} from '../src/lib/locality-guide.ts';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
test('maximum-only source renders its real bound without inventing a zero minimum',()=>{
 const value={min_days:null,max_days:3,notes:'Within three business days for checklist-compliant small rooftop systems; not inspection or PTO.'};
 const before=JSON.stringify(value),d=formatTimeline(value);assert.equal(d.label,'Up to 3 business days');assert.match(d.standardPathCaveat,/upper bound/);assert.equal(JSON.stringify(value),before);assert.equal(d.isSameDaySolarAppOnly,false);
});
test('lower-bound-only, singular, missing and invalid values stay honest',()=>{
 assert.equal(formatTimeline({min_days:1,max_days:null,notes:null}).label,'At least 1 day');
 assert.equal(formatTimeline({min_days:null,max_days:1,notes:'one business day'}).label,'Up to 1 business day');
 for(const td of [{min_days:null,max_days:null},{},{min_days:-1,max_days:3},{min_days:4,max_days:2},{min_days:'1',max_days:3},{min_days:NaN,max_days:3}])assert.equal(formatTimeline(td).label,NOT_VERIFIED);
});
test('ambiguous day-unit notes do not invent a business-day unit',()=>{
 assert.equal(formatTimeline({min_days:null,max_days:3,notes:'Business days and calendar days differ.'}).label,'Up to 3 days');
});
test('Palm Springs upper-bound FAQ preserves the exact checklist and permit-only conditions',()=>{
 const r=read('data/localities/ca-riverside-palm-springs-sce.json');assert.equal(r.timeline_days.value.min_days,null);
 const d=formatTimeline(r.timeline_days.value);assert.equal(d.label,'Up to 3 business days');
 const faq=buildFaqs(r).find(f=>f.q.includes('permit take'));assert.ok(faq.a.includes(r.timeline_days.value.notes));assert.match(faq.a,/upper bound/);
});
test('new shortcut is an internal scroll only and actual rendered approval remains the eligibility authority',()=>{
 const layout=readFileSync(new URL('../src/layouts/LocalityGuideLayout.astro',import.meta.url),'utf8');
 assert.match(layout,/data-approved-quote-jump hidden/);assert.match(layout,/#installer-cta button\[data-compare-solar-cta\]/);assert.match(layout,/shortcut.hidden = !document.querySelector/);assert.match(layout,/scroll-margin-top: 8rem/);
});

test('complete ranges are not reinterpreted from a different stage mentioned in notes',()=>{
 assert.equal(formatTimeline({min_days:0,max_days:3,notes:'Expedited within 3 days; other full review 4-5 business days.'}).label,'0–3 days');
 const layout=readFileSync(new URL('../src/layouts/LocalityGuideLayout.astro',import.meta.url),'utf8');assert.match(layout,/overflow-wrap: anywhere/);
});
