import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const record = JSON.parse(readFileSync(new URL('../data/localities/ca-orange-rancho-santa-margarita-sce.json', import.meta.url)));

test('Rancho Santa Margarita 2026 solar fee cites the current City schedule without calling it total cost', () => {
  const row = record.permit_fees.value.find(x => x.name === 'Solar Panels');
  assert.equal(row.amount_usd, 97.70);
  assert.equal(row.unit, 'each');
  assert.match(row.notes, /does not establish the total solar permit cost/i);
  assert.equal(record.permit_fees.confidence, 0.5);
  const source = record.sources.find(x => x.id === 'S7');
  assert.equal(source.accessed_date, '2026-10-23');
  assert.match(source.url, /DocumentCenter\/View\/13798/);
  assert.match(source.title, /October 12, 2026/);
});
