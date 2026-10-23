import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const record = JSON.parse(readFileSync(new URL('../data/localities/ca-santa-clara-monte-sereno-pge.json', import.meta.url)));
test('Monte Sereno fee refresh retains source precision and warns total billing is unknown', () => {
  assert.equal(record.permit_fees.value[0].amount_usd, 196.1944);
  assert.match(record.permit_fees.value[0].notes, /not proof of the complete project-specific permit bill/i);
  assert.deepEqual(record.permit_fees.source_ids, ['S4']);
  const source=record.sources.find(x=>x.id==='S4');
  assert.match(source.url,/DocumentCenter\/View\/4427/);
  assert.equal(source.accessed_date,'2026-10-23');
  assert.equal(record.last_verified,'2026-08-08');
});
