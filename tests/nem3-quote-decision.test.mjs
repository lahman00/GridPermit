import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/pages/blog/solar-battery-payback-nem3.astro',import.meta.url),'utf8');

test('NEM3 quote guide does not present unmodeled payback ranges or fixed statewide import/export prices',()=>{
 for(const claim of ['8 - 11 Years','5 - 8 Years','$0.05/kWh','$0.50/kWh','credits dropped by ~75%']) assert.ok(!source.includes(claim),`Unsupported generalization still present: ${claim}`);
});
test('battery dispatch and bill claims are conditional, not a promise to cover every peak hour',()=>{
 assert.ok(!source.includes('No, but it covers the peak hours'));
 assert.match(source,/backup reserve/i);assert.match(source,/remaining bill/i);
});
test('the quote checklist is real, local navigation and requires no contact submission',()=>{
 assert.match(source,/id="quote-checklist"/);assert.match(source,/href="#quote-checklist"/);
 assert.match(source,/incremental/i);assert.match(source,/cash price/i);
 assert.ok(!/<form\b|<input\b|<textarea\b/.test(source));
});
test('current billing and residential-credit guidance has identifiable primary sources',()=>{
 for(const host of ['www.cpuc.ca.gov','www.pge.com','www.sce.com','www.sdge.com','www.irs.gov']) assert.ok(source.includes(`https://${host}/`),`Missing primary source: ${host}`);
 assert.match(source,/December 31, 2025/);assert.match(source,/municipal utilities/i);
});
test('editorial repair preserves URL, title, headline and the existing fail-closed partner component',()=>{
 assert.ok(source.includes('const TITLE = "California NEM 3.0 Solar & Battery Payback Guide (2026 Audit)";'));
 assert.ok(source.includes('const HEADLINE = "The California NEM 3.0 Solar & Battery Payback Guide (2026)";'));
 assert.ok(source.includes('const CANONICAL_URL = "https://mygridpermit.com/blog/solar-battery-payback-nem3/";'));
 assert.equal((source.match(/<HardwareAffiliateCTA\b/g)||[]).length,1);
 assert.ok(source.includes('<HardwareAffiliateCTA productLabel="Battery and backup-power products" state="CA" />'));
 assert.ok(!source.includes('datePublished:'));assert.ok(!source.includes('8 min read'));
});
test('existing SCE locality links stay permit-only and retrofit readers keep distinct utility-specific paths',()=>{
 for(const city of ['apple-valley','moreno-valley','chino','whittier','yucaipa']) assert.ok(source.includes(`/california/${city}/solar-permit-guide/`));
 assert.ok(source.includes('/blog/sce-add-battery-existing-solar/'));
 assert.ok(source.includes('/blog/sdge-battery-roi-guide/'));
 assert.match(source,/not a statement of installer coverage/i);
});
