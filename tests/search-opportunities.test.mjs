// Tests for the Search Opportunity Engine (scripts/lib/search-opportunities.mjs).
// Fixtures are synthetic: private Search Console metrics never enter the repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
	SIGNIFICANCE,
	analyzeSearch,
	binomialCdf,
	classifyPage,
	intentMismatches,
	pageFamily,
	parseGscExport,
	pooledCtrByBucket,
	positionBucket,
	queryClusters,
	templateQuery,
} from "../scripts/lib/search-opportunities.mjs";

const row = (keys, clicks, impressions, position) => ({ keys, clicks, impressions, position });
const exportText = (over = {}, pages = [], qp = []) =>
	JSON.stringify({
		evidence_type: "authenticated_google_search_analytics_api",
		property: "https://mygridpermit.com/",
		data_state: "final",
		search_type: "web",
		window_start: "2026-09-10",
		window_end: "2026-10-08",
		queried_at_utc: "2026-10-09T13:47:00Z",
		page: { rows: pages },
		query_page: { rows: qp },
		country_page: { rows: [] },
		...over,
	});
const P = (path) => `https://mygridpermit.com${path}`;

test("only authenticated, final, web, mygridpermit.com exports are accepted", () => {
	assert.doesNotThrow(() => parseGscExport(exportText()));
	for (const bad of [{ evidence_type: "csv_download" }, { data_state: "all" }, { search_type: "image" }, { property: "https://other.com/" }, { window_start: "2026-10-09" }, { window_start: "nope" }]) {
		assert.throws(() => parseGscExport(exportText(bad)), undefined, JSON.stringify(bad));
	}
	assert.throws(() => parseGscExport(exportText({}, [row([P("/a/")], 5, 3, 4)])), /impossible counts/);
	assert.throws(() => parseGscExport(exportText({}, [{ keys: [], clicks: 0, impressions: 1, position: 1 }])), /invalid shape/);
});

test("the content hash is of the exact bytes analysed", () => {
	const t = exportText();
	assert.equal(parseGscExport(t).meta.sha256, parseGscExport(t).meta.sha256);
	assert.notEqual(parseGscExport(t).meta.sha256, parseGscExport(t + " ").meta.sha256);
});

test("fractional positions never fall into a gap between buckets", () => {
	assert.deepEqual([3.9996, 6.9996, 10.9996, 20.9996, 0.5, 1, 4, 7, 11, 21].map(positionBucket), ["1-3", "4-6", "7-10", "11-20", "1-3", "1-3", "4-6", "7-10", "11-20", "21+"]);
});

test("impossible calendar dates are rejected", () => {
	assert.throws(() => parseGscExport(exportText({ window_start: "2026-02-30" })), /window is invalid/);
	assert.throws(() => parseGscExport(exportText({ window_end: "2026-13-01" })), /window is invalid/);
});

test("query templates are case-insensitive and match whole words only", () => {
	assert.equal(templateQuery("Solar Permit Services Alpha City", "alpha-city"), "solar permit services {city}");
	assert.equal(templateQuery("solar permit", null), "solar permit");
	assert.equal(templateQuery("solar permit", "solar"), "{city} permit");
	assert.equal(templateQuery("irvine solar", "vine"), "irvine solar");
});

test("page families and position buckets", () => {
	assert.deepEqual(pageFamily("/california/pasadena/solar-permit-guide/"), { family: "locality", state: "california", city: "pasadena" });
	assert.equal(pageFamily("/blog/x/").family, "blog");
	assert.equal(pageFamily("/california/utility/pg-e/").family, "utility_hub");
	assert.equal(pageFamily("/").family, "home");
	assert.deepEqual([1, 3.99, 4, 6.99, 7, 10.99, 11, 20.99, 21, 80].map(positionBucket), ["1-3", "1-3", "4-6", "4-6", "7-10", "7-10", "11-20", "11-20", "21+", "21+"]);
});

test("binomial CDF matches known values and is stable for large n", () => {
	assert.ok(Math.abs(binomialCdf(0, 10, 0.5) - 1 / 1024) < 1e-12);
	assert.ok(Math.abs(binomialCdf(5, 10, 0.5) - 0.623046875) < 1e-9);
	assert.equal(binomialCdf(10, 10, 0.3), 1);
	assert.equal(binomialCdf(0, 5, 0), 1);
	const big = binomialCdf(100, 5000, 0.02);
	assert.ok(big > 0.4 && big < 0.6, String(big));
});

function site(extra = []) {
	// 40 pages at position ~5, 10 clicks per 400 impressions pooled (2.5%)
	const pages = Array.from({ length: 40 }, (_, i) => ({ path: `/s/p${i}/`, clicks: i < 10 ? 1 : 0, impressions: 10, position: 5 }));
	return [...pages, ...extra];
}

test("zero clicks at 25 impressions is WITHIN_NOISE; a large gap is flagged; volume and position gates apply", () => {
	const pooled = pooledCtrByBucket(site([{ path: "/x/", clicks: 0, impressions: 25, position: 5 }, { path: "/y/", clicks: 0, impressions: 600, position: 5 }]));
	const noise = classifyPage({ path: "/x/", clicks: 0, impressions: 25, position: 5 }, pooled);
	assert.equal(noise.status, "WITHIN_NOISE");
	const big = classifyPage({ path: "/y/", clicks: 0, impressions: 600, position: 5 }, pooled);
	assert.equal(big.status, "SNIPPET_UNDERPERFORMING_VS_SITE_BASELINE");
	assert.ok(big.evidence.probability_of_this_few_clicks <= SIGNIFICANCE);
	assert.equal(classifyPage({ clicks: 0, impressions: 19, position: 5 }, pooled).status, "LOW_VOLUME");
	assert.equal(classifyPage({ clicks: 0, impressions: 40, position: 15 }, pooled).status, "NEAR_PAGE_ONE");
	assert.equal(classifyPage({ clicks: 0, impressions: 40, position: 45 }, pooled).status, "NOT_ACTIONABLE_POSITION");
});

test("a thin baseline never produces a verdict", () => {
	const pooled = pooledCtrByBucket([{ path: "/a/", clicks: 0, impressions: 50, position: 8 }]);
	assert.equal(classifyPage({ clicks: 0, impressions: 50, position: 8 }, pooled).status, "INSUFFICIENT_BASELINE");
});

test("query templates cluster across cities and intent mismatches are hypotheses", () => {
	assert.equal(templateQuery("solar permit services alpha city", "alpha-city"), "solar permit services {city}");
	assert.equal(templateQuery("tesla powerwall 3", null), "tesla powerwall 3");
	const qp = [
		{ query: "solar permit services alpha city", path: "/california/alpha-city/solar-permit-guide/", clicks: 0, impressions: 7, position: 14 },
		{ query: "solar permit services beta town", path: "/california/beta-town/solar-permit-guide/", clicks: 0, impressions: 5, position: 22 },
		{ query: "synthetic informational query", path: "/blog/synthetic-article/", clicks: 0, impressions: 2, position: 41 },
	];
	const c = queryClusters(qp);
	assert.equal(c[0].template, "solar permit services {city}");
	assert.equal(c[0].impressions, 12);
	assert.equal(c[0].pages, 2);
	const m = intentMismatches(qp);
	assert.equal(m.length, 2);
	assert.ok(m.every((x) => x.label === "HYPOTHESIS"));
});

test("locked pages are reported but never recommended; unknown inbound is UNKNOWN", () => {
	const text = exportText({}, [
		row([P("/california/a/solar-permit-guide/")], 0, 40, 12),
		row([P("/california/b/solar-permit-guide/")], 0, 40, 13),
		...Array.from({ length: 40 }, (_, i) => row([P(`/s/p${i}/`)], 0, 10, 30)),
	]);
	const parsed = parseGscExport(text);
	const a = analyzeSearch(parsed, { lockedPaths: new Set(["/california/a/solar-permit-guide/"]) });
	assert.deepEqual(a.actionable.map((p) => p.path), ["/california/b/solar-permit-guide/"]);
	assert.equal(a.pages.find((p) => p.path === "/california/a/solar-permit-guide/").locked, true);
	assert.equal(a.pages.find((p) => p.path === "/california/b/solar-permit-guide/").inbound_pages, "UNKNOWN");
	const withLinks = analyzeSearch(parsed, { inboundByPath: { "/california/b/solar-permit-guide/": { inbound_pages: 1 } } });
	assert.deepEqual(withLinks.internal_link_opportunities.map((p) => p.path), ["/california/b/solar-permit-guide/"]);
});

test("analysis is deterministic and states its limitations", () => {
	const text = exportText({}, [row([P("/a/")], 1, 30, 6), row([P("/b/")], 0, 30, 6)]);
	const x = analyzeSearch(parseGscExport(text));
	assert.deepEqual(x, analyzeSearch(parseGscExport(text)));
	assert.ok(x.limitations.some((l) => /not summed/.test(l)));
	assert.ok(x.limitations.some((l) => /privacy-thresholded/.test(l)));
});
