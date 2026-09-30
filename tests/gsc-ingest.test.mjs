// Coverage for scripts/gsc-ingest.mjs — the GSC export ingestion pipeline —
// and scripts/lib/money-query-classifier.mjs's bucket/intent logic.
//
// Note on file location: the task that produced this pipeline asked for the
// companion test at scripts/gsc-ingest.test.mjs, but every existing test in
// this repo lives under tests/ and npm test's glob (tests/*.test.mjs) only
// picks up files there — so this file lives at tests/gsc-ingest.test.mjs to
// match the repo's actual convention and actually run under `npm test`.
//
// These tests are fully offline: no network, and no dependency on the real
// output/gsc-demand-2026-09-23/ data — everything here uses small inline or
// tmpdir fixtures so the suite is deterministic regardless of what real GSC
// exports happen to contain.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	parseCsv,
	detectCsvFormat,
	normalizeLandingPage,
	parseNonNegativeInteger,
	parseCtrPct,
	parsePosition,
	validateAndNormalizeRawRow,
	dedupeRows,
	citySlug,
	classifyPageType,
	findConfidentCityMatch,
	enrichRow,
	loadLocalityIndex,
	loadVerifiedCitySlugs,
	runIngest,
	NORMALIZED_HEADER,
} from "../scripts/gsc-ingest.mjs";
import { classifyCommercialIntent, classifyMoneyQueryBucket } from "../scripts/lib/money-query-classifier.mjs";

// --- format auto-detection ---------------------------------------------------

test("detectCsvFormat recognizes the page-level shape regardless of extra/leading columns", () => {
	assert.equal(detectCsvFormat(["key", "clicks", "impressions", "ctr_pct", "position"]), "page");
	assert.equal(
		detectCsvFormat(["priority_order", "key", "clicks", "impressions", "ctr_pct", "position", "family", "monetization_state"]),
		"page",
	);
});

test("detectCsvFormat recognizes the query-level shape (no landing page column)", () => {
	assert.equal(detectCsvFormat(["query", "clicks", "impressions", "ctr_pct", "position"]), "query");
});

test("detectCsvFormat rejects aggregate-shaped files that are neither page- nor query-level", () => {
	assert.equal(detectCsvFormat(["state", "clicks", "click_share_of_65_pct", "gsc_rows"]), "unsupported");
	assert.equal(detectCsvFormat(["theme", "query_rows", "impressions", "clicks_visible"]), "unsupported");
});

// --- CSV parsing (handles quoted/escaped fields) -----------------------------

test("parseCsv handles a doubly-quoted, comma-free field containing literal escaped quotes", () => {
	const content =
		'query,clicks,impressions,ctr_pct,position\n' +
		'"""building department"" ""city of gonzales"" california official",0,1,0.0,8.0\n';
	const { header, rows } = parseCsv(content);
	assert.deepEqual(header, ["query", "clicks", "impressions", "ctr_pct", "position"]);
	assert.equal(rows.length, 1);
	assert.equal(rows[0][0], '"building department" "city of gonzales" california official');
});

test("parseCsv throws on completely empty content", () => {
	assert.throws(() => parseCsv(""), /no rows/);
});

// --- numeric validation: fails closed, never coerces -------------------------

test("parseNonNegativeInteger rejects negatives, decimals, and non-numeric junk instead of coercing", () => {
	assert.equal(parseNonNegativeInteger("12", "clicks"), 12);
	assert.throws(() => parseNonNegativeInteger("-1", "clicks"), /non-negative integer/);
	assert.throws(() => parseNonNegativeInteger("1.5", "clicks"), /non-negative integer/);
	assert.throws(() => parseNonNegativeInteger("abc", "clicks"), /non-negative integer/);
	assert.throws(() => parseNonNegativeInteger("", "clicks"), /missing required field/);
	assert.throws(() => parseNonNegativeInteger(undefined, "clicks"), /missing required field/);
});

test("parseCtrPct enforces the 0-100 range and rejects non-numeric input", () => {
	assert.equal(parseCtrPct("8.33"), 8.33);
	assert.equal(parseCtrPct("0.0"), 0);
	assert.equal(parseCtrPct("100"), 100);
	assert.throws(() => parseCtrPct("100.01"), /0-100 range/);
	assert.throws(() => parseCtrPct("-0.1"), /0-100 range/);
	assert.throws(() => parseCtrPct("not-a-number"), /is not a number/);
});

test("parsePosition requires a positive finite number", () => {
	assert.equal(parsePosition("6.79"), 6.79);
	assert.throws(() => parsePosition("0"), /positive number/);
	assert.throws(() => parsePosition("-3"), /positive number/);
	assert.throws(() => parsePosition("NaN"), /is not a number/);
});

test("validateAndNormalizeRawRow fails closed when clicks exceeds impressions (impossible data, not a coercion target)", () => {
	const raw = {
		format: "query",
		query: "solar permit escondido",
		clicksRaw: "5",
		impressionsRaw: "2",
		ctrRaw: "50.0",
		positionRaw: "3.0",
		sourceFile: "fixture.csv",
		rowNumber: 2,
	};
	assert.throws(() => validateAndNormalizeRawRow(raw), /exceeds impressions/);
});

test("validateAndNormalizeRawRow fills the un-exported dimension with the literal string UNKNOWN, never a guess", () => {
	const queryRow = validateAndNormalizeRawRow({
		format: "query",
		query: "solar permit bakersfield",
		clicksRaw: "0",
		impressionsRaw: "14",
		ctrRaw: "0.0",
		positionRaw: "16.57",
		sourceFile: "fixture.csv",
		rowNumber: 2,
	});
	assert.equal(queryRow.landing_page, "UNKNOWN");
	assert.equal(queryRow.query, "solar permit bakersfield");

	const pageRow = validateAndNormalizeRawRow({
		format: "page",
		landingPageRaw: "https://mygridpermit.com/california/escondido/solar-permit-guide/",
		clicksRaw: "2",
		impressionsRaw: "16",
		ctrRaw: "12.5",
		positionRaw: "6.5",
		sourceFile: "fixture.csv",
		rowNumber: 3,
	});
	assert.equal(pageRow.query, "UNKNOWN");
	assert.equal(pageRow.landing_page, "https://mygridpermit.com/california/escondido/solar-permit-guide/");
});

// --- URL normalization --------------------------------------------------------

test("normalizeLandingPage adds a trailing slash and strips a query string, keeping the site's actual served format", () => {
	assert.equal(
		normalizeLandingPage("https://mygridpermit.com/california/escondido/solar-permit-guide"),
		"https://mygridpermit.com/california/escondido/solar-permit-guide/",
	);
	assert.equal(
		normalizeLandingPage("https://www.mygridpermit.com/california/escondido/solar-permit-guide/?utm_source=x"),
		"https://mygridpermit.com/california/escondido/solar-permit-guide/",
	);
});

test("normalizeLandingPage fails closed on a non-mygridpermit.com host instead of guessing a rewrite", () => {
	assert.throws(() => normalizeLandingPage("https://example.com/california/escondido/"), /is not mygridpermit\.com/);
});

// --- dedup ---------------------------------------------------------------------

test("dedupeRows collapses an identical row seen in two source files (overlapping CSV slices)", () => {
	const rowA = {
		query: "UNKNOWN",
		landing_page: "https://mygridpermit.com/california/escondido/solar-permit-guide/",
		clicks: 2,
		impressions: 16,
		ctr: 12.5,
		position: 6.5,
		sourceFile: "GSC_28D_PAGES_ALL.csv",
	};
	const rowB = { ...rowA, sourceFile: "GSC_28D_CSP_PRODUCTION_DEMAND.csv" };
	const result = dedupeRows([rowA, rowB]);
	assert.equal(result.length, 1);
});

test("dedupeRows throws on a real conflict (same query+landing_page, different metrics) instead of silently picking one", () => {
	const rowA = {
		query: "UNKNOWN",
		landing_page: "https://mygridpermit.com/california/escondido/solar-permit-guide/",
		clicks: 2,
		impressions: 16,
		ctr: 12.5,
		position: 6.5,
		sourceFile: "file-a.csv",
	};
	const rowB = { ...rowA, clicks: 3, sourceFile: "file-b.csv" };
	assert.throws(() => dedupeRows([rowA, rowB]), /conflicting duplicate rows/);
});

// --- URL structure classification --------------------------------------------

test("citySlug matches src/lib/locality-guide.ts's slugify algorithm", () => {
	assert.equal(citySlug("San Diego"), "san-diego");
	assert.equal(citySlug("  St. Helena  "), "st-helena");
});

test("classifyPageType derives page type from URL structure alone", () => {
	assert.equal(classifyPageType("/california/escondido/solar-permit-guide/"), "ca_locality_guide");
	assert.equal(classifyPageType("/colorado/denver/solar-permit-guide/"), "nonca_locality_guide");
	assert.equal(classifyPageType("/blog/sdge-guide/"), "blog_post");
	assert.equal(classifyPageType("/blog/"), "blog_index");
	assert.equal(classifyPageType("/california/county/orange/"), "county_hub");
	assert.equal(classifyPageType("/california/utility/sce/"), "utility_hub");
	assert.equal(classifyPageType("/oklahoma/oklahoma-city/"), "nonca_locality_index");
	assert.equal(classifyPageType("/colorado/"), "state_index");
	assert.equal(classifyPageType("/about/"), "site_page");
	assert.equal(classifyPageType("/"), "homepage");
});

// --- commercial-intent classification -----------------------------------------

test("classifyCommercialIntent applies the documented priority order (permit > battery > interconnection > rebate > general > other)", () => {
	assert.equal(classifyCommercialIntent("solar permit services bakersfield"), "PERMIT");
	assert.equal(classifyCommercialIntent("enphase vs tesla powerwall 3"), "BATTERY");
	assert.equal(classifyCommercialIntent("sgip rebate 2023"), "BATTERY"); // SGIP is a battery program, checked before generic rebate
	assert.equal(classifyCommercialIntent("pto solar meaning"), "INTERCONNECTION_PTO");
	assert.equal(classifyCommercialIntent("sdge residential electricity rate per kwh 2026"), "REBATE_RATE");
	assert.equal(classifyCommercialIntent("banning ca solar"), "GENERAL_SOLAR");
	assert.equal(classifyCommercialIntent("city of sacramento"), "OTHER");
	assert.equal(classifyCommercialIntent(""), "OTHER");
});

test("classifyCommercialIntent uses word-boundary matching (no false substring hits)", () => {
	// "express" contains "ess" and "separate" contains "rate" as substrings —
	// neither should trigger the BATTERY/REBATE_RATE keyword.
	assert.notEqual(classifyCommercialIntent("long beach solar express delivery"), "BATTERY");
	assert.notEqual(classifyCommercialIntent("a separate solar question"), "REBATE_RATE");
});

// --- money-query bucket (A-E) --------------------------------------------------

test("classifyMoneyQueryBucket applies the A-E priority order exactly as documented", () => {
	assert.equal(classifyMoneyQueryBucket({ clicks: 2, impressions: 16, position: 6.5, moneyPage: true, commercialIntent: "PERMIT" }), "A");
	assert.equal(
		classifyMoneyQueryBucket({ clicks: 0, impressions: 30, position: 5.8, moneyPage: true, commercialIntent: "GENERAL_SOLAR" }),
		"B",
	);
	assert.equal(
		classifyMoneyQueryBucket({ clicks: 0, impressions: 5, position: 20, moneyPage: false, commercialIntent: "PERMIT" }),
		"C",
	);
	assert.equal(
		classifyMoneyQueryBucket({ clicks: 0, impressions: 1, position: 50, moneyPage: false, commercialIntent: "GENERAL_SOLAR" }),
		"D",
	);
	assert.equal(
		classifyMoneyQueryBucket({ clicks: 0, impressions: 1, position: 60, moneyPage: false, commercialIntent: "OTHER" }),
		"E",
	);
});

test("classifyMoneyQueryBucket: A takes priority over B when both conditions hold", () => {
	assert.equal(
		classifyMoneyQueryBucket({ clicks: 1, impressions: 20, position: 10, moneyPage: true, commercialIntent: "OTHER" }),
		"A",
	);
});

// --- locality lookups + confident-vs-ambiguous city inference ---------------

const tmpDir = mkdtempSync(path.join(tmpdir(), "gsc-ingest-test-"));
const fixtureLocalitiesDir = path.join(tmpDir, "localities");
mkdirSync(fixtureLocalitiesDir, { recursive: true });

function writeLocalityFixture(fileName, record) {
	writeFileSync(path.join(fixtureLocalitiesDir, fileName), JSON.stringify(record), "utf8");
}

// Escondido: unique city name -> unambiguous.
writeLocalityFixture("ca-escondido.json", {
	record_id: "ca-escondido",
	state: "CA",
	city: { value: "Escondido" },
	utility: { value: "San Diego Gas & Electric (SDG&E)" },
	county: { value: "San Diego County" },
});
// Richmond: same city name real-collision fixture, CA + VA (mirrors the
// actual data/localities/*.json collision found in this project).
writeLocalityFixture("ca-richmond.json", {
	record_id: "ca-richmond",
	state: "CA",
	city: { value: "Richmond" },
	utility: { value: "Pacific Gas & Electric (PG&E)" },
	county: { value: "Contra Costa County" },
});
writeLocalityFixture("va-richmond.json", {
	record_id: "va-richmond",
	state: "VA",
	city: { value: "Richmond" },
	utility: { value: "Dominion Energy" },
	county: { value: "City of Richmond" },
});
// West Covina + Covina: nested-name fixture (a query mentioning "west
// covina" also literally contains the word "covina").
writeLocalityFixture("ca-west-covina.json", {
	record_id: "ca-west-covina",
	state: "CA",
	city: { value: "West Covina" },
	utility: { value: "Southern California Edison (SCE)" },
	county: { value: "Los Angeles County" },
});
writeLocalityFixture("ca-covina.json", {
	record_id: "ca-covina",
	state: "CA",
	city: { value: "Covina" },
	utility: { value: "Southern California Edison (SCE)" },
	county: { value: "Los Angeles County" },
});

test.after(() => rmSync(tmpDir, { recursive: true, force: true }));

test("loadLocalityIndex + findConfidentCityMatch resolves an unambiguous city mention in free text", async () => {
	const index = await loadLocalityIndex(fixtureLocalitiesDir);
	const match = findConfidentCityMatch("solar permit services escondido", index);
	assert.ok(match);
	assert.equal(match.city, "Escondido");
	assert.equal(match.state, "CA");
});

test("findConfidentCityMatch returns null (UNKNOWN), never a guess, for a real cross-state name collision", async () => {
	const index = await loadLocalityIndex(fixtureLocalitiesDir);
	assert.equal(findConfidentCityMatch("richmond solar permit", index), null);
});

test("findConfidentCityMatch prefers the maximal (longer) match over a nested shorter city name", async () => {
	const index = await loadLocalityIndex(fixtureLocalitiesDir);
	const match = findConfidentCityMatch("west covina solar", index);
	assert.ok(match);
	assert.equal(match.city, "West Covina");
});

test("findConfidentCityMatch returns null for text with no city mention at all", async () => {
	const index = await loadLocalityIndex(fixtureLocalitiesDir);
	assert.equal(findConfidentCityMatch("yes all", index), null);
});

// --- full row enrichment: money_page / cta_present / first_lead_route -------

test("enrichRow marks money_page/partner_eligible/cta_present true only for a verified CA locality guide page", () => {
	const localityIndexPromise = loadLocalityIndex(fixtureLocalitiesDir);
	return localityIndexPromise.then((localityIndex) => {
		const verifiedSlugs = new Set(["escondido"]);
		const row = {
			query: "UNKNOWN",
			landing_page: "https://mygridpermit.com/california/escondido/solar-permit-guide/",
			clicks: 2,
			impressions: 16,
			ctr: 12.5,
			position: 6.5,
			window_start: "2026-08-27",
			window_end: "2026-09-23",
			family: "ca_locality",
			monetization_state: "CSP_PRODUCTION_BASELINE",
		};
		const enriched = enrichRow(row, { localityIndex, verifiedSlugs });
		assert.equal(enriched.state, "CA");
		assert.equal(enriched.city, "Escondido");
		assert.equal(enriched.page_type, "ca_locality_guide");
		assert.equal(enriched.money_page, true);
		assert.equal(enriched.partner_eligible, true);
		assert.equal(enriched.cta_present, true);
		assert.equal(enriched.first_lead_route, true);
	});
});

test("enrichRow marks a non-verified CA locality guide page as money_page=false, cta_present=false (not UNKNOWN — it's a confident negative)", async () => {
	const localityIndex = await loadLocalityIndex(fixtureLocalitiesDir);
	const verifiedSlugs = new Set(["escondido"]); // richmond is NOT verified
	const row = {
		query: "UNKNOWN",
		landing_page: "https://mygridpermit.com/california/richmond/solar-permit-guide/",
		clicks: 2,
		impressions: 24,
		ctr: 8.33,
		position: 6.79,
		window_start: "2026-08-27",
		window_end: "2026-09-23",
		family: "ca_locality",
		monetization_state: "NO_CSP_ROUTE",
	};
	// Richmond is ambiguous by name (CA/VA collision) but the landing_page's
	// state segment is structurally known (california), so this must resolve
	// via the URL lookup, not the ambiguous free-text path.
	const enriched = enrichRow(row, { localityIndex, verifiedSlugs });
	assert.equal(enriched.city, "Richmond");
	assert.equal(enriched.state, "CA");
	assert.equal(enriched.money_page, false);
	assert.equal(enriched.cta_present, false);
});

test("enrichRow marks cta_present UNKNOWN for a query-only row (no landing page to verify against)", async () => {
	const localityIndex = await loadLocalityIndex(fixtureLocalitiesDir);
	const verifiedSlugs = new Set(["escondido"]);
	const row = {
		query: "solar permit services escondido",
		landing_page: "UNKNOWN",
		clicks: 0,
		impressions: 14,
		ctr: 0,
		position: 16.57,
		window_start: "2026-08-27",
		window_end: "2026-09-23",
		family: null,
		monetization_state: null,
	};
	const enriched = enrichRow(row, { localityIndex, verifiedSlugs });
	assert.equal(enriched.city, "Escondido");
	assert.equal(enriched.money_page, false); // no page exists to be a money page
	assert.equal(enriched.cta_present, "UNKNOWN");
	assert.equal(enriched.commercial_intent, "PERMIT");
	assert.equal(enriched.first_lead_route, true);
});

test("enrichRow marks cta_present false (structurally known, not UNKNOWN) for a county hub page", async () => {
	const localityIndex = await loadLocalityIndex(fixtureLocalitiesDir);
	const verifiedSlugs = new Set(["escondido"]);
	const row = {
		query: "UNKNOWN",
		landing_page: "https://mygridpermit.com/california/county/orange/",
		clicks: 0,
		impressions: 5,
		ctr: 0,
		position: 20,
		window_start: "2026-08-27",
		window_end: "2026-09-23",
		family: null,
		monetization_state: null,
	};
	const enriched = enrichRow(row, { localityIndex, verifiedSlugs });
	assert.equal(enriched.page_type, "county_hub");
	assert.equal(enriched.money_page, false);
	assert.equal(enriched.cta_present, false);
});

// --- end-to-end run against a tiny synthetic CSV directory -------------------

test("runIngest end-to-end: writes both output files with the documented schema and a sane bucket distribution", async () => {
	const runDir = mkdtempSync(path.join(tmpdir(), "gsc-ingest-run-"));
	const csvDir = path.join(runDir, "csvs");
	const outDir = path.join(runDir, "out");
	mkdirSync(csvDir, { recursive: true });
	mkdirSync(outDir, { recursive: true });

	writeFileSync(
		path.join(csvDir, "PAGES.csv"),
		"key,clicks,impressions,ctr_pct,position,family,monetization_state\n" +
			"https://mygridpermit.com/california/escondido/solar-permit-guide/,2,16,12.5,6.5,ca_locality,CSP_PRODUCTION_BASELINE\n" +
			"https://mygridpermit.com/blog/sdge-guide/,2,130,1.54,10.02,blog,NO_CSP_ROUTE\n",
		"utf8",
	);
	writeFileSync(
		path.join(csvDir, "QUERIES.csv"),
		"query,clicks,impressions,ctr_pct,position\n" + "solar permit services escondido,0,14,0.0,16.57\n",
		"utf8",
	);
	// An aggregate-shaped file that must be skipped, not treated as malformed.
	writeFileSync(path.join(csvDir, "THEMES.csv"), "theme,query_rows,impressions,clicks_visible\npermit_services,8,40,0\n", "utf8");

	try {
		const summary = await runIngest(csvDir, outDir);
		assert.equal(summary.csvFilesProcessed, 2);
		assert.deepEqual(summary.csvFilesSkipped, ["THEMES.csv"]);
		assert.equal(summary.uniqueRowsAfterDedup, 3);
		const totalBucketed = Object.values(summary.bucketCounts).reduce((a, b) => a + b, 0);
		assert.equal(totalBucketed, 3);

		const normalizedCsv = readFileSync(summary.normalizedOutputPath, "utf8");
		const firstLine = normalizedCsv.split("\n")[0];
		assert.equal(firstLine, NORMALIZED_HEADER.join(","));

		const queueCsv = readFileSync(summary.moneyQueueOutputPath, "utf8");
		assert.equal(queueCsv.split("\n")[0], [...NORMALIZED_HEADER, "bucket"].join(","));
	} finally {
		rmSync(runDir, { recursive: true, force: true });
	}
});

test("runIngest fails closed (throws, writes nothing new) when a CSV has a malformed numeric field", async () => {
	const runDir = mkdtempSync(path.join(tmpdir(), "gsc-ingest-bad-run-"));
	const csvDir = path.join(runDir, "csvs");
	mkdirSync(csvDir, { recursive: true });
	writeFileSync(
		path.join(csvDir, "BAD.csv"),
		"key,clicks,impressions,ctr_pct,position\n" + "https://mygridpermit.com/california/escondido/solar-permit-guide/,-2,16,12.5,6.5\n",
		"utf8",
	);
	try {
		await assert.rejects(() => runIngest(csvDir, path.join(runDir, "out")), /non-negative integer/);
	} finally {
		rmSync(runDir, { recursive: true, force: true });
	}
});

test("loadVerifiedCitySlugs reads the real verified-city allowlist as a Set", async () => {
	const repoRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
	const verifiedPath = path.join(repoRoot, "data", "revenue", "compare-solar-production-verified.json");
	const slugs = await loadVerifiedCitySlugs(verifiedPath);
	assert.ok(slugs.has("escondido"));
	assert.ok(slugs.has("hemet"));
	assert.ok(slugs.has("pomona"));
	assert.ok(slugs.size >= 60 && slugs.size <= 65);
});
