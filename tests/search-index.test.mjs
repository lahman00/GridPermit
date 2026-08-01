import { test } from "node:test";
import assert from "node:assert/strict";

import { buildSearchIndex, searchEntries } from "../src/lib/search-index.ts";

function makeParams() {
	return {
		localityEntries: [
			{ recordId: "ca-alameda-oakland-pge", city: "Oakland", utility: "Pacific Gas and Electric Company (PG&E)", generationSupplierName: "Ava Community Energy", completenessPct: 86.7, lastVerified: "2026-08-01", citySlug: "oakland", guideUrl: "/california/oakland/solar-permit-guide/" },
			{ recordId: "ca-los-angeles-pasadena-pwp", city: "Pasadena", utility: "Pasadena Water and Power", generationSupplierName: null, completenessPct: 93.3, lastVerified: "2026-08-01", citySlug: "pasadena", guideUrl: "/california/pasadena/solar-permit-guide/" },
		],
		blogPosts: [
			{ title: "SCE NEM 3.0 Guide", description: "SCE customers are losing thousands under NEM 3.0.", url: "/blog/sce-guide/", category: "SCE", displayDate: "x", sortDate: "2026-07-26", hasExactDate: true },
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
