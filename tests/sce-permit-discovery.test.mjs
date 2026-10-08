import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const content=readFileSync(new URL('../src/content/blog/sce-add-battery-existing-solar.md',import.meta.url),'utf8');
test('existing SCE retrofit article has a scope-honest local permit-directory handoff',()=>{
 assert.equal((content.match(/\]\(\/california\/utility\/sce\/\)/g)||[]).length,1);
 assert.match(content,/your actual city/);
 assert.match(content,/Do not substitute a neighboring city's rules/);
 assert.match(content,/does not mean that battery quotes or installation services are available throughout SCE territory/);
 assert.ok(content.indexOf('SCE city-guide directory')>content.indexOf('## Is the SCE application the same as the city permit?'));
 assert.ok(content.indexOf('SCE city-guide directory')<content.indexOf('## What if the equipment or output changes?'));
 assert.doesNotMatch(content,/\/go\/|ref=GridPermit|cid=/);
});
test('editorial discovery keeps the article metadata intentional and SEO-safe',()=>{
 assert.match(content,/title: "Add a Battery to Existing SCE Solar: What to Check"/);
 assert.match(content,/pubDate: "2026-09-09"/);assert.match(content,/decisionStage: true/);
 assert.match(content,/description: "What SCE customers should verify before adding battery storage to existing solar/);
});
