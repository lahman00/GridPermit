// Tests for the first-party growth funnel: UNKNOWN is never zero, stages stay
// separate, and money is never inferred from clicks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { RETENTION_DAYS } from "../src/lib/commercial/outbound-service.mjs";
import { analyzeSearch, parseGscExport } from "../scripts/lib/search-opportunities.mjs";
import { buildFunnel, channelFor, parseGa4Export } from "../scripts/lib/growth-funnel.mjs";

const NOW = "2026-10-21T12:00:00.000Z";
const PAGE = "/california/x/solar-permit-guide/";
const CID = "a".repeat(24);
const search = analyzeSearch(
	parseGscExport(
		JSON.stringify({
			evidence_type: "authenticated_google_search_analytics_api",
			property: "https://mygridpermit.com/",
			data_state: "final",
			search_type: "web",
			window_start: "2026-09-10",
			window_end: "2026-10-08",
			page: { rows: [{ keys: [`https://mygridpermit.com${PAGE}`], clicks: 2, impressions: 40, position: 6 }] },
			query_page: { rows: [] },
			country_page: { rows: [] },
		}),
	),
);
const ga4Text = (over = {}) =>
	JSON.stringify({
		evidence_type: "ga4_report_export",
		property_id: "123",
		window_start: "2026-09-21",
		window_end: "2026-10-18",
		events_included: ["internal_resource_clicked", "cpl_cta_clicked"],
		rows: [
			{ landing_page: PAGE, source: "google", medium: "organic", sessions: 30, engaged_sessions: 18, events: { internal_resource_clicked: 4 } },
			{ landing_page: PAGE, source: "linkedin", medium: "organic_social", sessions: 5, engaged_sessions: 3, events: {} },
		],
		...over,
	});
const outbound = () => ({ stage: "OUTBOUND_RECORDED", retention_days: RETENTION_DAYS, rows: [{ stage: "OUTBOUND_RECORDED", cid: CID, partner_id: "compare-solar-prices", page_path: PAGE, city: "X", intent: "NEW_SOLAR", cta_id: "c", timestamp: "2026-10-20T10:00:00Z" }] });

test("channels are derived only from explicit source/medium", () => {
	assert.equal(channelFor("google", "organic"), "organic_search");
	assert.equal(channelFor("linkedin", "organic_social"), "linkedin_organic_social");
	assert.equal(channelFor("x", "organic_social"), "x_organic_social");
	assert.equal(channelFor("(direct)", "(none)"), "direct");
	assert.equal(channelFor("facebook", "organic_social"), "other");
});

test("GA4 export rejects unknown columns, unknown events and missing events_included", () => {
	assert.doesNotThrow(() => parseGa4Export(ga4Text()));
	assert.throws(() => parseGa4Export(ga4Text({ evidence_type: "csv" })));
	assert.throws(() => parseGa4Export(ga4Text({ events_included: undefined })), /events_included/);
	assert.throws(() => parseGa4Export(ga4Text({ events_included: ["made_up"] })), /events_included/);
	assert.throws(() => parseGa4Export(ga4Text({ rows: [{ landing_page: PAGE, source: "a", medium: "b", sessions: 1, email: "x@y.z" }] })), /unexpected column/);
	assert.throws(() => parseGa4Export(ga4Text({ rows: [{ landing_page: PAGE, source: "a", medium: "b", sessions: 1, events: { made_up: 1 } }] })), /closed analytics list/);
	assert.throws(() => parseGa4Export(ga4Text({ rows: [{ landing_page: PAGE, source: "a", medium: "b", sessions: 2, engaged_sessions: 5 }] })), /invalid counts/);
});

test("with only GSC supplied, every other stage is UNKNOWN or NOT_APPLICABLE, never zero", () => {
	const f = buildFunnel({ search, paidPaths: new Set([PAGE]), now: NOW });
	const s = f.pages[0].stages;
	assert.equal(s.SEARCH_VISIBILITY.status, "OBSERVED");
	for (const k of ["ORGANIC_ENTRANCE", "ENGAGEMENT", "INTERNAL_NAVIGATION", "CTA_ENGAGEMENT", "OUTBOUND_RECORDED", "PARTNER_REPORTED"]) {
		assert.equal(s[k].status, "UNKNOWN", k);
		assert.equal(s[k].value, null, k);
	}
	assert.equal(f.revenue_by_acquisition_channel.status, "NOT_MEASURED");
	assert.equal(f.revenue_by_page.status, "UNKNOWN");
	assert.deepEqual(f.source_status, { gsc: "SUPPLIED", ga4: "NOT_SUPPLIED", outbound_export: "NOT_SUPPLIED", partner_report: "NOT_SUPPLIED" });
	assert.equal(f.by_channel.all.status, "UNKNOWN");
});

test("a page without a paid route is NOT_APPLICABLE for CTA, outbound and partner stages", () => {
	const f = buildFunnel({ search, paidPaths: new Set(), now: NOW });
	for (const k of ["CTA_ENGAGEMENT", "OUTBOUND_RECORDED", "PARTNER_REPORTED"]) assert.equal(f.pages[0].stages[k].status, "NOT_APPLICABLE");
});

test("events the report did not include are UNKNOWN, included zeros are zero", () => {
	const f = buildFunnel({ search, ga4: parseGa4Export(ga4Text()), paidPaths: new Set([PAGE]), now: NOW });
	const nav = f.pages[0].stages.INTERNAL_NAVIGATION.value;
	assert.equal(nav.internal_resource_clicked, 4);
	assert.equal(nav.permit_guide_clicked, "UNKNOWN");
	const cta = f.pages[0].stages.CTA_ENGAGEMENT.value;
	assert.equal(cta.cpl_cta_clicked, 0);
	assert.equal(cta.cpl_cta_viewed, "UNKNOWN");
	assert.equal(f.pages[0].stages.ORGANIC_ENTRANCE.value, 35);
	assert.equal(f.by_channel.organic_search.value.sessions, 30);
	assert.equal(f.by_channel.linkedin_organic_social.value.sessions, 5);
});

test("outbound recorded is not a lead; partner stages join only through a matching recorded CID", () => {
	const partnerRows = [
		{ stage: "PARTNER_REPORTED_REFERRAL", cid: CID, partner_id: "compare-solar-prices", timestamp: "2026-10-20T11:00:00Z", evidence_ref: "report-1" },
		{ stage: "COMMISSION_APPROVED", cid: CID, partner_id: "compare-solar-prices", timestamp: "2026-10-20T12:00:00Z", evidence_ref: "report-2", amount_cents: 5000, currency: "USD" },
		{ stage: "PARTNER_REPORTED_REFERRAL", cid: "b".repeat(24), partner_id: "compare-solar-prices", timestamp: "2026-10-20T11:30:00Z", evidence_ref: "report-3" },
	];
	const f = buildFunnel({ search, outboundExport: outbound(), partnerRows, paidPaths: new Set([PAGE]), now: NOW });
	const s = f.pages[0].stages;
	assert.equal(s.OUTBOUND_RECORDED.value, 1);
	assert.match(s.OUTBOUND_RECORDED.limitation, /not proof of a human click/);
	assert.deepEqual(s.PARTNER_REPORTED.value, { REFERRAL: 1, QUALIFIED: 0, REVERSED: 0, FUNDED: 0, approved_cents: 5000, payable_cents: 0, paid_cents: 0 });
	assert.equal(f.lead_states.currently_active_qualified, 0);
	const noReport = buildFunnel({ search, outboundExport: outbound(), paidPaths: new Set([PAGE]), now: NOW });
	assert.equal(noReport.pages[0].stages.OUTBOUND_RECORDED.value, 1);
	assert.equal(noReport.pages[0].stages.PARTNER_REPORTED.status, "UNKNOWN");
});

test("an outbound export with zero rows is an observed zero of recorded events, not of clicks", () => {
	const empty = { stage: "OUTBOUND_RECORDED", retention_days: RETENTION_DAYS, rows: [] };
	const f = buildFunnel({ search, outboundExport: empty, paidPaths: new Set([PAGE]), now: NOW });
	assert.equal(f.pages[0].stages.OUTBOUND_RECORDED.value, 0);
	assert.match(f.pages[0].stages.OUTBOUND_RECORDED.limitation, /not proof/);
});

test("topic rollups carry coverage: unknown sources are UNKNOWN, gaps are PARTIAL, never a complete-looking total", () => {
	const f = buildFunnel({ search, paidPaths: new Set(), topicFor: () => "locality:SCE", now: NOW });
	const t = f.by_topic["locality:SCE"];
	assert.equal(t.pages, 1);
	assert.deepEqual(t.impressions, { status: "OBSERVED", value: 40, pages_with_data: 1, pages_without_data: 0 });
	assert.equal(t.entrances.status, "UNKNOWN");
	assert.equal(t.entrances.value, null);
	assert.equal(t.outbound_recorded.status, "UNKNOWN");
	// GA4 only: search metrics are UNKNOWN, not 0.
	const ga4Only = buildFunnel({ ga4: parseGa4Export(ga4Text()), paidPaths: new Set(), topicFor: () => "t", now: NOW });
	assert.equal(ga4Only.by_topic.t.impressions.status, "UNKNOWN");
	assert.equal(ga4Only.by_topic.t.impressions.value, null);
	assert.equal(ga4Only.by_topic.t.entrances.value, 35);
	// Two pages, GA4 covers only one: PARTIAL.
	const two = buildFunnel({ search, ga4: parseGa4Export(ga4Text({ rows: [{ landing_page: "/other/", source: "google", medium: "organic", sessions: 7 }] })), paidPaths: new Set(), topicFor: () => "t", now: NOW });
	assert.equal(two.by_topic.t.entrances.status, "PARTIAL");
	assert.equal(two.by_topic.t.entrances.pages_without_data, 1);
	assert.equal(two.by_topic.t.impressions.status, "PARTIAL");
});

test("a missing route manifest makes paid-route status UNKNOWN, not 'no paid route'", () => {
	const f = buildFunnel({ search, paidPaths: null, now: NOW });
	assert.equal(f.pages[0].paid_route, "UNKNOWN");
	for (const k of ["CTA_ENGAGEMENT", "OUTBOUND_RECORDED", "PARTNER_REPORTED"]) assert.equal(f.pages[0].stages[k].status, "UNKNOWN", k);
});

test("a paid page with no partner rows is UNKNOWN unless the report is asserted complete; reversals are visible", () => {
	const rows = [
		{ stage: "QUALIFIED_LEAD", cid: CID, partner_id: "compare-solar-prices", timestamp: "2026-10-20T11:00:00Z", evidence_ref: "r1" },
		{ stage: "LEAD_REVERSED", cid: CID, partner_id: "compare-solar-prices", timestamp: "2026-10-20T12:00:00Z", evidence_ref: "r2" },
	];
	const other = { stage: "OUTBOUND_RECORDED", retention_days: RETENTION_DAYS, rows: [outbound().rows[0], { ...outbound().rows[0], cid: "c".repeat(24), page_path: "/california/y/solar-permit-guide/" }] };
	const sx = analyzeSearch(parseGscExport(JSON.stringify({ evidence_type: "authenticated_google_search_analytics_api", property: "https://mygridpermit.com/", data_state: "final", search_type: "web", window_start: "2026-09-10", window_end: "2026-10-08", page: { rows: [{ keys: [`https://mygridpermit.com${PAGE}`], clicks: 0, impressions: 5, position: 6 }, { keys: ["https://mygridpermit.com/california/y/solar-permit-guide/"], clicks: 0, impressions: 5, position: 6 }] }, query_page: { rows: [] }, country_page: { rows: [] } })));
	const paid = new Set([PAGE, "/california/y/solar-permit-guide/"]);
	const partial = buildFunnel({ search: sx, outboundExport: other, partnerRows: rows, paidPaths: paid, now: NOW });
	const byPath = Object.fromEntries(partial.pages.map((p) => [p.path, p.stages.PARTNER_REPORTED]));
	assert.equal(byPath[PAGE].status, "OBSERVED");
	assert.equal(byPath[PAGE].value.QUALIFIED, 1);
	assert.equal(byPath[PAGE].value.REVERSED, 1);
	assert.match(byPath[PAGE].limitation, /may be partial/);
	assert.equal(byPath["/california/y/solar-permit-guide/"].status, "UNKNOWN");
	const complete = buildFunnel({ search: sx, outboundExport: other, partnerRows: rows, partnerReportComplete: true, paidPaths: paid, now: NOW });
	assert.equal(complete.pages.find((p) => p.path === "/california/y/solar-permit-guide/").stages.PARTNER_REPORTED.value.REFERRAL, 0);
});
