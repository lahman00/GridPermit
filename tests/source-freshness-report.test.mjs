// Tests for scripts/source-freshness-report.mjs — the read-only, offline
// content-freshness report over every READY locality record's last_verified
// date and source accessed_date fields. Runs the real script against the
// real repo data (it only ever writes output/source-freshness-report.json)
// so this doubles as a consistency check between the report and the
// records it summarizes.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const SCRIPT = path.join(REPO_ROOT, "scripts", "source-freshness-report.mjs");
const REPORT_PATH = path.join(REPO_ROOT, "output", "source-freshness-report.json");

function runScript() {
	return spawnSync("node", [SCRIPT], { cwd: REPO_ROOT, encoding: "utf8" });
}

test("source-freshness-report.mjs runs cleanly against the real dataset", () => {
	const result = runScript();
	assert.equal(result.status, 0, result.stderr);
});

test("the report covers exactly the 81 verified statewide READY records", () => {
	runScript();
	const report = JSON.parse(readFileSync(REPORT_PATH, "utf8"));
	assert.equal(report.ready_record_count, 81, "expected 81 READY cities to match the verified statewide baseline");
	assert.equal(report.records.length, 81);
});

test("every record's last_verified_age_days is a non-negative integer consistent with its own last_verified date", () => {
	runScript();
	const report = JSON.parse(readFileSync(REPORT_PATH, "utf8"));
	const generatedAt = new Date(report.generated_at);
	for (const r of report.records) {
		assert.ok(r.last_verified, `${r.city}: missing last_verified`);
		assert.ok(Number.isInteger(r.last_verified_age_days), `${r.city}: last_verified_age_days is not an integer`);
		assert.ok(r.last_verified_age_days >= 0, `${r.city}: last_verified_age_days is negative`);
		const expectedDays = Math.floor((generatedAt.valueOf() - new Date(r.last_verified).valueOf()) / (1000 * 60 * 60 * 24));
		assert.equal(r.last_verified_age_days, expectedDays, `${r.city}: age doesn't match its own last_verified date`);
	}
});

test("is_stale is true exactly for records past the report's own stale_threshold_days", () => {
	runScript();
	const report = JSON.parse(readFileSync(REPORT_PATH, "utf8"));
	for (const r of report.records) {
		assert.equal(r.is_stale, r.last_verified_age_days > report.stale_threshold_days, `${r.city}: is_stale inconsistent with its own age`);
	}
	assert.equal(report.stale_count, report.records.filter((r) => r.is_stale).length);
});

test("oldest/newest source accessed dates are never outside the record's own sources[] list", () => {
	runScript();
	const report = JSON.parse(readFileSync(REPORT_PATH, "utf8"));
	const localitiesDir = path.join(REPO_ROOT, "data", "localities");
	for (const r of report.records) {
		const record = JSON.parse(readFileSync(path.join(localitiesDir, `${r.record_id}.json`), "utf8"));
		const realAccessedDates = (record.sources ?? []).map((s) => s.accessed_date).filter(Boolean);
		if (realAccessedDates.length === 0) {
			assert.equal(r.oldest_source_accessed_date, null, `${r.city}: has no sources but reports an oldest accessed date`);
			assert.equal(r.newest_source_accessed_date, null);
			continue;
		}
		assert.ok(realAccessedDates.includes(r.oldest_source_accessed_date), `${r.city}: reported oldest accessed date not found in its own sources[]`);
		assert.ok(realAccessedDates.includes(r.newest_source_accessed_date), `${r.city}: reported newest accessed date not found in its own sources[]`);
		assert.ok(new Date(r.oldest_source_accessed_date) <= new Date(r.newest_source_accessed_date), `${r.city}: oldest accessed date is after newest`);
	}
});

test("records are sorted by last_verified_age_days, oldest (largest age) first", () => {
	runScript();
	const report = JSON.parse(readFileSync(REPORT_PATH, "utf8"));
	const ages = report.records.map((r) => r.last_verified_age_days);
	const sorted = [...ages].sort((a, b) => b - a);
	assert.deepEqual(ages, sorted);
});
