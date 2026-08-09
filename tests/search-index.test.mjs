import { test } from "node:test";
import assert from "node:assert/strict";

import { buildSearchIndex, searchEntries } from "../src/lib/search-index.ts";

function makeParams() {
	return {
		localityEntries: [
			{ recordId: "ca-alameda-oakland-pge", city: "Oakland", county: "Alameda County", utility: "Pacific Gas and Electric Company (PG&E)", generationSupplierName: "Ava Community Energy", completenessPct: 86.7, lastVerified: "2026-08-01", citySlug: "oakland", guideUrl: "/california/oakland/solar-permit-guide/" },
			{ recordId: "ca-los-angeles-pasadena-pwp", city: "Pasadena", county: "Los Angeles County", utility: "Pasadena Water and Power", generationSupplierName: null, completenessPct: 93.3, lastVerified: "2026-08-01", citySlug: "pasadena", guideUrl: "/california/pasadena/solar-permit-guide/" },
		],
		blogPosts: [
			{ title: "SCE NEM 3.0 Guide", description: "SCE customers are losing thousands under NEM 3.0.", url: "/blog/sce-guide/", category: "SCE", displayDate: "x", sortDate: "2026-07-26", hasExactDate: true },
		],
		countyHubs: [
			{
				county: "Alameda County",
				countySlug: "alameda",
				cities: [{ city: "Oakland" }, { city: "Berkeley" }],
				utilities: ["PG&E"],
				countyContractedCities: [],
			},
		],
		utilityHubs: [
			{
				utilityShort: "PG&E",
				utilitySlug: "pge",
				cities: [{ city: "Oakland" }, { city: "Berkeley" }],
				counties: ["Alameda County"],
				commonInterconnectionUrl: null,
			},
		],
	};
}

test("buildSearchIndex includes locality guides, blog posts, and static pages", () => {
	const index = buildSearchIndex(makeParams());
	assert.ok(index.some((e) => e.url === "/california/oakland/solar-permit-guide/"));
	assert.ok(index.some((e) => e.url === "/california/pasadena/solar-permit-guide/"));
	assert.ok(index.some((e) => e.url === "/blog/sce-guide/"));
	assert.ok(index.some((e) => e.url === "/methodology/"));
	assert.ok(index.some((e) => e.url === "/"));
});

test("buildSearchIndex includes the guide index and blog index pages themselves", () => {
	const index = buildSearchIndex(makeParams());
	assert.ok(index.some((e) => e.url === "/california/solar-permit-guides/"));
	assert.ok(index.some((e) => e.url === "/blog/"));
});

test("searchEntries matches a city name", () => {
	const index = buildSearchIndex(makeParams());
	const results = searchEntries(index, "oakland");
	assert.ok(results.some((e) => e.url === "/california/oakland/solar-permit-guide/"));
});

test("searchEntries matches a utility name embedded in a locality entry's description", () => {
	const index = buildSearchIndex(makeParams());
	const results = searchEntries(index, "PG&E");
	assert.ok(results.some((e) => e.url === "/california/oakland/solar-permit-guide/"));
});

test("searchEntries matches a municipal utility name for a city with no generation supplier", () => {
	const index = buildSearchIndex(makeParams());
	const results = searchEntries(index, "water and power");
	assert.ok(results.some((e) => e.url === "/california/pasadena/solar-permit-guide/"));
});

test("buildSearchIndex includes county and utility hub pages when provided", () => {
	const index = buildSearchIndex(makeParams());
	assert.ok(index.some((e) => e.url === "/california/county/alameda/"));
	assert.ok(index.some((e) => e.url === "/california/utility/pge/"));
});

test("buildSearchIndex omits county/utility hub entries entirely when none are provided (optional params)", () => {
	const { countyHubs, utilityHubs, ...paramsWithoutHubs } = makeParams();
	const index = buildSearchIndex(paramsWithoutHubs);
	assert.ok(!index.some((e) => e.category === "County"));
	assert.ok(!index.some((e) => e.category === "Utility"));
});

test("searchEntries matches a county name and surfaces that county's hub page", () => {
	const index = buildSearchIndex(makeParams());
	const results = searchEntries(index, "Alameda County");
	assert.ok(results.some((e) => e.url === "/california/county/alameda/"));
});

test("searchEntries matches a county name embedded in a locality entry's description", () => {
	const index = buildSearchIndex(makeParams());
	const results = searchEntries(index, "Los Angeles County");
	assert.ok(results.some((e) => e.url === "/california/pasadena/solar-permit-guide/"));
});

test("searchEntries matches a utility abbreviation and surfaces that utility's hub page", () => {
	const index = buildSearchIndex(makeParams());
	const results = searchEntries(index, "PG&E");
	assert.ok(results.some((e) => e.url === "/california/utility/pge/"));
});

test("searchEntries matches blog post content", () => {
	const index = buildSearchIndex(makeParams());
	const results = searchEntries(index, "SCE");
	assert.ok(results.some((e) => e.url === "/blog/sce-guide/"));
});

test("searchEntries matches methodology by keyword", () => {
	const index = buildSearchIndex(makeParams());
	const results = searchEntries(index, "methodology");
	assert.ok(results.some((e) => e.url === "/methodology/"));
});

test("searchEntries is case-insensitive", () => {
	const index = buildSearchIndex(makeParams());
	assert.deepEqual(searchEntries(index, "OAKLAND"), searchEntries(index, "oakland"));
});

test("searchEntries returns an empty array for an empty or whitespace-only query", () => {
	const index = buildSearchIndex(makeParams());
	assert.deepEqual(searchEntries(index, ""), []);
	assert.deepEqual(searchEntries(index, "   "), []);
});

test("searchEntries returns nothing for a query matching no entry", () => {
	const index = buildSearchIndex(makeParams());
	assert.deepEqual(searchEntries(index, "nonexistent-zzz-query"), []);
});

test("searchEntries ranks a title match above a description-only match for the same query", () => {
	const index = buildSearchIndex(makeParams());
	// "SCE" matches the blog post's title-adjacent category exactly, and also
	// appears inside the Oakland guide's description ("...(PG&E)..." does NOT
	// contain SCE, so use a query that hits both a title/category match and a
	// description-only match unambiguously).
	const results = searchEntries(index, "guide");
	// Every locality guide has "Guide" in its title; the blog index page's
	// description doesn't. Title matches should sort before any
	// description-only match.
	const firstDescriptionOnlyIndex = results.findIndex(
		(e) => !e.title.toLowerCase().includes("guide") && !e.category.toLowerCase().includes("guide"),
	);
	const lastTitleMatchIndex = results.reduce(
		(last, e, i) => (e.title.toLowerCase().includes("guide") ? i : last),
		-1,
	);
	if (firstDescriptionOnlyIndex !== -1 && lastTitleMatchIndex !== -1) {
		assert.ok(lastTitleMatchIndex < firstDescriptionOnlyIndex);
	}
});

test("searchEntries puts an exact title match first", () => {
	const index = buildSearchIndex(makeParams());
	const results = searchEntries(index, "oakland solar permit guide");
	assert.equal(results[0]?.url, "/california/oakland/solar-permit-guide/");
});

test("searchEntries is deterministic: repeated calls with the same query return the same order", () => {
	const index = buildSearchIndex(makeParams());
	const first = searchEntries(index, "california");
	const second = searchEntries(index, "california");
	assert.deepEqual(first, second);
});
