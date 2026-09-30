// Hard-fail contract for the revenue-critical routes only: the California
// locality guides that carry an active CompareSolarPrices CTA. This is the
// entire monetization path for the site, so a break here (CTA missing, page
// down, canonical pointing somewhere else) is a direct revenue outage.
//
// Modeled on tests/production-cta-contract.test.mjs and
// tests/production-route-snapshot.test.mjs: offline shape/contract tests
// always run under plain `npm test`, and the live-network probe is skipped
// unless GRIDPERMIT_PROD_PROBE=1 is set, so this never breaks CI on network
// access alone.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VERIFIED_PATH = path.join(REPO_ROOT, "data", "revenue", "compare-solar-production-verified.json");
const PRODUCTION_ORIGIN = "https://mygridpermit.com";

// The three named revenue-critical routes from the task brief, kept as an
// explicit hard-fail floor independent of whatever the data file says today —
// if any of these three ever drop out of compare-solar-production-verified.json
// that is itself a bug this test should catch.
const MUST_INCLUDE_SLUGS = ["escondido", "hemet", "pomona"];

// Markers that must all be present for the CompareSolarPrices CTA to count as
// actually rendered (attribute root, the paid-referral disclosure text, and
// the CTA button copy), taken from src/components/CompareSolarPricesCTA.astro.
const CTA_MARKERS = [
	"data-compare-solar-cta-root",
	"Paid referral disclosure:",
	"Request a quote from CompareSolarPrices",
];

function routeFor(slug) {
	return `${PRODUCTION_ORIGIN}/california/${slug}/solar-permit-guide/`;
}

// Known, deliberate exception: compare-solar-production-verified.json is a
// frozen evidence file paired (via a cross-file consistency test in
// tests/production-cta-contract.test.mjs) with an immutable historical
// Netlify deploy snapshot, so it cannot be casually edited to match today's
// live state without re-freezing that whole pair - out of scope for the
// pass that found this. Mission Viejo is listed there as verified, but a
// later pass (src/lib/utility-split-guard.ts) correctly and deliberately
// stopped rendering its CompareSolarPrices CTA: the locality record itself
// states the city is "genuinely split" SCE/SDG&E, so the generic-utility
// referral was misleading. Excluding it here reflects live reality, not a
// weakening of the contract - every other listed slug is still required.
const KNOWN_STALE_ENTRIES_NO_LONGER_MONETIZED = ["mission-viejo"];

async function loadVerifiedSlugs() {
	const raw = await readFile(VERIFIED_PATH, "utf8");
	const data = JSON.parse(raw);
	assert.ok(Array.isArray(data.verified_city_slugs), "verified_city_slugs must be an array");
	assert.ok(
		data.verified_city_slugs.length >= 61,
		`Expected at least 61 verified city slugs, found ${data.verified_city_slugs.length}`,
	);
	return data.verified_city_slugs.filter((slug) => !KNOWN_STALE_ENTRIES_NO_LONGER_MONETIZED.includes(slug));
}

async function mapConcurrent(values, concurrency, callback) {
	const results = new Array(values.length);
	let cursor = 0;
	async function worker() {
		while (cursor < values.length) {
			const index = cursor++;
			results[index] = await callback(values[index], index);
		}
	}
	await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
	return results;
}

test("the verified revenue-route list is duplicate-free and includes every named money page", async () => {
	const slugs = await loadVerifiedSlugs();
	assert.equal(new Set(slugs).size, slugs.length, "verified_city_slugs must not contain duplicates");
	for (const slug of MUST_INCLUDE_SLUGS) {
		assert.ok(slugs.includes(slug), `${slug} is missing from data/revenue/compare-solar-production-verified.json`);
	}
});

test(
	"every revenue-critical route returns 200, has a self-referencing canonical, and renders the CompareSolarPrices CTA",
	{ skip: process.env.GRIDPERMIT_PROD_PROBE !== "1", timeout: 120_000 },
	async () => {
		const slugs = await loadVerifiedSlugs();
		const failures = [];

		await mapConcurrent(slugs, 8, async (slug) => {
			const url = routeFor(slug);
			const response = await fetch(url, { method: "GET", redirect: "manual" });
			if (response.status !== 200) {
				failures.push(`${url} returned HTTP ${response.status} (expected 200, no redirect tolerance on money pages)`);
				return;
			}

			const html = await response.text();

			const canonicalMatch = html.match(/<link rel="canonical" href="([^"]+)"/);
			if (!canonicalMatch) {
				failures.push(`${url} has no canonical tag`);
			} else if (canonicalMatch[1] !== url) {
				failures.push(`${url} canonical tag points at ${canonicalMatch[1]}, expected self-reference`);
			}

			for (const marker of CTA_MARKERS) {
				if (!html.includes(marker)) failures.push(`${url} is missing CTA marker: ${marker}`);
			}
		});

		assert.deepEqual(failures, [], `${failures.length} revenue-critical route checks failed:\n${failures.join("\n")}`);
	},
);
