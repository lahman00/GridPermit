// End to end on SYNTHETIC fixtures (tests/fixtures/growth-e2e, invented numbers):
// GA4 CSV -> converter -> parseGa4Export -> buildFunnel with an outbound export
// and partner rows. Asserts the evidence semantics, not any real metric.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { convertGa4Csv } from "../scripts/ga4-report-to-export.mjs";
import { buildFunnel, parseGa4Export } from "../scripts/lib/growth-funnel.mjs";
import { analyzeSearch, parseGscExport } from "../scripts/lib/search-opportunities.mjs";

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/growth-e2e");
const text = (f) => readFileSync(path.join(FIX, f), "utf8");
const json = (f) => JSON.parse(text(f));
const NOW = "2026-10-21T12:00:00.000Z";
const A = "/california/synthetic-city-a/solar-permit-guide/";
const B = "/california/synthetic-city-b/solar-permit-guide/";
const BLOG = "/blog/synthetic-article/";
const D = "/california/synthetic-city-d/solar-permit-guide/"; // in GSC only
const gscRow = (p, clicks, impressions) => ({ keys: [`https://mygridpermit.com${p}`], clicks, impressions, position: 7 });
const search = analyzeSearch(
	parseGscExport(
		JSON.stringify({
			evidence_type: "authenticated_google_search_analytics_api",
			property: "https://mygridpermit.com/",
			data_state: "final",
			search_type: "web",
			window_start: "2026-09-21",
			window_end: "2026-10-18",
			page: { rows: [gscRow(A, 9, 300), gscRow(B, 1, 80), gscRow(D, 0, 50)] },
			query_page: { rows: [] },
			country_page: { rows: [] },
		}),
	),
);

function pipeline(extra = {}) {
	const converted = convertGa4Csv({
		sessionsCsv: text("ga4-sessions.synthetic.csv"),
		eventsCsv: text("ga4-events.synthetic.csv"),
		mapping: json("ga4-mapping.synthetic.json"),
		propertyId: "100000001",
		windowStart: "2026-09-21",
		windowEnd: "2026-10-18",
	});
	const ga4 = parseGa4Export(JSON.stringify(converted.export));
	const funnel = buildFunnel({ search, ga4, outboundExport: json("outbound-export.synthetic.json"), partnerRows: json("partner-report.synthetic.json"), paidPaths: new Set([A, B]), topicFor: (p) => (p === BLOG ? "article:blog" : "locality:synthetic"), now: NOW, ...extra });
	return { converted, ga4, funnel, page: (p) => funnel.pages.find((x) => x.path === p) };
}

test("converter summary reflects the synthetic CSVs (duplicate, (not set), automatic events)", () => {
	const { converted } = pipeline();
	assert.equal(converted.summary.duplicate_rows_suppressed, 1);
	assert.equal(converted.summary.rows_with_not_set_landing_page_excluded, 1);
	assert.deepEqual(converted.summary.events_dropped_outside_closed_list, ["page_view", "session_start"]);
	assert.deepEqual(converted.export.events_included, ["cpl_cta_clicked", "internal_resource_clicked"]);
});

test("OBSERVED: entrances, engagement and events come from the converted GA4 export", () => {
	const { page } = pipeline();
	const a = page(A).stages;
	assert.equal(a.ORGANIC_ENTRANCE.status, "OBSERVED");
	assert.equal(a.ORGANIC_ENTRANCE.value, 115); // 100 + 10 + 5 across channels
	assert.equal(a.ENGAGEMENT.value, 68);
	assert.equal(a.INTERNAL_NAVIGATION.value.internal_resource_clicked, 13);
	assert.equal(page(B).stages.ORGANIC_ENTRANCE.value, 40); // the exact duplicate row was suppressed, not doubled
	assert.equal(page(BLOG).stages.ORGANIC_ENTRANCE.value, 25);
});

test("UNKNOWN: events the report did not include are never zero; absent pages are not zero", () => {
	const { page } = pipeline();
	// permit_guide_clicked was not in the events report -> UNKNOWN, not 0.
	assert.equal(page(A).stages.INTERNAL_NAVIGATION.value.permit_guide_clicked, "UNKNOWN");
	const cta = page(A).stages.CTA_ENGAGEMENT.value;
	assert.equal(cta.cpl_cta_clicked, 7);
	assert.equal(cta.cpl_cta_viewed, "UNKNOWN");
	assert.equal(cta.affiliate_cta_clicked, "UNKNOWN");
	// An included event with no row for a page is a zero only because GA4 omits zero rows (documented assumption).
	assert.equal(page(B).stages.CTA_ENGAGEMENT.value.cpl_cta_clicked, 0);
	// D is only in GSC: every GA4 stage is UNKNOWN with a null value.
	const d = page(D).stages;
	assert.equal(d.SEARCH_VISIBILITY.status, "OBSERVED");
	for (const k of ["ORGANIC_ENTRANCE", "ENGAGEMENT", "INTERNAL_NAVIGATION"]) {
		assert.equal(d[k].status, "UNKNOWN", k);
		assert.equal(d[k].value, null, k);
	}
});

test("a page without a paid route has NOT_APPLICABLE money stages", () => {
	const { page } = pipeline();
	for (const k of ["CTA_ENGAGEMENT", "OUTBOUND_RECORDED", "PARTNER_REPORTED"]) assert.equal(page(BLOG).stages[k].status, "NOT_APPLICABLE", k);
});

test("recorded outbounds are not clicks, leads or revenue; partner stages stay separate", () => {
	const { page, funnel } = pipeline();
	const a = page(A).stages;
	assert.equal(a.OUTBOUND_RECORDED.value, 2);
	assert.match(a.OUTBOUND_RECORDED.limitation, /not proof of a human click, a lead or revenue/);
	// 7 GA4 CTA clicks vs 2 recorded outbounds: neither is turned into the other, neither into a lead.
	assert.equal(a.CTA_ENGAGEMENT.value.cpl_cta_clicked, 7);
	assert.deepEqual(a.PARTNER_REPORTED.value, { REFERRAL: 2, QUALIFIED: 1, REVERSED: 0, FUNDED: 0, approved_cents: 7000, payable_cents: 0, paid_cents: 0 });
	// QUALIFIED is historical-and-active only for the one CID the partner qualified; a referral is not a qualification.
	assert.equal(funnel.lead_states.historical_qualified, 1);
	assert.equal(funnel.lead_states.currently_active_qualified, 1);
	// B has a recorded outbound but no partner row: UNKNOWN unless the report is asserted complete.
	assert.equal(page(B).stages.OUTBOUND_RECORDED.value, 1);
	assert.equal(page(B).stages.PARTNER_REPORTED.status, "UNKNOWN");
	assert.equal(page(B).stages.PARTNER_REPORTED.value, null);
	// The partner row with an unmatched CID is not placed on any page.
	const totalReferrals = funnel.pages.reduce((n, p) => n + (p.stages.PARTNER_REPORTED.value?.REFERRAL ?? 0), 0);
	assert.equal(totalReferrals, 2);
});

test("commission cents are never summed across stages and no payable/paid is invented from approval", () => {
	const { page } = pipeline();
	const v = page(A).stages.PARTNER_REPORTED.value;
	assert.equal(v.approved_cents, 7000);
	assert.equal(v.payable_cents, 0);
	assert.equal(v.paid_cents, 0);
	assert.equal(v.funded_cents, undefined);
});

test("asserting the partner report complete turns a page without partner rows into an observed zero", () => {
	const { page } = pipeline({ partnerReportComplete: true });
	assert.equal(page(B).stages.PARTNER_REPORTED.status, "OBSERVED");
	assert.equal(page(B).stages.PARTNER_REPORTED.value.REFERRAL, 0);
});

test("revenue by acquisition channel stays NOT_MEASURED even with every source supplied", () => {
	const { funnel } = pipeline();
	assert.deepEqual(funnel.source_status, { gsc: "SUPPLIED", ga4: "SUPPLIED", outbound_export: "SUPPLIED", partner_report: "SUPPLIED" });
	assert.equal(funnel.revenue_by_acquisition_channel.status, "NOT_MEASURED");
	assert.equal(funnel.revenue_by_acquisition_channel.value, null);
	// Channel rows carry sessions and navigation only; no revenue, outbound or lead field.
	for (const c of Object.values(funnel.by_channel)) {
		assert.deepEqual(Object.keys(c.value).sort(), ["engaged_sessions", "navigation", "sessions"]);
	}
	assert.equal(funnel.by_channel.organic_search.value.sessions, 165);
	assert.equal(funnel.by_channel.linkedin_organic_social.value.sessions, 10);
	assert.equal(funnel.by_channel.direct.value.sessions, 5);
});

test("without a GA4 export the same pipeline reports UNKNOWN, not zeros", () => {
	const funnel = buildFunnel({ search, outboundExport: json("outbound-export.synthetic.json"), partnerRows: json("partner-report.synthetic.json"), paidPaths: new Set([A, B]), now: NOW });
	const a = funnel.pages.find((p) => p.path === A).stages;
	assert.equal(a.ORGANIC_ENTRANCE.status, "UNKNOWN");
	assert.equal(a.CTA_ENGAGEMENT.status, "UNKNOWN");
	assert.equal(funnel.by_channel.all.status, "UNKNOWN");
	assert.equal(funnel.revenue_by_acquisition_channel.status, "NOT_MEASURED");
});
