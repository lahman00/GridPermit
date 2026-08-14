// Multi-state expansion regression tests. Covers the invariants the
// mission's multi-state architecture depends on: explicit state identity,
// no cross-state URL/title/related-locality collisions, California's
// existing behavior staying unchanged, and a non-California record
// validating under the exact same rules (no CA-specific field is ever
// required) — see docs/DATA_ARCHITECTURE.md's multi-state section.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { validate } from "../scripts/validate-record.mjs";
import {
	buildLocalityIndexEntries,
	buildRelatedLocalities,
	buildBreadcrumbItems,
	buildPageMeta,
	guideUrlForCitySlug,
	SITE_ORIGIN,
} from "../src/lib/locality-guide.ts";
import { STATE_META, SUPPORTED_STATE_CODES, stateMeta } from "../src/lib/state-meta.ts";
import { buildSearchIndex, searchEntries } from "../src/lib/search-index.ts";

const tmpDir = mkdtempSync(path.join(tmpdir(), "gridpermit-multistate-test-"));
let fixtureCounter = 0;

function baseRecord(overrides = {}) {
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
		...overrides,
	};
}

function writeFixture(record) {
	fixtureCounter += 1;
	const filePath = path.join(tmpDir, `fixture-${fixtureCounter}.json`);
	writeFileSync(filePath, JSON.stringify(record, null, 2), "utf8");
	return filePath;
}

test.after(() => rmSync(tmpDir, { recursive: true, force: true }));

// --- Schema/validator: state identity is required and cross-checked ------

test("a record with no state field is a missing_required_field error", async () => {
	const r = baseRecord();
	delete r.state;
	const report = await validate(writeFixture(r));
	assert.ok(report.errors.some((e) => e.category === "missing_required_field" && e.field === "state"));
});

test("a record whose state does not match its record_id prefix is a state_record_id_mismatch error", async () => {
	const r = baseRecord({ state: "RI" }); // record_id still starts with "ca-"
	const report = await validate(writeFixture(r));
	assert.ok(report.errors.some((e) => e.category === "state_record_id_mismatch"));
});

test("a Rhode Island record (ri- prefix, state RI) validates with 0 errors under the exact same rules as California — no CA-specific field is required", async () => {
	const r = baseRecord({
		record_id: "ri-providence-providence-ngrid",
		state: "RI",
		city: { value: "Providence", confidence: 1, source_ids: ["S1"] },
		county: { value: "Providence County", confidence: 0.9, source_ids: ["S1"] },
	});
	const report = await validate(writeFixture(r));
	assert.equal(report.errors.length, 0);
	assert.notEqual(report.status, "FAIL");
});

test("a Delaware record validates cleanly with a 'puc' source type (the generic non-California alternative to 'cpuc')", async () => {
	const r = baseRecord({
		record_id: "de-newcastle-newark-delmarva",
		state: "DE",
		city: { value: "Newark", confidence: 1, source_ids: ["S1"] },
		county: { value: "New Castle County", confidence: 0.9, source_ids: ["S1"] },
		sources: [
			{ id: "S1", title: "Delaware PSC", url: "https://depsc.delaware.gov/", publisher: "Delaware Public Service Commission", type: "puc", accessed_date: "2026-01-01" },
		],
	});
	const report = await validate(writeFixture(r));
	assert.equal(report.errors.length, 0);
});

test("a California record still validates with 0 errors — the multi-state changes did not weaken CA validation", async () => {
	const report = await validate(writeFixture(baseRecord()));
	assert.equal(report.errors.length, 0);
	assert.notEqual(report.status, "FAIL");
});

// --- state-meta registry --------------------------------------------------

test("all four pilot states (CA, RI, DE, VT) are registered with distinct slugs", () => {
	for (const code of ["CA", "RI", "DE", "VT"]) {
		assert.ok(STATE_META[code], `expected ${code} to be registered`);
	}
	const slugs = SUPPORTED_STATE_CODES.map((c) => STATE_META[c].slug);
	assert.equal(new Set(slugs).size, slugs.length, "state slugs must be unique");
});

test("stateMeta throws a clear error for an unregistered state code, rather than silently defaulting to California", () => {
	assert.throws(() => stateMeta("TX"), /unrecognized state code/);
});

// --- URL identity: same city name in two different states never collides -

test("guideUrlForCitySlug produces different URLs for the same city slug in different states (Newark, CA vs Newark, DE)", () => {
	const ca = guideUrlForCitySlug("CA", "newark");
	const de = guideUrlForCitySlug("DE", "newark");
	assert.notEqual(ca, de);
	assert.equal(ca, "/california/newark/solar-permit-guide/");
	assert.equal(de, "/delaware/newark/solar-permit-guide/");
});

test("buildLocalityIndexEntries never produces two entries with the same guideUrl, across states with a shared city name", () => {
	const evaluationRecords = [
		{ record_id: "ca-alameda-newark-pge", readiness: "READY", completeness_pct: 90 },
		{ record_id: "de-newcastle-newark-delmarva", readiness: "READY", completeness_pct: 90 },
	];
	const recordsById = new Map([
		["ca-alameda-newark-pge", baseRecord({ record_id: "ca-alameda-newark-pge", state: "CA", city: { value: "Newark", confidence: 1, source_ids: ["S1"] } })],
		["de-newcastle-newark-delmarva", baseRecord({ record_id: "de-newcastle-newark-delmarva", state: "DE", city: { value: "Newark", confidence: 1, source_ids: ["S1"] } })],
	]);
	const entries = buildLocalityIndexEntries(evaluationRecords, recordsById);
	assert.equal(entries.length, 2);
	const urls = entries.map((e) => e.guideUrl);
	assert.equal(new Set(urls).size, 2, "same-named cities in different states must get distinct URLs");
});

test("buildPageMeta titles for same-named cities in different states are distinguishable", () => {
	const ca = buildPageMeta(
		baseRecord({ state: "CA", city: { value: "Newark", confidence: 1, source_ids: ["S1"] } }),
		"/california/newark/solar-permit-guide/",
	);
	const de = buildPageMeta(
		baseRecord({ state: "DE", city: { value: "Newark", confidence: 1, source_ids: ["S1"] } }),
		"/delaware/newark/solar-permit-guide/",
	);
	assert.notEqual(ca.title, de.title);
	assert.match(ca.title, /\bCA\b/);
	assert.match(de.title, /\bDE\b/);
});

test("buildBreadcrumbItems shows the correct state name for a non-California record", () => {
	const record = baseRecord({ state: "VT", city: { value: "Burlington", confidence: 1, source_ids: ["S1"] } });
	const items = buildBreadcrumbItems(record, {
		cityPath: "/vermont/burlington/",
		pageUrl: `${SITE_ORIGIN}/vermont/burlington/solar-permit-guide/`,
	});
	assert.deepEqual(items.map((i) => i.name), ["Home", "Vermont", "Burlington", "Solar Permit Guide"]);
});

// --- Related-locality cross-linking never crosses state lines ------------

test("buildRelatedLocalities never surfaces a candidate from a different state, even when county/utility names happen to match", () => {
	const evaluationRecords = [
		{ record_id: "ca-x-springfield-pge", readiness: "READY", completeness_pct: 90 },
		{ record_id: "vt-x-springfield-gmp", readiness: "READY", completeness_pct: 90 },
	];
	const recordsById = new Map([
		["ca-x-springfield-pge", baseRecord({ record_id: "ca-x-springfield-pge", state: "CA", city: { value: "Springfield", confidence: 1, source_ids: ["S1"] }, county: { value: "Shared County", confidence: 1, source_ids: ["S1"] } })],
		["vt-x-springfield-gmp", baseRecord({ record_id: "vt-x-springfield-gmp", state: "VT", city: { value: "Springfield", confidence: 1, source_ids: ["S1"] }, county: { value: "Shared County", confidence: 1, source_ids: ["S1"] } })],
	]);
	const entries = buildLocalityIndexEntries(evaluationRecords, recordsById);
	const ca = entries.find((e) => e.state === "CA");
	const related = buildRelatedLocalities(ca, entries);
	assert.equal(related.length, 0, "a same-named county in a different state must never be treated as related");
});

// --- Search distinguishes states ------------------------------------------

test("search index titles for same-named cities in different states are distinguishable, and searching a state name filters correctly", () => {
	const localityEntries = [
		{ recordId: "ca-x", city: "Newark", county: "Alameda County", utility: "PG&E", generationSupplierName: null, completenessPct: 90, lastVerified: "2026-01-01", citySlug: "newark", guideUrl: "/california/newark/solar-permit-guide/", state: "CA", stateName: "California", stateSlug: "california" },
		{ recordId: "de-x", city: "Newark", county: "New Castle County", utility: "Delmarva Power", generationSupplierName: null, completenessPct: 90, lastVerified: "2026-01-01", citySlug: "newark", guideUrl: "/delaware/newark/solar-permit-guide/", state: "DE", stateName: "Delaware", stateSlug: "delaware" },
	];
	const index = buildSearchIndex({ localityEntries, blogPosts: [] });
	const titles = index.filter((e) => e.title.startsWith("Newark")).map((e) => e.title);
	assert.equal(new Set(titles).size, titles.length, "Newark, CA and Newark, DE must have distinct search titles");

	const results = searchEntries(index, "delaware");
	assert.ok(results.some((e) => e.url === "/delaware/newark/solar-permit-guide/"));
	assert.ok(!results.some((e) => e.url === "/california/newark/solar-permit-guide/"));
});

// --- California backward compatibility ------------------------------------

test("California's guide URLs are byte-identical to their pre-multi-state shape", () => {
	assert.equal(guideUrlForCitySlug("CA", "oakland"), "/california/oakland/solar-permit-guide/");
});
