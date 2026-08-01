// Tests for the data-shaping logic behind
// src/pages/california/solar-permit-guides.astro (Phase 3) and each locality
// page's "other verified guides" cross-links (Phase 4). Both consume
// buildLocalityIndexEntries from src/lib/locality-guide.ts, so this file
// tests that shared function directly rather than rendering Astro output.

import { test } from "node:test";
import assert from "node:assert/strict";

import { citySlug, buildLocalityIndexEntries, excludeCurrentEntry } from "../src/lib/locality-guide.ts";

test("citySlug lowercases and hyphenates a multi-word city name", () => {
	assert.equal(citySlug("San Diego"), "san-diego");
	assert.equal(citySlug("Oakland"), "oakland");
	assert.equal(citySlug("Los Angeles"), "los-angeles");
});

function makeRecord({ city, utility, generationSupplierName = null, lastVerified = "2026-08-01" }) {
	return {
		city: { value: city },
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
		["ca-alameda-fremont-pge", makeRecord({ city: "Fremont", utility: "Pacific Gas and Electric Company (PG&E)", generationSupplierName: "Ava Community Energy" })],
		["ca-alameda-oakland-pge", makeRecord({ city: "Oakland", utility: "Pacific Gas and Electric Company (PG&E)", generationSupplierName: "Ava Community Energy" })],
		["ca-los-angeles-pasadena-pwp", makeRecord({ city: "Pasadena", utility: "Pasadena Water and Power" })],
		["ca-san-diego-san-diego-sdge", makeRecord({ city: "San Diego", utility: "San Diego Gas & Electric (SDG&E)", generationSupplierName: "San Diego Community Power" })],
		["ca-santa-clara-san-jose-pge", makeRecord({ city: "San Jose", utility: "Pacific Gas and Electric Company (PG&E)" })],
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
