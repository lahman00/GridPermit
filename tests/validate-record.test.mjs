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
		schema_version: "1.4.0",
		state: "CA",
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

test("a municipal permit fee sourced to the issuing government is not an unsupported claim", async () => {
	const r = baseRecord();
	r.permit_fees = { value: [{ name: "Residential photovoltaic permit", amount_usd: 250, unit: "flat", notes: null }], confidence: 0.9, source_ids: ["S1"] };
	const report = await validate(writeFixture(r));
	assert.equal(report.warnings.some((w) => w.category === "unsupported_claim" && w.field === "permit_fees"), false);
});

test("a rebate amount sourced only to a generic government page remains an unsupported claim", async () => {
	const r = baseRecord();
	r.rebates = {
		value: [{ name: "Test rebate", administrator: "Test Utility", description: "Fixture incentive", value_usd_per_kwh: null, value_usd_flat: 250, value_usd_per_watt: null, eligibility: null, url: null, effective_from: null, expires_on: null, status: "unknown" }],
		confidence: 0.7,
		source_ids: ["S1"],
	};
	const report = await validate(writeFixture(r));
	assert.ok(report.warnings.some((w) => w.category === "unsupported_claim" && w.field === "rebates"));
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

test("schema_version must be exactly '1.4.0' — any other value is a schema_violation error", async () => {
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

// --- capture attestations for URLs that refuse automated requests ---

test("a blocked URL is covered only by a valid, recent capture of the exact URL for the same record", async () => {
	const { captureCovering, CAPTURE_MAX_AGE_DAYS } = await import("../scripts/validate-record.mjs");
	const record = { record_id: "co-test-city-xcel", last_verified: "2026-11-20" };
	const url = "https://www.example-city.gov/building/solar";
	const blocked = { url, status: "BLOCKED_OR_UNVERIFIABLE", http_status: 403 };
	const capture = { url, http_status: 200, sha256: "a".repeat(64), bytes: 1234, captured_at: "2026-11-20T14:11:57Z", method: "headless-browser" };
	const attestation = { record_id: "co-test-city-xcel", captures: [capture] };
	const now = new Date("2026-11-21T00:00:00Z");
	assert.equal(captureCovering(blocked, attestation, record, now), capture);
	assert.equal(captureCovering({ ...blocked, http_status: 429 }, attestation, record, now), capture);
	// Not an explicit refusal: a timeout, a 5xx or a bot-challenge page can hide a dead page.
	assert.equal(captureCovering({ ...blocked, http_status: null }, attestation, record, now), null);
	assert.equal(captureCovering({ ...blocked, http_status: 503 }, attestation, record, now), null);
	assert.equal(captureCovering({ ...blocked, http_status: 200 }, attestation, record, now), null);
	// A confirmed-broken or reachable URL is never touched.
	assert.equal(captureCovering({ ...blocked, status: "CONFIRMED_BROKEN", http_status: 404 }, attestation, record, now), null);
	// Wrong URL, wrong record, missing file.
	assert.equal(captureCovering({ ...blocked, url: url + "/" }, attestation, record, now), null);
	assert.equal(captureCovering(blocked, { ...attestation, record_id: "co-other-city-xcel" }, record, now), null);
	assert.equal(captureCovering(blocked, null, record, now), null);
	// Capture did not succeed, has no hash, is empty, is in the future, or is too old.
	for (const bad of [{ http_status: 403 }, { sha256: "abc" }, { bytes: 0 }, { captured_at: "2026-11-22T00:00:00Z" }, { captured_at: "2026-09-01T00:00:00Z" }, { captured_at: "not a date" }]) {
		assert.equal(captureCovering(blocked, { ...attestation, captures: [{ ...capture, ...bad }] }, record, now), null, JSON.stringify(bad));
	}
	assert.equal(CAPTURE_MAX_AGE_DAYS, 30);
});

test("no published record changes score: attestations exist only for records that cite them", async () => {
	const { readdirSync, readFileSync, existsSync } = await import("node:fs");
	const { CAPTURE_ATTESTATION_DIR } = await import("../scripts/validate-record.mjs");
	const files = existsSync(CAPTURE_ATTESTATION_DIR) ? readdirSync(CAPTURE_ATTESTATION_DIR).filter((f) => f.endsWith(".json")) : [];
	for (const file of files) {
		const attestation = JSON.parse(readFileSync(path.join(CAPTURE_ATTESTATION_DIR, file), "utf8"));
		assert.equal(`${attestation.record_id}.json`, file);
		const record = JSON.parse(readFileSync(path.join(CAPTURE_ATTESTATION_DIR, "..", "localities", file), "utf8"));
		const cited = new Set(JSON.stringify(record).match(/https?:\/\/[^"\\]+/g) ?? []);
		for (const capture of attestation.captures) {
			assert.ok(cited.has(capture.url), `${file}: ${capture.url} is not cited by the record`);
			assert.match(capture.sha256, /^[0-9a-f]{64}$/);
			assert.equal(Number(capture.http_status), 200);
		}
	}
});
