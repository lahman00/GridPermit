import test from "node:test";
import assert from "node:assert/strict";
import { assessReadyCoreQuality, READY_CORE_FIELDS } from "../src/lib/ready-quality.ts";
import { buildReadyQualityAudit } from "../scripts/build-ready-quality-audit.mjs";

function record(overrides = {}) {
	const fact = { value: "verified", confidence: 0.8, source_ids: ["S1"] };
	return Object.fromEntries(READY_CORE_FIELDS.map((name) => [name, structuredClone(fact)]).concat(Object.entries(overrides)));
}

test("a missing core field counts once and does not also fail low confidence", () => {
	const result = assessReadyCoreQuality(record({ permit_fees: { value: null, confidence: 0, source_ids: [] } }));
	assert.deepEqual(result.missingCoreFields, ["permit_fees"]);
	assert.deepEqual(result.lowConfidenceCoreFields, []);
	assert.equal(result.passesReadyQualityGate, true);
});

test("the audit gate fails more than one missing field without recommending immediate noindex", () => {
	const result = assessReadyCoreQuality(record({
		permit_fees: { value: null, confidence: 0, source_ids: [] },
		inspection_steps: { value: null, confidence: 0, source_ids: [] },
	}));
	assert.equal(result.passesReadyQualityGate, false);
	assert.equal(result.reviewForNoindex, false);
	assert.equal(result.recommendedAction, "COMPLETE_CORE_FACTS_PRIORITY");
});

test("the visible verified count excludes populated facts with weak confidence or no source", () => {
	const result = assessReadyCoreQuality(record({
		timeline_days: { value: "verified", confidence: 0.3, source_ids: ["S1"] },
		permit_fees: { value: "verified", confidence: 0.8, source_ids: [] },
	}));
	assert.equal(result.populatedCoreCount, 6);
	assert.equal(result.verifiedCoreCount, 4);
});

test("only the severe review threshold recommends noindex review", () => {
	const missing = { value: null, confidence: 0, source_ids: [] };
	const threeMissing = assessReadyCoreQuality(record({ permit_fees: missing, inspection_steps: missing, timeline_days: missing }));
	const veryLowConfidence = assessReadyCoreQuality(record({ timeline_days: { value: "verified", confidence: 0.29, source_ids: ["S1"] } }));
	assert.equal(threeMissing.recommendedAction, "REVIEW_FOR_NOINDEX");
	assert.equal(veryLowConfidence.recommendedAction, "REVIEW_FOR_NOINDEX");
});

test("all 351 published guides appear in the audit and no status is mutated", async () => {
	const rows = await buildReadyQualityAudit();
	assert.equal(rows.length, 351);
	assert.deepEqual(rows.map((row) => row.traffic_priority), Array.from({ length: 351 }, (_, index) => index + 1));
	assert.equal(rows.filter((row) => row.ready_quality_gate.startsWith("FAIL")).length, 141);
	assert.ok(rows.every((row) => ["KEEP_INDEXED_MONITOR", "COMPLETE_CORE_FACTS_PRIORITY", "REVIEW_FOR_NOINDEX"].includes(row.recommended_action)));
	assert.ok(rows.some((row) => row.traffic_evidence_status === "UNKNOWN_FULL_PRIVATE_EXPORT_UNAVAILABLE"));
});
