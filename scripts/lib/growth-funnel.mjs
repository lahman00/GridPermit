// First-party growth funnel by page, topic and acquisition channel.
//
// This module does not collect anything and adds no tracking. It joins the
// evidence that already exists, each stage kept separate and labelled:
//   SEARCH_VISIBILITY    GSC impressions/clicks (authenticated export)
//   ORGANIC_ENTRANCE     GA4 sessions that began on the page (export)
//   ENGAGEMENT           GA4 engaged sessions (export)
//   INTERNAL_NAVIGATION  GA4 internal_resource_clicked / permit_guide_clicked
//   CTA_ENGAGEMENT       GA4 CTA events (rendered, exposed, clicked)
//   OUTBOUND_RECORDED    first-party private outbound store export
//   PARTNER_REPORTED     partner-confirmed referral/qualified/funded/commission
//
// Statuses: OBSERVED (a source was supplied and covers the stage), UNKNOWN (the
// stage is instrumented but no export was supplied), NOT_MEASURED (no
// instrumentation can attribute it), NOT_APPLICABLE. UNKNOWN and NOT_MEASURED
// are never zero, and a click is never a lead, a lead never a commission, and a
// commission never cash.

import { ANALYTICS_EVENTS } from "../../src/lib/analytics-events.ts";
import { aggregateOutbound, currentLeadStates, revenueLedger } from "./live-revenue-ops.mjs";

export const STAGES = Object.freeze([
	"SEARCH_VISIBILITY",
	"ORGANIC_ENTRANCE",
	"ENGAGEMENT",
	"INTERNAL_NAVIGATION",
	"CTA_ENGAGEMENT",
	"OUTBOUND_RECORDED",
	"PARTNER_REPORTED",
]);

export const NAVIGATION_EVENTS = Object.freeze(["internal_resource_clicked", "permit_guide_clicked"]);
export const CTA_EVENTS = Object.freeze(["affiliate_cta_viewed", "affiliate_cta_clicked", "cpl_cta_viewed", "cpl_cta_exposed", "cpl_cta_clicked", "pay_per_call_cta_viewed", "pay_per_call_clicked"]);
export const MONEY_STAGES = Object.freeze(["COMMISSION_APPROVED", "COMMISSION_PAYABLE", "COMMISSION_PAID"]);
const isIso = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
const isCount = (v) => Number.isSafeInteger(v) && v >= 0;

export const OBSERVED = (value, source, window, limitation) => ({ status: "OBSERVED", value, source, window, limitation });
export const UNKNOWN = (source, reason) => ({ status: "UNKNOWN", value: null, source, reason });
export const NOT_MEASURED = (reason) => ({ status: "NOT_MEASURED", value: null, reason });

export function channelFor(source, medium) {
	const s = String(source ?? "").toLowerCase();
	const m = String(medium ?? "").toLowerCase();
	if (m === "organic") return "organic_search";
	if (m === "organic_social" && (s === "linkedin" || s === "x")) return `${s}_organic_social`;
	if (s === "(direct)" && (m === "(none)" || m === "")) return "direct";
	return "other";
}

// Normalized GA4 export: the operator maps a GA4 "landing page x source/medium"
// report into this exact shape. Unknown columns or event names are rejected so
// nothing personal or ad-hoc enters the pipeline.
export function parseGa4Export(jsonText) {
	const raw = JSON.parse(jsonText);
	if (raw.evidence_type !== "ga4_report_export") throw new Error("GA4 export must declare evidence_type ga4_report_export");
	if (typeof raw.property_id !== "string" || !raw.property_id) throw new Error("GA4 export needs the GridPermit property_id");
	if (!isIso(raw.window_start) || !isIso(raw.window_end) || raw.window_start > raw.window_end) throw new Error("GA4 export window is invalid");
	if (!Array.isArray(raw.rows)) throw new Error("GA4 export rows missing");
	const events = new Set(ANALYTICS_EVENTS);
	// The export must say which events its report actually contains. An event the
	// report did not include is UNKNOWN downstream, never a silent zero.
	if (!Array.isArray(raw.events_included) || raw.events_included.some((e) => !events.has(e))) throw new Error("GA4 export must list events_included from the closed analytics list");
	const rows = raw.rows.map((r, i) => {
		const allowed = ["landing_page", "source", "medium", "sessions", "engaged_sessions", "events"];
		if (Object.keys(r).some((k) => !allowed.includes(k))) throw new Error(`GA4 row ${i + 1} has an unexpected column`);
		if (!/^\/[a-z0-9\-/]*$/.test(r.landing_page ?? "")) throw new Error(`GA4 row ${i + 1} has an invalid landing_page`);
		if (!isCount(r.sessions) || (r.engaged_sessions !== undefined && (!isCount(r.engaged_sessions) || r.engaged_sessions > r.sessions))) throw new Error(`GA4 row ${i + 1} has invalid counts`);
		for (const [name, count] of Object.entries(r.events ?? {})) {
			if (!events.has(name)) throw new Error(`GA4 row ${i + 1} has an event outside the closed analytics list: ${name}`);
			if (!isCount(count)) throw new Error(`GA4 row ${i + 1} has an invalid count for ${name}`);
		}
		return { path: r.landing_page, channel: channelFor(r.source, r.medium), sessions: r.sessions, engaged_sessions: r.engaged_sessions ?? null, events: r.events ?? {} };
	});
	return { meta: { property_id: raw.property_id, window_start: raw.window_start, window_end: raw.window_end, events_included: [...new Set(raw.events_included)].sort() }, rows };
}

function eventValues(names, bucketEvents, included) {
	return Object.fromEntries(names.map((e) => [e, included.includes(e) ? (bucketEvents[e] ?? 0) : "UNKNOWN"]));
}

const ZERO_PARTNER = { REFERRAL: 0, QUALIFIED: 0, REVERSED: 0, FUNDED: 0, approved_cents: 0, payable_cents: 0, paid_cents: 0 };

// A page with no partner rows is a zero only when the operator asserts the
// report covers the whole window; otherwise it is UNKNOWN. QUALIFIED counts
// historical qualification; REVERSED shows how many were later reversed.
function partnerStage(rows, complete) {
	const src = "operator-supplied partner report";
	const limit = "Only rows whose CID matches a recorded outbound for this page. QUALIFIED is historical; REVERSED counts later reversals. Approved, payable and paid cents are separate and never summed." + (complete ? "" : " The report is not asserted complete, so these counts may be partial.");
	if (rows) return OBSERVED(rows, src, "per report", limit);
	return complete ? OBSERVED({ ...ZERO_PARTNER }, src, "per report", limit) : UNKNOWN(src, "no rows for this page and the report is not asserted complete for the window");
}

function emptyBucket() {
	return { sessions: 0, engaged_sessions: 0, engaged_known: true, events: {} };
}

function addGa4(bucket, row) {
	bucket.sessions += row.sessions;
	if (row.engaged_sessions === null) bucket.engaged_known = false;
	else bucket.engaged_sessions += row.engaged_sessions;
	for (const [k, v] of Object.entries(row.events)) bucket.events[k] = (bucket.events[k] ?? 0) + v;
}

// inputs: { search (analyzeSearch result)|null, ga4|null, outboundExport|null, partnerRows|null,
//           paidPaths:Set, topicFor(path)->string, now }
export function buildFunnel(inputs) {
	const { search = null, ga4 = null, outboundExport = null, partnerRows = null, partnerReportComplete = false, paidPaths = new Set(), topicFor = () => "unclassified", now } = inputs;
	// paidPaths === null means the route manifest was not available: paid-route status is UNKNOWN, not "no paid route".
	const paidKnown = paidPaths !== null;
	const gscSrc = search ? `GSC ${search.meta.window_start}..${search.meta.window_end} (sha256 ${search.meta.sha256.slice(0, 12)})` : null;
	const gscWin = search ? `${search.meta.window_start}..${search.meta.window_end}` : null;
	const ga4Win = ga4 ? `${ga4.meta.window_start}..${ga4.meta.window_end}` : null;
	const ga4Src = ga4 ? `GA4 property ${ga4.meta.property_id}` : null;

	const ga4ByPage = new Map();
	const ga4ByChannel = new Map();
	for (const r of ga4?.rows ?? []) {
		addGa4(ga4ByPage.get(r.path) ?? ga4ByPage.set(r.path, emptyBucket()).get(r.path), r);
		addGa4(ga4ByChannel.get(r.channel) ?? ga4ByChannel.set(r.channel, emptyBucket()).get(r.channel), r);
	}

	const out = outboundExport ? aggregateOutbound(outboundExport, { now }) : null;
	const outboundByPage = new Map();
	const pageByCid = new Map();
	for (const r of out?.rows ?? []) {
		outboundByPage.set(r.page_path, (outboundByPage.get(r.page_path) ?? 0) + 1);
		pageByCid.set(`${r.partner_id}|${r.cid}`, r.page_path);
	}

	const ledger = out && partnerRows ? revenueLedger(out.rows, partnerRows) : null;
	const states = ledger ? currentLeadStates(ledger) : null;
	const partnerByPage = new Map();
	if (ledger) {
		for (const row of ledger) {
			if (row.stage === "OUTBOUND_RECORDED") continue;
			const page = pageByCid.get(`${row.partner_id}|${row.cid}`);
			if (!page) continue; // a partner row with no matching recorded outbound cannot be placed on a page
			const b = partnerByPage.get(page) ?? partnerByPage.set(page, { REFERRAL: 0, QUALIFIED: 0, REVERSED: 0, FUNDED: 0, approved_cents: 0, payable_cents: 0, paid_cents: 0 }).get(page);
			if (row.stage === "PARTNER_REPORTED_REFERRAL") b.REFERRAL++;
			else if (row.stage === "LEAD_REVERSED") b.REVERSED++;
			else if (row.stage === "QUALIFIED_LEAD") b.QUALIFIED++;
			else if (row.stage === "FUNDED_INSTALL") b.FUNDED++;
			else if (row.stage === "COMMISSION_APPROVED") b.approved_cents += row.amount_cents ?? 0;
			else if (row.stage === "COMMISSION_PAYABLE") b.payable_cents += row.amount_cents ?? 0;
			else if (row.stage === "COMMISSION_PAID") b.paid_cents += row.amount_cents ?? 0;
		}
	}

	const paths = new Set([...(search?.pages.map((p) => p.path) ?? []), ...ga4ByPage.keys(), ...outboundByPage.keys()]);
	const pageRows = [...paths].sort().map((path) => {
		const gsc = search?.pages.find((p) => p.path === path);
		const g = ga4ByPage.get(path);
		const paid = paidKnown ? paidPaths.has(path) : null;
		const manifestUnknown = UNKNOWN("outbound route manifest", "manifest not available, so paid-route status is unknown");
		return {
			path,
			topic: topicFor(path),
			paid_route: paid === null ? "UNKNOWN" : paid,
			stages: {
				SEARCH_VISIBILITY: search ? (gsc ? OBSERVED({ impressions: gsc.impressions, clicks: gsc.clicks, position: gsc.position }, gscSrc, gscWin, "Average position; privacy-thresholded queries; page rows are not additive with other dimensions.") : UNKNOWN(gscSrc, "page absent from the export (no impressions row), not proof of zero")) : UNKNOWN("GSC", "no export supplied"),
				ORGANIC_ENTRANCE: ga4 ? (g ? OBSERVED(g.sessions, ga4Src, ga4Win, "Sessions that began on this page, all channels; compare channel rows for organic only.") : UNKNOWN(ga4Src, "page absent from the export")) : UNKNOWN("GA4", "no export supplied"),
				ENGAGEMENT: ga4 ? (g ? (g.engaged_known ? OBSERVED(g.engaged_sessions, ga4Src, ga4Win, "GA4 engaged sessions.") : UNKNOWN(ga4Src, "engaged sessions not exported")) : UNKNOWN(ga4Src, "page absent from the export")) : UNKNOWN("GA4", "no export supplied"),
				INTERNAL_NAVIGATION: ga4 ? (g ? OBSERVED(eventValues(NAVIGATION_EVENTS, g.events, ga4.meta.events_included), ga4Src, ga4Win, "Event counts in sessions that began on this page. An event the report did not include is UNKNOWN, not zero.") : UNKNOWN(ga4Src, "page absent from the export")) : UNKNOWN("GA4", "no export supplied"),
				CTA_ENGAGEMENT: paid === null ? manifestUnknown : paid ? (ga4 ? (g ? OBSERVED(eventValues(CTA_EVENTS, g.events, ga4.meta.events_included), ga4Src, ga4Win, "Event counts in sessions that began on this page. An event the report did not include is UNKNOWN, not zero.") : UNKNOWN(ga4Src, "page absent from the export")) : UNKNOWN("GA4", "no export supplied")) : { status: "NOT_APPLICABLE", value: null, reason: "no paid route on this page in the built manifest" },
				OUTBOUND_RECORDED: paid === null ? manifestUnknown : paid ? (out ? OBSERVED(outboundByPage.get(path) ?? 0, "first-party private outbound export", `retention window ending ${now}`, "Recorded server-side redirects. This is not proof of a human click, a lead or revenue.") : UNKNOWN("first-party outbound export", "no export supplied")) : { status: "NOT_APPLICABLE", value: null, reason: "no paid route on this page in the built manifest" },
				PARTNER_REPORTED: paid === null ? manifestUnknown : paid ? (ledger ? partnerStage(partnerByPage.get(path), partnerReportComplete) : UNKNOWN("partner report", out ? "no partner report supplied" : "needs outbound export and partner report")) : { status: "NOT_APPLICABLE", value: null, reason: "no paid route on this page in the built manifest" },
			},
		};
	});

	const byChannel = ga4
		? Object.fromEntries([...ga4ByChannel].sort(([a], [b]) => a.localeCompare(b)).map(([c, b]) => [c, OBSERVED({ sessions: b.sessions, engaged_sessions: b.engaged_known ? b.engaged_sessions : "UNKNOWN", navigation: eventValues(NAVIGATION_EVENTS, b.events, ga4.meta.events_included) }, ga4Src, ga4Win, "Landing-page sessions grouped by source/medium.")]))
		: { all: UNKNOWN("GA4", "no export supplied") };

	// Topic roll-ups carry their coverage: a total over pages that are missing from
	// a source is PARTIAL, never a complete-looking number, and a source that was not
	// supplied at all is UNKNOWN.
	const byTopic = {};
	const cov = () => ({ value: 0, pages_with_data: 0, pages_without_data: 0 });
	const take = (m, stage, pick) => {
		if (stage.status === "NOT_APPLICABLE") return;
		if (stage.status === "OBSERVED") {
			m.value += pick(stage.value);
			m.pages_with_data++;
		} else m.pages_without_data++;
	};
	const finish = (m) => {
		const status = m.pages_with_data === 0 ? "UNKNOWN" : m.pages_without_data === 0 ? "OBSERVED" : "PARTIAL";
		return { status, value: status === "UNKNOWN" ? null : m.value, pages_with_data: m.pages_with_data, pages_without_data: m.pages_without_data };
	};
	const acc = {};
	for (const r of pageRows) {
		const t = (acc[r.topic] ??= { pages: 0, impressions: cov(), search_clicks: cov(), entrances: cov(), outbound_recorded: cov() });
		t.pages++;
		take(t.impressions, r.stages.SEARCH_VISIBILITY, (v) => v.impressions);
		take(t.search_clicks, r.stages.SEARCH_VISIBILITY, (v) => v.clicks);
		take(t.entrances, r.stages.ORGANIC_ENTRANCE, (v) => v);
		take(t.outbound_recorded, r.stages.OUTBOUND_RECORDED, (v) => v);
	}
	for (const [topic, t] of Object.entries(acc)) {
		byTopic[topic] = { pages: t.pages, impressions: finish(t.impressions), search_clicks: finish(t.search_clicks), entrances: finish(t.entrances), outbound_recorded: finish(t.outbound_recorded) };
	}

	return {
		generated_at: now,
		stage_order: STAGES,
		rules: [
			"UNKNOWN means the stage is instrumented but no export was supplied; NOT_MEASURED means no instrumentation can attribute it. Neither is zero.",
			"A recorded outbound is not a human click, a lead, a commission or cash. Referral, qualified, funded and each commission stage are reported separately.",
			"Commission amounts are summed only within their own stage (approved, payable, paid); they are never added together.",
		],
		source_status: {
			gsc: search ? "SUPPLIED" : "NOT_SUPPLIED",
			ga4: ga4 ? "SUPPLIED" : "NOT_SUPPLIED",
			outbound_export: out ? "SUPPLIED" : "NOT_SUPPLIED",
			partner_report: partnerRows ? "SUPPLIED" : "NOT_SUPPLIED",
		},
		revenue_by_acquisition_channel: NOT_MEASURED("Outbound records carry page, partner, intent and CID but no source/medium, and GA4 sessions share no id with the CID. Commission cannot be attributed to a channel without new instrumentation, which this module does not add."),
		revenue_by_page: partnerRows && out ? "SEE_PAGE_ROWS" : UNKNOWN("operator-supplied partner report + outbound export", "both exports are required to place a partner result on a page"),
		by_channel: byChannel,
		by_topic: byTopic,
		by_topic_note: "Pages appear only if a supplied source lists them. PARTIAL means some listed pages have no data for that metric.",
		pages: pageRows,
		lead_states: states ? { tracked_cids: states.length, historical_qualified: states.filter((s) => s.historical_qualified_event).length, currently_active_qualified: states.filter((s) => s.currently_active_qualified).length } : UNKNOWN("partner report", "no partner report supplied"),
	};
}
