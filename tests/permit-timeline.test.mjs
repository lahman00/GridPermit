// Tests for src/lib/permit-timeline.ts — the data-shaping logic behind
// src/pages/california/solar-permit-timeline.astro. Every figure this page
// shows must trace to a real READY record's own timeline_days field; these
// tests exist specifically to catch any drift toward inventing or
// generalizing a number the underlying data doesn't state.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildTimelineInsights } from "../src/lib/permit-timeline.ts";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function makeRecord({ city, county = "Test County", utility = "PG&E", timeline = null, state = "CA" }) {
	return {
		state,
		city: { value: city },
		county: { value: county },
		utility: { value: utility },
		generation_supplier: { value: null },
		last_verified: "2026-01-01",
		timeline_days: { value: timeline },
	};
}

test("buildTimelineInsights excludes records with no timeline_days value at all", () => {
	const evaluationRecords = [{ record_id: "a", readiness: "READY", completeness_pct: 90 }];
	const recordsById = new Map([["a", makeRecord({ city: "A City", timeline: null })]]);
	const insights = buildTimelineInsights(evaluationRecords, recordsById);
	assert.equal(insights.documentedCount, 0);
});

test("buildTimelineInsights excludes a timeline_days value whose min_days/max_days are both null ('not verified')", () => {
	const evaluationRecords = [{ record_id: "a", readiness: "READY", completeness_pct: 90 }];
	const recordsById = new Map([
		["a", makeRecord({ city: "A City", timeline: { min_days: null, max_days: null, notes: "qualitative only" } })],
	]);
	const insights = buildTimelineInsights(evaluationRecords, recordsById);
	assert.equal(insights.documentedCount, 0);
});

test("buildTimelineInsights excludes LIMITED/NOT_READY records", () => {
	const evaluationRecords = [{ record_id: "a", readiness: "LIMITED", completeness_pct: 60 }];
	const recordsById = new Map([
		["a", makeRecord({ city: "A City", timeline: { min_days: 1, max_days: 5, notes: null } })],
	]);
	const insights = buildTimelineInsights(evaluationRecords, recordsById);
	assert.equal(insights.readyCount, 0);
	assert.equal(insights.documentedCount, 0);
});

test("a 0/0 range is classified as same-day SolarAPP+, not a standard-path example, and never touches overall min/max", () => {
	const evaluationRecords = [{ record_id: "a", readiness: "READY", completeness_pct: 90 }];
	const recordsById = new Map([
		["a", makeRecord({ city: "Same Day City", timeline: { min_days: 0, max_days: 0, notes: null } })],
	]);
	const insights = buildTimelineInsights(evaluationRecords, recordsById);
	assert.equal(insights.sameDaySolarAppCount, 1);
	assert.equal(insights.sameDaySolarAppExamples[0].city, "Same Day City");
	assert.equal(insights.standardPathExamples.length, 0);
	assert.equal(insights.overallMinDays, null);
	assert.equal(insights.overallMaxDays, null);
});

test("a real min/max range is classified as standard-path and folded into overall min/max", () => {
	const evaluationRecords = [
		{ record_id: "a", readiness: "READY", completeness_pct: 90 },
		{ record_id: "b", readiness: "READY", completeness_pct: 90 },
	];
	const recordsById = new Map([
		["a", makeRecord({ city: "Fast City", timeline: { min_days: 1, max_days: 3, notes: null } })],
		["b", makeRecord({ city: "Slow City", timeline: { min_days: 10, max_days: 30, notes: null } })],
	]);
	const insights = buildTimelineInsights(evaluationRecords, recordsById);
	assert.equal(insights.standardPathExamples.length, 2);
	assert.equal(insights.overallMinDays, 1);
	assert.equal(insights.overallMaxDays, 30);
});

test("standardPathExamples is sorted fastest (lowest maxDays) first", () => {
	const evaluationRecords = [
		{ record_id: "a", readiness: "READY", completeness_pct: 90 },
		{ record_id: "b", readiness: "READY", completeness_pct: 90 },
	];
	const recordsById = new Map([
		["a", makeRecord({ city: "Slow City", timeline: { min_days: 10, max_days: 30, notes: null } })],
		["b", makeRecord({ city: "Fast City", timeline: { min_days: 1, max_days: 3, notes: null } })],
	]);
	const insights = buildTimelineInsights(evaluationRecords, recordsById);
	assert.deepEqual(
		insights.standardPathExamples.map((e) => e.city),
		["Fast City", "Slow City"],
	);
});

test("example lists are bounded by the limit parameter", () => {
	const evaluationRecords = Array.from({ length: 10 }, (_, i) => ({
		record_id: `city-${i}`,
		readiness: "READY",
		completeness_pct: 90,
	}));
	const recordsById = new Map(
		evaluationRecords.map((e, i) => [
			e.record_id,
			makeRecord({ city: `City ${i}`, timeline: { min_days: i, max_days: i + 1, notes: null } }),
		]),
	);
	const insights = buildTimelineInsights(evaluationRecords, recordsById, 3);
	assert.equal(insights.standardPathExamples.length, 3);
	// documentedCount, standardPathCount, and overall min/max still reflect
	// the full dataset, not just the bounded example list — the limit only
	// trims what's displayed.
	assert.equal(insights.documentedCount, 10);
	assert.equal(insights.standardPathCount, 10);
	assert.equal(insights.overallMinDays, 0);
	assert.equal(insights.overallMaxDays, 10);
});

test("buildTimelineInsights runs cleanly against the real dataset with figures consistent with the underlying records", () => {
	const localitiesDir = path.join(REPO_ROOT, "data", "localities");
	const outputDir = path.join(REPO_ROOT, "output");
	const recordsById = new Map(
		readdirSync(localitiesDir)
			.filter((f) => f.endsWith(".json"))
			.map((f) => {
				const record = JSON.parse(readFileSync(path.join(localitiesDir, f), "utf8"));
				return [record.record_id, record];
			}),
	);
	const evaluationFiles = readdirSync(outputDir).filter(
		(f) => f.endsWith(".json") && f !== "research-progress-report.json" && f !== "statewide-research-queue.json" && f !== "site-inventory.json" && f !== "source-freshness-report.json" && f !== "source-health-report.json",
	);
	const allEvaluatedRecords = evaluationFiles.flatMap(
		(f) => JSON.parse(readFileSync(path.join(outputDir, f), "utf8")).records ?? [],
	);
	const insights = buildTimelineInsights(allEvaluatedRecords, recordsById);

	// Deduped by most-recent evaluated_at per record_id, same logic as
	// scripts/source-freshness-report.mjs — computed here rather than
	// hardcoded, since this mission's whole purpose is to grow this number.
	const latestByRecordId = new Map();
	for (const file of evaluationFiles) {
		const data = JSON.parse(readFileSync(path.join(outputDir, file), "utf8"));
		for (const r of data.records ?? []) {
			const existing = latestByRecordId.get(r.record_id);
			if (!existing || new Date(data.evaluated_at) > new Date(existing.evaluated_at)) {
				latestByRecordId.set(r.record_id, { ...r, evaluated_at: data.evaluated_at });
			}
		}
	}
	const expectedReadyCount = [...latestByRecordId.values()].filter((r) => r.readiness === "READY").length;
	assert.equal(insights.readyCount, expectedReadyCount, "readyCount should match a fresh, deduplicated tally of the real dataset");
	assert.ok(insights.documentedCount > 0, "expected at least one READY city to have a documented timeline");
	assert.equal(
		insights.documentedCount,
		insights.sameDaySolarAppCount + insights.standardPathCount,
		"documentedCount must equal the sum of the two classified buckets",
	);

	// Every example actually traces back to its own record's real value —
	// this is the core anti-fabrication check for this module.
	for (const example of [...insights.sameDaySolarAppExamples, ...insights.standardPathExamples]) {
		const record = [...recordsById.values()].find((r) => r.city.value === example.city);
		assert.ok(record, `${example.city}: no matching record found`);
		const td = record.timeline_days.value;
		assert.equal(example.minDays, td.min_days, `${example.city}: minDays does not match its own record`);
		assert.equal(example.maxDays, td.max_days, `${example.city}: maxDays does not match its own record`);
	}

	if (insights.overallMinDays !== null) {
		assert.ok(insights.overallMinDays >= 0);
		assert.ok(insights.overallMaxDays >= insights.overallMinDays);
	}
});
