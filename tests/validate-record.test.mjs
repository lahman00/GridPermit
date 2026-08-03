// Coverage for scripts/validate-record.mjs — the single gate that decides
// whether a locality record's facts are structurally sound before the
// READY/LIMITED classification in scripts/evaluate-*.mjs ever looks at it.
// This file existed with zero dedicated tests before this change (only
// exercised indirectly, live, against the real dataset).
//
// Fixture records use no populated URL fields except where a test targets
// URL handling specifically, and those use malformed/unsupported-protocol
// URLs — both are rejected by validate-record.mjs's pre-flight checks
// before any network call, so this whole suite runs fully offline and
// deterministically (no live fetch, no flakiness).

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { validate } from "../scripts/validate-record.mjs";

const tmpDir = mkdtempSync(path.join(tmpdir(), "gridpermit-validator-test-"));
let fixtureCounter = 0;

// A minimal, schema-valid record: every field present and null/empty,
// confidence 0, no sources referenced. Mutate a deep-cloned copy per test.
function baseRecord() {
	const nullField = { value: null, confidence: 0, source_ids: [] };
	return {
		record_id: "ca-test-county-testville-pge",
		schema_version: "1.3.0",
		utility: { value: "Test Utility", confidence: 0.9, source_ids: ["S1"] },
		generation_supplier: nullField,
		city: { value: "Testville", confidence: 1, source_ids: ["S1"] },
		county: { value: "Test County", confidence: 1, source_ids: ["S1"] },
		permit_authority: { value: "Testville Building Division", confidence: 0.9, source_ids: ["S1"] },
		permit_url: nullField,
		interconnection_url: nullField,
		battery_programs: nullField,
		required_documents: nullField,
		inspection_steps: nullField,
		timeline_days: nullField,
		eligibility_constraints: nullField,
		permit_fees: nullField,
		rebates: nullField,
		official_contacts: nullField,
		last_verified: "2026-01-01",
		sources: [
			{ id: "S1", title: "Testville Official Site", url: "https://example.com/", publisher: "City of Testville", type: "government", accessed_date: "2026-01-01" },
		],
	};
}

function writeFixture(record) {
	fixtureCounter += 1;
	const filePath = path.join(tmpDir, `fixture-${fixtureCounter}.json`);
	writeFileSync(filePath, JSON.stringify(record, null, 2), "utf8");
	return filePath;
}

test.after(() => rmSync(tmpDir, { recursive: true, force: true }));

test("a minimal valid record passes with 0 errors", async () => {
	const report = await validate(writeFixture(baseRecord()));
	assert.equal(report.errors.length, 0);
	assert.notEqual(report.status, "FAIL");
});

test("a non-null field with confidence 0 is a confidence_inconsistency error", async () => {
	const r = baseRecord();
	r.utility = { value: "Test Utility", confidence: 0, source_ids: ["S1"] };
	const report = await validate(writeFixture(r));
	assert.ok(report.errors.some((e) => e.category === "confidence_inconsistency"));
});

test("a null field with confidence > 0 is a confidence_inconsistency error", async () => {
	const r = baseRecord();
	r.generation_supplier = { value: null, confidence: 0.5, source_ids: [] };
	const report = await validate(writeFixture(r));
	assert.ok(report.errors.some((e) => e.category === "confidence_inconsistency"));
});

test("an empty-string value is an impossible_value error, not a valid 'unknown' state", async () => {
	const r = baseRecord();
	r.utility = { value: "", confidence: 0.5, source_ids: ["S1"] };
	const report = await validate(writeFixture(r));
	assert.ok(report.errors.some((e) => e.category === "impossible_value"));
});

test("a source_ids entry with no matching sources[] id is a missing_source error", async () => {
	const r = baseRecord();
	r.utility = { value: "Test Utility", confidence: 0.9, source_ids: ["S99"] };
	const report = await validate(writeFixture(r));
	assert.ok(report.errors.some((e) => e.category === "missing_source" && e.message.includes("S99")));
});

test("two sources sharing the same id is a duplicate_source error", async () => {
	const r = baseRecord();
	r.sources.push({ id: "S1", title: "Duplicate", url: "https://example.com/dup", publisher: "Dup", type: "government", accessed_date: "2026-01-01" });
	const report = await validate(writeFixture(r));
	assert.ok(report.errors.some((e) => e.category === "duplicate_source"));
});

test("timeline_days.min_days greater than max_days is an impossible_value error", async () => {
	const r = baseRecord();
	r.timeline_days = { value: { min_days: 10, max_days: 3, notes: "bad range" }, confidence: 0.8, source_ids: ["S1"] };
	const report = await validate(writeFixture(r));
	assert.ok(report.errors.some((e) => e.category === "impossible_value" && e.field === "timeline_days"));
});

test("timeline_days with negative min_days is an impossible_value error", async () => {
	const r = baseRecord();
	r.timeline_days = { value: { min_days: -1, max_days: 5, notes: "negative" }, confidence: 0.8, source_ids: ["S1"] };
	const report = await validate(writeFixture(r));
	assert.ok(report.errors.some((e) => e.category === "impossible_value" && e.field === "timeline_days"));
});

test("timeline_days with both min_days and max_days null (but a real note) is not an error — the honest 'not stated' shape", async () => {
	const r = baseRecord();
	r.timeline_days = { value: { min_days: null, max_days: null, notes: "No source stated a specific day range." }, confidence: 0.5, source_ids: ["S1"] };
	const report = await validate(writeFixture(r));
	assert.equal(report.errors.filter((e) => e.field === "timeline_days").length, 0);
});

test("a future last_verified date is an impossible_value error", async () => {
	const r = baseRecord();
	r.last_verified = "2099-01-01";
	const report = await validate(writeFixture(r));
	assert.ok(report.errors.some((e) => e.category === "impossible_value" && e.field === "last_verified"));
});

test("a future source accessed_date is an impossible_value error", async () => {
	const r = baseRecord();
	r.sources[0].accessed_date = "2099-01-01";
	const report = await validate(writeFixture(r));
	assert.ok(report.errors.some((e) => e.category === "impossible_value" && e.message.includes("accessed_date")));
});

test("a missing required top-level key is a missing_required_field error", async () => {
	const r = baseRecord();
	delete r.county;
	const report = await validate(writeFixture(r));
	assert.ok(report.errors.some((e) => e.category === "missing_required_field" && e.field === "county"));
});

test("a negative permit_fees amount_usd is an impossible_value error", async () => {
	const r = baseRecord();
	r.permit_fees = { value: [{ name: "Bad Fee", amount_usd: -50, unit: "flat", notes: null }], confidence: 0.5, source_ids: ["S1"] };
	const report = await validate(writeFixture(r));
	assert.ok(report.errors.some((e) => e.category === "impossible_value" && e.field === "permit_fees"));
});

test("a malformed URL is a CONFIRMED_BROKEN broken_url error, with no live network call", async () => {
	const r = baseRecord();
	r.permit_url = { value: "not a valid url::", confidence: 0.5, source_ids: ["S1"] };
	const report = await validate(writeFixture(r));
	assert.ok(report.errors.some((e) => e.category === "broken_url" && e.field === "permit_url"));
	const check = report.url_checks.find((c) => c.url === "not a valid url::");
	assert.equal(check.status, "CONFIRMED_BROKEN");
});

test("an unsupported protocol URL (e.g. ftp://) is a CONFIRMED_BROKEN broken_url error", async () => {
	const r = baseRecord();
	r.interconnection_url = { value: "ftp://example.com/nem", confidence: 0.5, source_ids: ["S1"] };
	const report = await validate(writeFixture(r));
	const check = report.url_checks.find((c) => c.url === "ftp://example.com/nem");
	assert.equal(check.status, "CONFIRMED_BROKEN");
});

test("schema_version must be exactly '1.3.0' — any other value is a schema_violation error", async () => {
	const r = baseRecord();
	r.schema_version = "1.2.0";
	const report = await validate(writeFixture(r));
	assert.ok(report.errors.some((e) => e.category === "schema_violation"));
});

test("record_id must match the kebab-case pattern — a record_id with an underscore is a schema_violation error", async () => {
	const r = baseRecord();
	r.record_id = "ca_test_county_testville_pge";
	const report = await validate(writeFixture(r));
	assert.ok(report.errors.some((e) => e.category === "schema_violation"));
});
