// Tests for src/lib/county-hub.ts — the data-shaping logic behind
// src/pages/california/county/[slug].astro. County hub pages exist only
// where they clear MIN_READY_CITIES_FOR_HUB; below that, a hub would be a
// thin list-of-one-link page the mission explicitly says not to build.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildCountyHubs, countySlug, MIN_READY_CITIES_FOR_HUB } from "../src/lib/county-hub.ts";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function makeRecord({ city, county, utility, permitAuthority = null, state = "CA" }) {
	return {
		state,
		city: { value: city },
		county: { value: county },
		utility: { value: utility },
		permit_authority: { value: permitAuthority },
	};
}

test("countySlug strips a trailing ' County' and slugifies the rest", () => {
	assert.equal(countySlug("Contra Costa County"), "contra-costa");
	assert.equal(countySlug("Orange County"), "orange");
	assert.equal(countySlug("Los Angeles County"), "los-angeles");
});

test("buildCountyHubs excludes a county with fewer than MIN_READY_CITIES_FOR_HUB READY cities", () => {
	const evaluationRecords = [
		{ record_id: "a", readiness: "READY" },
		{ record_id: "b", readiness: "READY" },
	];
	const recordsById = new Map([
		["a", makeRecord({ city: "A City", county: "Tiny County", utility: "PG&E" })],
		["b", makeRecord({ city: "B City", county: "Tiny County", utility: "PG&E" })],
	]);
	assert.ok(MIN_READY_CITIES_FOR_HUB > 2, "test assumes the threshold is above 2");
	const hubs = buildCountyHubs(evaluationRecords, recordsById);
	assert.equal(hubs.length, 0);
});

test("buildCountyHubs includes a county once it reaches MIN_READY_CITIES_FOR_HUB READY cities", () => {
	const evaluationRecords = Array.from({ length: MIN_READY_CITIES_FOR_HUB }, (_, i) => ({
		record_id: `city-${i}`,
		readiness: "READY",
	}));
	const recordsById = new Map(
		evaluationRecords.map((e, i) => [
			e.record_id,
			makeRecord({ city: `City ${i}`, county: "Big County", utility: "PG&E" }),
		]),
	);
	const hubs = buildCountyHubs(evaluationRecords, recordsById);
	assert.equal(hubs.length, 1);
	assert.equal(hubs[0].county, "Big County");
	assert.equal(hubs[0].cities.length, MIN_READY_CITIES_FOR_HUB);
});

test("buildCountyHubs excludes LIMITED/NOT_READY records from a county's city count", () => {
	const evaluationRecords = [
		...Array.from({ length: MIN_READY_CITIES_FOR_HUB }, (_, i) => ({ record_id: `ready-${i}`, readiness: "READY" })),
		{ record_id: "limited-1", readiness: "LIMITED" },
	];
	const recordsById = new Map([
		...Array.from({ length: MIN_READY_CITIES_FOR_HUB }, (_, i) => [
			`ready-${i}`,
			makeRecord({ city: `City ${i}`, county: "Big County", utility: "PG&E" }),
		]),
		["limited-1", makeRecord({ city: "Excluded City", county: "Big County", utility: "PG&E" })],
	]);
	const hubs = buildCountyHubs(evaluationRecords, recordsById);
	assert.equal(hubs[0].cities.length, MIN_READY_CITIES_FOR_HUB);
	assert.ok(!hubs[0].cities.some((c) => c.city === "Excluded City"));
});

test("buildCountyHubs detects a county-contracted city from its permit_authority, and does not flag a normal city department", () => {
	const evaluationRecords = Array.from({ length: MIN_READY_CITIES_FOR_HUB }, (_, i) => ({
		record_id: `city-${i}`,
		readiness: "READY",
	}));
	const recordsById = new Map(
		evaluationRecords.map((e, i) =>
			i === 0
				? [e.record_id, makeRecord({ city: "Contracted City", county: "Contra Costa County", utility: "PG&E", permitAuthority: "Contra Costa County Department of Conservation and Development, Building Inspection Division" })]
				: [e.record_id, makeRecord({ city: `City ${i}`, county: "Contra Costa County", utility: "PG&E", permitAuthority: `City of City ${i} Building Division` })],
		),
	);
	const hubs = buildCountyHubs(evaluationRecords, recordsById);
	const hub = hubs.find((h) => h.county === "Contra Costa County");
	assert.deepEqual(hub.countyContractedCities, ["Contracted City"]);
	const contracted = hub.cities.find((c) => c.city === "Contracted City");
	assert.equal(contracted.countyContracted, true);
	const normal = hub.cities.find((c) => c.city === "City 1");
	assert.equal(normal.countyContracted, false);
});

test("buildCountyHubs' utilities list is deduped by short name, not the raw utility string", () => {
	const evaluationRecords = Array.from({ length: MIN_READY_CITIES_FOR_HUB }, (_, i) => ({
		record_id: `city-${i}`,
		readiness: "READY",
	}));
	const recordsById = new Map(
		evaluationRecords.map((e, i) => [
			e.record_id,
			makeRecord({
				city: `City ${i}`,
				county: "Mixed County",
				// Two different real spellings of PG&E, same as the live dataset.
				utility: i % 2 === 0 ? "Pacific Gas & Electric (PG&E)" : "Pacific Gas and Electric Company (PG&E)",
			}),
		]),
	);
	const hubs = buildCountyHubs(evaluationRecords, recordsById);
	const hub = hubs.find((h) => h.county === "Mixed County");
	assert.deepEqual(hub.utilities, ["PG&E"]);
});

test("buildCountyHubs sorts counties alphabetically and cities within each county alphabetically", () => {
	const evaluationRecords = [
		...Array.from({ length: MIN_READY_CITIES_FOR_HUB }, (_, i) => ({ record_id: `z-${i}`, readiness: "READY" })),
		...Array.from({ length: MIN_READY_CITIES_FOR_HUB }, (_, i) => ({ record_id: `a-${i}`, readiness: "READY" })),
	];
	const recordsById = new Map([
		...Array.from({ length: MIN_READY_CITIES_FOR_HUB }, (_, i) => [
			`z-${i}`,
			makeRecord({ city: `Zed City ${MIN_READY_CITIES_FOR_HUB - i}`, county: "Z County", utility: "PG&E" }),
		]),
		...Array.from({ length: MIN_READY_CITIES_FOR_HUB }, (_, i) => [
			`a-${i}`,
			makeRecord({ city: `Alpha City ${MIN_READY_CITIES_FOR_HUB - i}`, county: "A County", utility: "PG&E" }),
		]),
	]);
	const hubs = buildCountyHubs(evaluationRecords, recordsById);
	assert.deepEqual(hubs.map((h) => h.county), ["A County", "Z County"]);
	const zHub = hubs.find((h) => h.county === "Z County");
	const cityNames = zHub.cities.map((c) => c.city);
	assert.deepEqual(cityNames, [...cityNames].sort((a, b) => a.localeCompare(b)));
});

test("buildCountyHubs runs cleanly against the real dataset and produces internally consistent hubs", () => {
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
	const hubs = buildCountyHubs(allEvaluatedRecords, recordsById);
	assert.ok(hubs.length > 0, "expected at least one real county to clear the hub threshold");

	const slugs = new Set();
	for (const hub of hubs) {
		assert.ok(hub.cities.length >= MIN_READY_CITIES_FOR_HUB, `${hub.county}: has fewer than the minimum READY cities`);
		assert.ok(!slugs.has(hub.countySlug), `${hub.county}: countySlug "${hub.countySlug}" collides with another county's`);
		slugs.add(hub.countySlug);
		for (const city of hub.cities) {
			assert.ok(city.guideUrl.startsWith("/california/") && city.guideUrl.endsWith("/solar-permit-guide/"), `${hub.county}/${city.city}: malformed guideUrl "${city.guideUrl}"`);
		}
	}
});
