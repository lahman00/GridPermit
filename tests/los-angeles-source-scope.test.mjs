import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assessReadyCoreQuality } from "../src/lib/ready-quality.ts";

const record = JSON.parse(readFileSync(new URL("../data/localities/ca-los-angeles-los-angeles-ladwp.json", import.meta.url), "utf8"));

test("Los Angeles keeps unknown municipal fees and review time out of the READY quality gate", () => {
  for (const key of ["permit_fees", "timeline_days"]) {
    assert.equal(record[key].value, null);
    assert.equal(record[key].confidence, 0);
    assert.deepEqual(record[key].source_ids, []);
  }
  const result = assessReadyCoreQuality(record);
  assert.equal(result.passesReadyQualityGate, false);
  assert.equal(result.verifiedCoreCount, 4);
  assert.deepEqual(result.missingCoreFields, ["timeline_days", "permit_fees"]);
  assert.equal(result.recommendedAction, "COMPLETE_CORE_FACTS_PRIORITY");
});

test("Los Angeles separates municipal approval, utility permission and the returned work-request number", () => {
  const docs = record.required_documents.value;
  assert.ok(docs.some((item) => item.required_when.includes("after the application") && item.required_when.includes("not a prerequisite")));
  assert.ok(record.inspection_steps.value.some((step) => step.includes("LADBS approval alone is not permission to operate")));
  assert.ok(record.eligibility_constraints.value.other_conditions.some((item) => item.includes("not a citywide maximum")));
  const ids = new Set(record.sources.map((source) => source.id));
  for (const item of docs) for (const id of item.source_ids) assert.ok(ids.has(id), id);
});
