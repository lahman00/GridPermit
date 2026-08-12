// Tests for src/lib/utility-hub.ts — the data-shaping logic behind
// src/pages/california/utility/[slug].astro. Mirrors county-hub.test.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildUtilityHubs, utilitySlug, MIN_READY_CITIES_FOR_UTILITY_HUB } from "../src/lib/utility-hub.ts";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function makeRecord({ city, county = null, utility, interconnectionUrl = null, state = "CA" }) {
	return {
		state,
		city: { value: city },
		county: { value: county },
		utility: { value: utility },
		interconnection_url: { value: interconnectionUrl },
	};
}

test("utilitySlug slugifies a short utility name", () => {
	assert.equal(utilitySlug("PG&E"), "pg-e");
	assert.equal(utilitySlug("SCE"), "sce");
});

test("buildUtilityHubs excludes a utility with fewer than the minimum READY cities", () => {
	const evaluationRecords = [
		{ record_id: "a", readiness: "READY" },
		{ record_id: "b", readiness: "READY" },
	];
	const recordsById = new Map([
		["a", makeRecord({ city: "A City", utility: "Tiny Municipal Utility" })],
		["b", makeRecord({ city: "B City", utility: "Tiny Municipal Utility" })],
	]);
	assert.ok(MIN_READY_CITIES_FOR_UTILITY_HUB > 2, "test assumes the threshold is above 2");
	assert.equal(buildUtilityHubs(evaluationRecords, recordsById).length, 0);
});

test("buildUtilityHubs groups two different full-name spellings of the same utility under one hub (the real PG&E case)", () => {
	const evaluationRecords = Array.from({ length: MIN_READY_CITIES_FOR_UTILITY_HUB }, (_, i) => ({
		record_id: `city-${i}`,
		readiness: "READY",
	}));
	const recordsById = new Map(
		evaluationRecords.map((e, i) => [
			e.record_id,
			makeRecord({
				city: `City ${i}`,
				utility: i % 2 === 0 ? "Pacific Gas & Electric (PG&E)" : "Pacific Gas and Electric Company (PG&E)",
			}),
		]),
	);
	const hubs = buildUtilityHubs(evaluationRecords, recordsById);
	assert.equal(hubs.length, 1);
	assert.equal(hubs[0].utilityShort, "PG&E");
	assert.equal(hubs[0].cities.length, MIN_READY_CITIES_FOR_UTILITY_HUB);
});

test("buildUtilityHubs excludes LIMITED/NOT_READY records", () => {
	const evaluationRecords = [
		...Array.from({ length: MIN_READY_CITIES_FOR_UTILITY_HUB }, (_, i) => ({ record_id: `ready-${i}`, readiness: "READY" })),
		{ record_id: "limited-1", readiness: "LIMITED" },
	];
	const recordsById = new Map([
		...Array.from({ length: MIN_READY_CITIES_FOR_UTILITY_HUB }, (_, i) => [
			`ready-${i}`,
			makeRecord({ city: `City ${i}`, utility: "SCE" }),
		]),
		["limited-1", makeRecord({ city: "Excluded City", utility: "SCE" })],
	]);
	const hubs = buildUtilityHubs(evaluationRecords, recordsById);
	assert.ok(!hubs[0].cities.some((c) => c.city === "Excluded City"));
});

test("buildUtilityHubs sets commonInterconnectionUrl only when every city cites the exact same URL", () => {
	const evaluationRecords = Array.from({ length: MIN_READY_CITIES_FOR_UTILITY_HUB }, (_, i) => ({
		record_id: `same-${i}`,
		readiness: "READY",
	}));
	const sameUrlRecords = new Map(
		evaluationRecords.map((e, i) => [
			e.record_id,
			makeRecord({ city: `City ${i}`, utility: "SCE", interconnectionUrl: "https://sce.example/nem" }),
		]),
	);
	const sameHub = buildUtilityHubs(evaluationRecords, sameUrlRecords)[0];
	assert.equal(sameHub.commonInterconnectionUrl, "https://sce.example/nem");

	const mixedUrlRecords = new Map(
		evaluationRecords.map((e, i) => [
			e.record_id,
			makeRecord({ city: `City ${i}`, utility: "SCE", interconnectionUrl: i === 0 ? null : "https://sce.example/nem" }),
		]),
	);
	const mixedHub = buildUtilityHubs(evaluationRecords, mixedUrlRecords)[0];
	assert.equal(mixedHub.commonInterconnectionUrl, null, "one null among the rest must not produce a false common URL");
});

test("buildUtilityHubs' counties list is deduped and alphabetical", () => {
	const evaluationRecords = Array.from({ length: MIN_READY_CITIES_FOR_UTILITY_HUB }, (_, i) => ({
		record_id: `city-${i}`,
		readiness: "READY",
	}));
	const recordsById = new Map(
		evaluationRecords.map((e, i) => [
			e.record_id,
			makeRecord({ city: `City ${i}`, county: i < 2 ? "Zed County" : "Alpha County", utility: "SCE" }),
		]),
	);
	const hub = buildUtilityHubs(evaluationRecords, recordsById)[0];
	assert.deepEqual(hub.counties, ["Alpha County", "Zed County"]);
});

test("buildUtilityHubs runs cleanly against the real dataset and produces internally consistent hubs", () => {
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
		(f) => f.endsWith(".json") && f !== "research-progress-report.json" && f !== "statewide-research-queue.json" && f !== "site-inventory.json",
	);
	const allEvaluatedRecords = evaluationFiles.flatMap(
		(f) => JSON.parse(readFileSync(path.join(outputDir, f), "utf8")).records ?? [],
	);
	const hubs = buildUtilityHubs(allEvaluatedRecords, recordsById);
	assert.ok(hubs.length > 0, "expected at least one real utility to clear the hub threshold");

	const slugs = new Set();
	for (const hub of hubs) {
		assert.ok(hub.cities.length >= MIN_READY_CITIES_FOR_UTILITY_HUB, `${hub.utilityShort}: fewer than the minimum READY cities`);
		assert.ok(!slugs.has(hub.utilitySlug), `${hub.utilityShort}: slug collides with another utility's`);
		slugs.add(hub.utilitySlug);
		for (const city of hub.cities) {
			assert.ok(city.guideUrl.startsWith("/california/") && city.guideUrl.endsWith("/solar-permit-guide/"), `${hub.utilityShort}/${city.city}: malformed guideUrl`);
		}
	}
});
