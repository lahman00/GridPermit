// Tests for the organic measurement report: UNKNOWN is never zero, stages stay
// separate, and small samples never produce a verdict.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
	UNKNOWN,
	behaviourReport,
	compareStructural,
	rate,
	renderReportMarkdown,
	structuralMetrics,
	sumMetric,
} from "../scripts/lib/organic-report.mjs";

const snap = (pages) => ({ pages: Object.fromEntries(Object.entries(pages).map(([k, links]) => [k, { internal_links: links }])) });

test("structural metrics count distinct linking pages by type and ignore self-links", () => {
	const s = snap({
		"/california/a/solar-permit-guide/": ["/blog/x/"],
		"/california/b/solar-permit-guide/": ["/blog/x/"],
		"/california/utility/pg-e/": ["/blog/x/"],
		"/blog/y/": ["/blog/x/"],
		"/blog/x/": ["/blog/x/"],
	});
	assert.deepEqual(structuralMetrics(s, ["/blog/x/"])["/blog/x/"], { inbound_pages: 4, from_location_pages: 2, from_utility_hubs: 1, from_articles: 1 });
	const head = snap({ "/california/a/solar-permit-guide/": ["/blog/x/"], "/blog/x/": [] });
	const base = snap({ "/california/a/solar-permit-guide/": [], "/blog/x/": [] });
	assert.equal(compareStructural(base, head, ["/blog/x/"])[0].delta_from_location_pages, 1);
});

test("a missing or null metric makes the sum UNKNOWN and names the page, never zero", () => {
	const period = { pages: { "/a/": { organic_entrances: 50 }, "/b/": { organic_entrances: null }, "/c/": {} } };
	assert.deepEqual(sumMetric(period, ["/a/"], "organic_entrances"), { value: 50, missing_pages: [] });
	assert.deepEqual(sumMetric(period, ["/a/", "/b/", "/c/"], "organic_entrances"), { value: UNKNOWN, missing_pages: ["/b/", "/c/"] });
	assert.equal(sumMetric(period, ["/a/"], "page_views").value, UNKNOWN);
	assert.equal(sumMetric({ pages: { "/z/": { organic_entrances: 0 } } }, ["/z/"], "organic_entrances").value, 0);
});

test("rates are UNKNOWN for unknown inputs or a zero denominator", () => {
	assert.equal(rate({ value: 1 }, { value: 0 }), UNKNOWN);
	assert.equal(rate({ value: UNKNOWN }, { value: 10 }), UNKNOWN);
	assert.equal(rate({ value: 1 }, { value: 4 }), 0.25);
});

const mk = (entrances, extra = {}) => ({ range: "r", source: "s", pages: { "/s/": { organic_entrances: entrances, ...extra }, "/c/": { organic_entrances: entrances, ...extra } } });

test("small or unknown samples give INSUFFICIENT_DATA; large known samples are comparable but not causal", () => {
	const small = behaviourReport({ before: mk(10), after: mk(10), slicePages: ["/s/"], controlPages: ["/c/"] });
	assert.equal(small.verdict, "INSUFFICIENT_DATA");
	const unknown = behaviourReport({ before: mk(null), after: mk(500), slicePages: ["/s/"], controlPages: ["/c/"] });
	assert.equal(unknown.verdict, "INSUFFICIENT_DATA");
	assert.ok(unknown.reasons.some((r) => r.includes("UNKNOWN")));
	const big = behaviourReport({ before: mk(500, { internal_resource_clicked: 0 }), after: mk(500, { internal_resource_clicked: 25 }), slicePages: ["/s/"], controlPages: ["/c/"] });
	assert.equal(big.verdict, "COMPARABLE_NOT_CAUSAL");
	assert.equal(big.groups.slice.after.rates.internal_resource_clicks_per_entrance, 0.05);
	assert.equal(big.groups.slice.before.rates.internal_resource_clicks_per_entrance, 0);
});

test("stages stay separate and revenue stages are never inferred", () => {
	const r = behaviourReport({ before: mk(500), after: mk(500, { cpl_cta_clicked: 3 }), slicePages: ["/s/"], controlPages: ["/c/"] });
	assert.deepEqual(Object.keys(r.groups.slice.after.metrics), ["ORGANIC_SESSION", "INTERNAL_NAVIGATION", "PARTNER_OUTBOUND"]);
	assert.equal(r.groups.slice.after.metrics.INTERNAL_NAVIGATION.internal_resource_clicked.value, UNKNOWN);
	assert.deepEqual(r.not_inferred.map((n) => n.metric), ["qualified_leads", "installs", "commission", "cash"]);
	assert.ok(r.not_inferred.every((n) => n.value === "NOT_INFERRED_FROM_CLICKS"));
});

test("markdown says UNKNOWN when no export was supplied", () => {
	const md = renderReportMarkdown({ generated_for: "2026-10-19", structural: [], behaviour: null });
	assert.match(md, /every behavioural metric is UNKNOWN/);
	assert.match(md, /hypothesis, not proof/);
});

import { GSC_MIN_GROUP_IMPRESSIONS, gscSliceComparison } from "../scripts/lib/organic-report.mjs";

const gsc = (start, end, rows) => ({
	meta: { window_start: start, window_end: end, sha256: "x".repeat(64) },
	pages: rows.map(([path, clicks, impressions, position]) => ({ path, clicks, impressions, position })),
});
const S = ["/s1/", "/s2/"];
const C = ["/c1/", "/c2/"];
const rowsFor = (imp) => [["/s1/", 1, imp, 6], ["/s2/", 0, imp, 7], ["/c1/", 1, imp, 6], ["/c2/", 0, imp, 7]];

test("search comparison needs equal, non-overlapping windows around the change date and enough impressions", () => {
	const ok = gscSliceComparison({ before: gsc("2026-09-01", "2026-09-28", rowsFor(80)), after: gsc("2026-10-25", "2026-11-21", rowsFor(90)), slicePages: S, controlPages: C, changeDate: "2026-10-22" });
	assert.equal(ok.verdict, "COMPARABLE_NOT_CAUSAL");
	assert.equal(ok.groups.slice.before.impressions, 160);
	assert.ok(GSC_MIN_GROUP_IMPRESSIONS <= 160);
	const small = gscSliceComparison({ before: gsc("2026-09-01", "2026-09-28", rowsFor(10)), after: gsc("2026-10-25", "2026-11-21", rowsFor(10)), slicePages: S, controlPages: C, changeDate: "2026-10-22" });
	assert.equal(small.verdict, "INSUFFICIENT_DATA");
	const unequal = gscSliceComparison({ before: gsc("2026-09-01", "2026-09-20", rowsFor(80)), after: gsc("2026-10-25", "2026-11-21", rowsFor(80)), slicePages: S, controlPages: C, changeDate: "2026-10-22" });
	assert.ok(unequal.reasons.some((r) => /same length/.test(r)));
	const overlap = gscSliceComparison({ before: gsc("2026-10-01", "2026-10-28", rowsFor(80)), after: gsc("2026-10-25", "2026-11-21", rowsFor(80)), slicePages: S, controlPages: C, changeDate: "2026-10-22" });
	assert.ok(overlap.reasons.some((r) => /overlap/.test(r)));
	const early = gscSliceComparison({ before: gsc("2026-09-01", "2026-09-28", rowsFor(80)), after: gsc("2026-10-10", "2026-11-06", rowsFor(80)), slicePages: S, controlPages: C, changeDate: "2026-10-22" });
	assert.ok(early.reasons.some((r) => /starts before the change date/.test(r)));
	assert.ok(gscSliceComparison({ before: gsc("2026-09-01", "2026-09-28", rowsFor(80)), after: gsc("2026-10-25", "2026-11-21", rowsFor(80)), slicePages: S, controlPages: C }).reasons.some((r) => /change date/.test(r)));
});

test("pages without a Search Console row are UNKNOWN by count, never zero", () => {
	const r = gscSliceComparison({ before: gsc("2026-09-01", "2026-09-28", [["/s1/", 1, 200, 6], ["/c1/", 1, 200, 6]]), after: gsc("2026-10-25", "2026-11-21", [["/s1/", 1, 200, 6], ["/c1/", 1, 200, 6]]), slicePages: S, controlPages: C, changeDate: "2026-10-22" });
	assert.equal(r.groups.slice.before.pages_without_rows_unknown, 1);
	assert.equal(r.groups.slice.before.pages_with_rows, 1);
	assert.equal(r.verdict, "COMPARABLE_NOT_CAUSAL");
	assert.match(r.note, /not proof of cause/);
});

test("search comparison: a group with no rows is UNKNOWN, an impossible change date is rejected", () => {
	const none = gscSliceComparison({ before: gsc("2026-09-01", "2026-09-28", [["/c1/", 1, 200, 6]]), after: gsc("2026-10-25", "2026-11-21", [["/c1/", 1, 200, 6]]), slicePages: S, controlPages: C, changeDate: "2026-10-22" });
	assert.equal(none.verdict, "INSUFFICIENT_DATA");
	assert.equal(none.groups.slice.before.impressions, "UNKNOWN");
	assert.equal(none.groups.slice.before.clicks, "UNKNOWN");
	assert.equal(none.impressions_ratio_after_over_before.slice, "UNKNOWN");
	assert.ok(none.reasons.some((r) => /no Search Console rows/.test(r)));
	assert.ok(gscSliceComparison({ before: gsc("2026-09-01", "2026-09-28", rowsFor(80)), after: gsc("2026-10-25", "2026-11-21", rowsFor(80)), slicePages: S, controlPages: C, changeDate: "2026-02-30" }).reasons.some((r) => /change date/.test(r)));
});
