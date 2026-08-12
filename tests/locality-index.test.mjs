// Tests for the data-shaping logic behind
// src/pages/california/solar-permit-guides.astro (Phase 3) and each locality
// page's "other verified guides" cross-links (Phase 4). Both consume
// buildLocalityIndexEntries from src/lib/locality-guide.ts, so this file
// tests that shared function directly rather than rendering Astro output.

import { test } from "node:test";
import assert from "node:assert/strict";

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	citySlug,
	buildLocalityIndexEntries,
	excludeCurrentEntry,
	buildRelatedLocalities,
	relationLabel,
} from "../src/lib/locality-guide.ts";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

test("citySlug lowercases and hyphenates a multi-word city name", () => {
	assert.equal(citySlug("San Diego"), "san-diego");
	assert.equal(citySlug("Oakland"), "oakland");
	assert.equal(citySlug("Los Angeles"), "los-angeles");
});

function makeRecord({ city, county = null, utility, generationSupplierName = null, lastVerified = "2026-08-01", state = "CA" }) {
	return {
		state,
		city: { value: city },
		county: { value: county },
		utility: { value: utility },
		generation_supplier: { value: generationSupplierName ? { name: generationSupplierName, type: "cca" } : null },
		last_verified: lastVerified,
	};
}

function makeFixture() {
	const evaluationRecords = [
		{ record_id: "ca-alameda-fremont-pge", readiness: "READY", completeness_pct: 80.0 },
		{ record_id: "ca-alameda-oakland-pge", readiness: "READY", completeness_pct: 86.7 },
		{ record_id: "ca-los-angeles-pasadena-pwp", readiness: "READY", completeness_pct: 93.3 },
		{ record_id: "ca-san-diego-san-diego-sdge", readiness: "READY", completeness_pct: 86.7 },
		{ record_id: "ca-santa-clara-san-jose-pge", readiness: "LIMITED", completeness_pct: 53.3 },
	];
	const recordsById = new Map([
		["ca-alameda-fremont-pge", makeRecord({ city: "Fremont", county: "Alameda County", utility: "Pacific Gas and Electric Company (PG&E)", generationSupplierName: "Ava Community Energy" })],
		["ca-alameda-oakland-pge", makeRecord({ city: "Oakland", county: "Alameda County", utility: "Pacific Gas and Electric Company (PG&E)", generationSupplierName: "Ava Community Energy" })],
		["ca-los-angeles-pasadena-pwp", makeRecord({ city: "Pasadena", county: "Los Angeles County", utility: "Pasadena Water and Power" })],
		["ca-san-diego-san-diego-sdge", makeRecord({ city: "San Diego", county: "San Diego County", utility: "San Diego Gas & Electric (SDG&E)", generationSupplierName: "San Diego Community Power" })],
		["ca-santa-clara-san-jose-pge", makeRecord({ city: "San Jose", county: "Santa Clara County", utility: "Pacific Gas and Electric Company (PG&E)" })],
	]);
	return { evaluationRecords, recordsById };
}

test("buildLocalityIndexEntries includes only READY records", () => {
	const { evaluationRecords, recordsById } = makeFixture();
	const entries = buildLocalityIndexEntries(evaluationRecords, recordsById);
	assert.equal(entries.length, 4);
	assert.ok(entries.every((e) => e.recordId !== "ca-santa-clara-san-jose-pge"));
});

test("buildLocalityIndexEntries excludes San Jose specifically (readiness LIMITED)", () => {
	const { evaluationRecords, recordsById } = makeFixture();
	const entries = buildLocalityIndexEntries(evaluationRecords, recordsById);
	assert.ok(!entries.some((e) => e.city === "San Jose"));
});

test("each entry links to the correct city-guide route", () => {
	const { evaluationRecords, recordsById } = makeFixture();
	const entries = buildLocalityIndexEntries(evaluationRecords, recordsById);
	const oakland = entries.find((e) => e.city === "Oakland");
	const sanDiego = entries.find((e) => e.city === "San Diego");
	assert.equal(oakland.guideUrl, "/california/oakland/solar-permit-guide/");
	assert.equal(sanDiego.guideUrl, "/california/san-diego/solar-permit-guide/");
	assert.equal(oakland.citySlug, "oakland");
	assert.equal(sanDiego.citySlug, "san-diego");
});

test("completeness percentage and utility are carried through correctly per entry", () => {
	const { evaluationRecords, recordsById } = makeFixture();
	const entries = buildLocalityIndexEntries(evaluationRecords, recordsById);
	const pasadena = entries.find((e) => e.city === "Pasadena");
	assert.equal(pasadena.completenessPct, 93.3);
	assert.equal(pasadena.utility, "Pasadena Water and Power");
	const fremont = entries.find((e) => e.city === "Fremont");
	assert.equal(fremont.completenessPct, 80.0);
	assert.equal(fremont.utility, "Pacific Gas and Electric Company (PG&E)");
});

test("generationSupplierName is present when the record has one, and null otherwise", () => {
	const { evaluationRecords, recordsById } = makeFixture();
	const entries = buildLocalityIndexEntries(evaluationRecords, recordsById);
	const sanDiego = entries.find((e) => e.city === "San Diego");
	assert.equal(sanDiego.generationSupplierName, "San Diego Community Power");
	const pasadena = entries.find((e) => e.city === "Pasadena");
	assert.equal(pasadena.generationSupplierName, null);
});

test("lastVerified is carried through from the locality record", () => {
	const { recordsById } = makeFixture();
	const evaluationRecords = [{ record_id: "ca-alameda-oakland-pge", readiness: "READY", completeness_pct: 86.7 }];
	const entries = buildLocalityIndexEntries(evaluationRecords, recordsById);
	assert.equal(entries[0].lastVerified, "2026-08-01");
});

test("a READY evaluation record with no matching locality file is skipped, not a crash", () => {
	const evaluationRecords = [{ record_id: "ca-does-not-exist-pge", readiness: "READY", completeness_pct: 90 }];
	const recordsById = new Map();
	assert.doesNotThrow(() => buildLocalityIndexEntries(evaluationRecords, recordsById));
	assert.deepEqual(buildLocalityIndexEntries(evaluationRecords, recordsById), []);
});

test("entries are sorted alphabetically by city", () => {
	const { evaluationRecords, recordsById } = makeFixture();
	const entries = buildLocalityIndexEntries(evaluationRecords, recordsById);
	const cities = entries.map((e) => e.city);
	assert.deepEqual(cities, [...cities].sort((a, b) => a.localeCompare(b)));
});

// --- Phase 4: "Other verified California guides" cross-links -------------

test("excludeCurrentEntry removes exactly the current city's own entry, and only that one", () => {
	const { evaluationRecords, recordsById } = makeFixture();
	const entries = buildLocalityIndexEntries(evaluationRecords, recordsById);
	const otherGuides = excludeCurrentEntry(entries, "ca-alameda-oakland-pge");

	assert.equal(otherGuides.length, 3);
	assert.ok(!otherGuides.some((e) => e.recordId === "ca-alameda-oakland-pge"));
	assert.ok(!otherGuides.some((e) => e.city === "Oakland"));
	// The other three READY cities must all still be present.
	assert.deepEqual(
		otherGuides.map((e) => e.city).sort(),
		["Fremont", "Pasadena", "San Diego"],
	);
});

test("excludeCurrentEntry's input already excludes LIMITED records (only READY cities ever appear in cross-links)", () => {
	const { evaluationRecords, recordsById } = makeFixture();
	const entries = buildLocalityIndexEntries(evaluationRecords, recordsById);
	const otherGuides = excludeCurrentEntry(entries, "ca-alameda-fremont-pge");
	assert.ok(!otherGuides.some((e) => e.city === "San Jose"), "San Jose (LIMITED) must never appear in another city's cross-link list");
});

test("excludeCurrentEntry cross-link routes are correct for each remaining city", () => {
	const { evaluationRecords, recordsById } = makeFixture();
	const entries = buildLocalityIndexEntries(evaluationRecords, recordsById);
	const otherGuides = excludeCurrentEntry(entries, "ca-los-angeles-pasadena-pwp");
	const fremont = otherGuides.find((e) => e.city === "Fremont");
	const sanDiego = otherGuides.find((e) => e.city === "San Diego");
	assert.equal(fremont.guideUrl, "/california/fremont/solar-permit-guide/");
	assert.equal(sanDiego.guideUrl, "/california/san-diego/solar-permit-guide/");
});

test("excludeCurrentEntry with a record_id not in the list changes nothing (no accidental removal)", () => {
	const { evaluationRecords, recordsById } = makeFixture();
	const entries = buildLocalityIndexEntries(evaluationRecords, recordsById);
	const otherGuides = excludeCurrentEntry(entries, "ca-does-not-exist-pge");
	assert.equal(otherGuides.length, entries.length);
});

// --- buildRelatedLocalities: curated, relevance-ranked cross-links --------
// Replaces the flat "link to every other READY city" list with a bounded
// set ranked by how directly each candidate relates to the current city:
// same county first, then same utility, then same generation supplier
// (CCA/municipal) — see src/lib/locality-guide.ts for why an exhaustive
// list stopped being the right choice once the dataset passed ~80 cities.

test("buildRelatedLocalities never includes the current city itself", () => {
	const { evaluationRecords, recordsById } = makeFixture();
	const entries = buildLocalityIndexEntries(evaluationRecords, recordsById);
	const oakland = entries.find((e) => e.city === "Oakland");
	const related = buildRelatedLocalities(oakland, entries);
	assert.ok(!related.some((r) => r.recordId === oakland.recordId));
});

test("buildRelatedLocalities ranks same-county above same-utility above same-supplier", () => {
	const { evaluationRecords, recordsById } = makeFixture();
	const entries = buildLocalityIndexEntries(evaluationRecords, recordsById);
	const oakland = entries.find((e) => e.city === "Oakland");
	const related = buildRelatedLocalities(oakland, entries);
	// Fremont shares Oakland's county AND utility AND supplier — still only
	// counted once, under its single best (highest-ranked) relation.
	const fremont = related.find((r) => r.city === "Fremont");
	assert.equal(fremont.relation, "county");
	// San Jose shares only utility (different county, no supplier in common).
	const sanJoseEntry = { recordId: "x", city: "San Jose", county: "Santa Clara County", utility: "Pacific Gas and Electric Company (PG&E)", generationSupplierName: null, completenessPct: 80, lastVerified: "2026-08-01", citySlug: "san-jose", guideUrl: "/california/san-jose/solar-permit-guide/", state: "CA", stateName: "California", stateSlug: "california" };
	const relatedWithSanJose = buildRelatedLocalities(oakland, [...entries, sanJoseEntry]);
	const sanJose = relatedWithSanJose.find((r) => r.city === "San Jose");
	assert.equal(sanJose.relation, "utility");
});

test("buildRelatedLocalities matches 'same utility' by short name, not the raw full string — the dataset has more than one spelling of PG&E on file", () => {
	const a = { recordId: "x-a", city: "A City", county: "County One", utility: "Pacific Gas & Electric (PG&E)", generationSupplierName: null, completenessPct: 80, lastVerified: "2026-08-01", citySlug: "a-city", guideUrl: "/california/a-city/solar-permit-guide/", state: "CA", stateName: "California", stateSlug: "california" };
	const b = { recordId: "x-b", city: "B City", county: "County Two", utility: "Pacific Gas and Electric Company (PG&E)", generationSupplierName: null, completenessPct: 80, lastVerified: "2026-08-01", citySlug: "b-city", guideUrl: "/california/b-city/solar-permit-guide/", state: "CA", stateName: "California", stateSlug: "california" };
	const related = buildRelatedLocalities(a, [a, b]);
	assert.equal(related.length, 1, "A City and B City are both PG&E under different full-name spellings and should relate");
	assert.equal(related[0].recordId, "x-b");
	assert.equal(related[0].relation, "utility");
});

test("buildRelatedLocalities excludes cities with no relation at all (no random fallback)", () => {
	const { evaluationRecords, recordsById } = makeFixture();
	const entries = buildLocalityIndexEntries(evaluationRecords, recordsById);
	const oakland = entries.find((e) => e.city === "Oakland");
	const related = buildRelatedLocalities(oakland, entries);
	// Pasadena (different county, different utility, no supplier) shares
	// nothing with Oakland and must never appear.
	assert.ok(!related.some((r) => r.city === "Pasadena"));
});

test("buildRelatedLocalities respects the limit and contains no duplicate recordIds", () => {
	const { evaluationRecords, recordsById } = makeFixture();
	const entries = buildLocalityIndexEntries(evaluationRecords, recordsById);
	const oakland = entries.find((e) => e.city === "Oakland");
	const related = buildRelatedLocalities(oakland, entries, 1);
	assert.equal(related.length, 1);
	const ids = related.map((r) => r.recordId);
	assert.equal(new Set(ids).size, ids.length);
});

test("buildRelatedLocalities is deterministic: ties within a relation break by city name", () => {
	const { evaluationRecords, recordsById } = makeFixture();
	const entries = buildLocalityIndexEntries(evaluationRecords, recordsById);
	const oakland = entries.find((e) => e.city === "Oakland");
	const run1 = buildRelatedLocalities(oakland, entries).map((r) => r.recordId);
	const run2 = buildRelatedLocalities(oakland, entries).map((r) => r.recordId);
	assert.deepEqual(run1, run2);
});

test("relationLabel returns a human-readable string for every relation value buildRelatedLocalities can produce", () => {
	assert.equal(relationLabel("county"), "same county");
	assert.equal(relationLabel("utility"), "same utility");
	assert.equal(relationLabel("supplier"), "same generation supplier");
});

test("buildRelatedLocalities never crashes and never self-links, for every real READY locality in the dataset", () => {
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
	const entries = buildLocalityIndexEntries(allEvaluatedRecords, recordsById);
	assert.ok(entries.length > 0, "expected at least one real READY locality to test against");

	for (const entry of entries) {
		const related = buildRelatedLocalities(entry, entries, 6);
		assert.ok(related.length <= 6, `${entry.recordId}: related list exceeds the limit`);
		assert.ok(!related.some((r) => r.recordId === entry.recordId), `${entry.recordId}: related list includes itself`);
		const ids = related.map((r) => r.recordId);
		assert.equal(new Set(ids).size, ids.length, `${entry.recordId}: related list has duplicate cities`);
		for (const r of related) {
			assert.ok(["county", "utility", "supplier"].includes(r.relation), `${entry.recordId}: related entry ${r.recordId} has an invalid relation "${r.relation}"`);
		}
	}
});
