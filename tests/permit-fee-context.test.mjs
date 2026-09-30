import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const layout=readFileSync(new URL('../src/layouts/LocalityGuideLayout.astro',import.meta.url),'utf8');
test('permit fee context is visible before amounts, including known effective dates and exclusions',()=>{
 const section=layout.slice(layout.indexOf('<section id="permit-fees">'),layout.indexOf('</section>',layout.indexOf('<section id="permit-fees">')));
 assert.match(section,/data-permit-fee-context>\{record\.permit_fees\.notes\}/);
 assert.ok(section.indexOf('data-permit-fee-context')<section.indexOf('record.permit_fees.value'));
 assert.match(section,/fee\.notes && <p class="fact-notes">\{fee\.notes\}/);
});
