// Search Opportunity Engine. Pure functions over an authenticated Google
// Search Console API export (page, query x page and country x page rows).
//
// Evidence rules (documented, not arbitrary scores):
//  - Only exports with evidence_type authenticated_google_search_analytics_api
//    and data_state "final" are accepted; anything else is rejected, not guessed.
//  - "Weak CTR" is never judged against an outside benchmark. A page is compared
//    with this site's own pooled CTR in the same position bucket (leave-one-out),
//    and the exact binomial probability of seeing as few clicks is reported. With
//    28-day volumes this small, most zero-click pages are WITHIN_NOISE and say so.
//  - Thresholds below are operating choices for triage, labelled as such; they are
//    not claims about Google's behaviour.
//  - Query text is privacy-thresholded by Google. A query is never joined to a page
//    it was not exported with, and absent data is UNKNOWN, never zero.
//  - Output is hypothesis-grade guidance for a human or a downstream gated skill;
//    nothing here edits a page.

import { createHash } from "node:crypto";
import { queryIntentHypothesis } from "./partner-measurement.mjs";

export const SITE_ORIGIN = "https://mygridpermit.com";
export const MIN_IMPRESSIONS = 20; // operating floor for a per-page judgement
export const MIN_BASELINE_IMPRESSIONS = 200; // pooled bucket must have at least this much to compare against
export const SIGNIFICANCE = 0.1; // P(clicks <= observed | pooled CTR) at or below this = underperforming
export const LOW_INBOUND_PAGES = 3; // "few" internal links pointing at a page (operating choice)
export const BUCKETS = Object.freeze([
	{ id: "1-3", below: 4 },
	{ id: "4-6", below: 7 },
	{ id: "7-10", below: 11 },
	{ id: "11-20", below: 21 },
	{ id: "21+", below: Infinity },
]);

export function sha256Text(text) {
	return createHash("sha256").update(text).digest("hex");
}

const isIsoDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
const num = (v) => typeof v === "number" && Number.isFinite(v);

function normalizeRows(block, keyCount, label) {
	const rows = block?.rows;
	if (!Array.isArray(rows)) throw new Error(`GSC export missing ${label}.rows`);
	return rows.map((r, i) => {
		if (!Array.isArray(r.keys) || r.keys.length !== keyCount || !num(r.clicks) || !num(r.impressions) || !num(r.position)) {
			throw new Error(`GSC export ${label} row ${i} has an invalid shape`);
		}
		if (r.clicks < 0 || r.impressions < 0 || r.clicks > r.impressions) throw new Error(`GSC export ${label} row ${i} has impossible counts`);
		return { keys: r.keys, clicks: r.clicks, impressions: r.impressions, position: r.position };
	});
}

// Accepts the raw JSON text so the content hash recorded as provenance is the
// hash of the exact bytes analysed.
export function parseGscExport(jsonText) {
	const raw = JSON.parse(jsonText);
	if (raw.evidence_type !== "authenticated_google_search_analytics_api") throw new Error("GSC export is not authenticated Search Analytics API evidence");
	if (raw.data_state !== "final") throw new Error("GSC export is not final data");
	if (raw.search_type !== "web") throw new Error("GSC export is not web search");
	if (!isIsoDate(raw.window_start) || !isIsoDate(raw.window_end) || raw.window_start > raw.window_end) throw new Error("GSC export window is invalid");
	if (typeof raw.property !== "string" || !raw.property.startsWith(SITE_ORIGIN)) throw new Error("GSC export property is not mygridpermit.com");
	const strip = (u) => u.replace(SITE_ORIGIN, "");
	return {
		meta: {
			property: raw.property,
			window_start: raw.window_start,
			window_end: raw.window_end,
			queried_at_utc: raw.queried_at_utc ?? "UNKNOWN",
			data_state: raw.data_state,
			evidence_type: raw.evidence_type,
			sha256: sha256Text(jsonText),
			privacy_note: raw.privacy_note ?? "Search Console may omit low-volume query rows.",
		},
		pages: normalizeRows(raw.page, 1, "page").map((r) => ({ path: strip(r.keys[0]), ...omitKeys(r) })),
		queryPages: normalizeRows(raw.query_page, 2, "query_page").map((r) => ({ query: r.keys[0], path: strip(r.keys[1]), ...omitKeys(r) })),
		countryPages: normalizeRows(raw.country_page, 2, "country_page").map((r) => ({ country: r.keys[0], path: strip(r.keys[1]), ...omitKeys(r) })),
	};
}

function omitKeys({ clicks, impressions, position }) {
	return { clicks, impressions, position };
}

export function pageFamily(path) {
	const parts = path.split("/").filter(Boolean);
	if (parts.length === 0) return { family: "home", state: null, city: null };
	if (parts[0] === "blog") return { family: parts.length === 1 ? "blog_index" : "blog", state: null, city: null, slug: parts[1] ?? null };
	if (parts.length === 3 && parts[2] === "solar-permit-guide") return { family: "locality", state: parts[0], city: parts[1] };
	if (parts.length === 3 && parts[1] === "utility") return { family: "utility_hub", state: parts[0], city: null, slug: parts[2] };
	if (parts.length === 3 && parts[1] === "county") return { family: "county_hub", state: parts[0], city: null, slug: parts[2] };
	if (parts.length === 1) return { family: "state_or_static", state: null, city: null, slug: parts[0] };
	return { family: "other", state: null, city: null };
}

export function positionBucket(position) {
	// Exclusive upper bounds: a fractional average such as 6.9996 belongs to the
	// bucket it is below, never to a gap between buckets.
	return BUCKETS.find((b) => position < b.below)?.id ?? "21+";
}

export function pooledCtrByBucket(pages) {
	const out = Object.fromEntries(BUCKETS.map((b) => [b.id, { clicks: 0, impressions: 0 }]));
	for (const p of pages) {
		const b = out[positionBucket(p.position)];
		b.clicks += p.clicks;
		b.impressions += p.impressions;
	}
	for (const b of Object.values(out)) b.ctr = b.impressions > 0 ? b.clicks / b.impressions : "UNKNOWN";
	return out;
}

// P(X <= k) for X ~ Binomial(n, p), computed in log space so n of a few
// thousand cannot underflow.
export function binomialCdf(k, n, p) {
	if (k >= n) return 1;
	if (p <= 0) return 1;
	if (p >= 1) return k >= n ? 1 : 0;
	const lp = Math.log(p);
	const lq = Math.log(1 - p);
	let logC = 0; // log C(n, 0)
	let total = 0;
	for (let i = 0; i <= k; i++) {
		if (i > 0) logC += Math.log(n - i + 1) - Math.log(i);
		total += Math.exp(logC + i * lp + (n - i) * lq);
	}
	return Math.min(1, total);
}

export function classifyPage(page, pooled) {
	const bucket = positionBucket(page.position);
	const evidence = { impressions: page.impressions, clicks: page.clicks, position: Number(page.position.toFixed(2)), bucket };
	if (page.impressions < MIN_IMPRESSIONS) return { status: "LOW_VOLUME", evidence };
	if (page.position > 20) return { status: "NOT_ACTIONABLE_POSITION", evidence, note: "Average position is beyond page two; a snippet or copy change is not the constraint." };
	if (page.position >= 11) return { status: "NEAR_PAGE_ONE", evidence, note: "Improve the existing page's relevance and links; do not replace it." };
	const b = pooled[bucket];
	const otherImp = b.impressions - page.impressions;
	const otherClicks = b.clicks - page.clicks;
	if (otherImp < MIN_BASELINE_IMPRESSIONS) return { status: "INSUFFICIENT_BASELINE", evidence };
	const baseCtr = otherClicks / otherImp;
	const expected = page.impressions * baseCtr;
	const pLow = binomialCdf(page.clicks, page.impressions, baseCtr);
	const base = { ...evidence, baseline_ctr: baseCtr, expected_clicks: Number(expected.toFixed(2)), probability_of_this_few_clicks: Number(pLow.toFixed(4)) };
	return pLow <= SIGNIFICANCE
		? { status: "SNIPPET_UNDERPERFORMING_VS_SITE_BASELINE", evidence: base, note: "Fewer clicks than this site's own pooled CTR at the same position. Snippet or intent mismatch is a hypothesis to test, not a finding." }
		: { status: "WITHIN_NOISE", evidence: base, note: "Consistent with this site's own pooled CTR; zero clicks here is not evidence of a problem." };
}

const SERVICE_INTENTS = new Set(["PERMIT_ENGINEERING", "LOCAL_INSTALLER", "NEW_SOLAR", "PTO_RESCUE"]);

export function templateQuery(query, citySlug) {
	const q = String(query).toLowerCase().replace(/\s+/g, " ").trim();
	if (!citySlug) return q;
	const name = citySlug.replace(/-/g, " ");
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return q.replace(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`), "$1{city}").trim();
}

// Cluster exported query rows by a city-agnostic template, so a recurring
// intent across many cities is visible even when each city has a handful.
export function queryClusters(queryPages) {
	const map = new Map();
	for (const r of queryPages) {
		const { city, family } = pageFamily(r.path);
		const template = templateQuery(r.query, family === "locality" ? city : null);
		const intent = queryIntentHypothesis(r.query);
		const c = map.get(template) ?? { template, intent, impressions: 0, clicks: 0, pages: new Set(), positions: [] };
		c.impressions += r.impressions;
		c.clicks += r.clicks;
		c.pages.add(r.path);
		c.positions.push({ w: r.impressions, p: r.position });
		map.set(template, c);
	}
	return [...map.values()]
		.map((c) => {
			const w = c.positions.reduce((s, x) => s + x.w, 0);
			return {
				template: c.template,
				intent: c.intent,
				impressions: c.impressions,
				clicks: c.clicks,
				pages: c.pages.size,
				weighted_position: w ? Number((c.positions.reduce((s, x) => s + x.w * x.p, 0) / w).toFixed(1)) : "UNKNOWN",
				example_pages: [...c.pages].sort().slice(0, 3),
			};
		})
		.sort((a, b) => b.impressions - a.impressions || a.template.localeCompare(b.template));
}

export function intentMismatches(queryPages) {
	const out = [];
	for (const r of queryPages) {
		const f = pageFamily(r.path);
		const intent = queryIntentHypothesis(r.query);
		if (f.family === "locality" && SERVICE_INTENTS.has(intent) && intent !== "PTO_RESCUE") {
			out.push({ query: r.query, path: r.path, intent, impressions: r.impressions, clicks: r.clicks, position: Number(r.position.toFixed(1)), label: "HYPOTHESIS" });
		}
	}
	return out.sort((a, b) => b.impressions - a.impressions || a.query.localeCompare(b.query));
}

// `context` = { inboundByPath: {path: {inbound_pages}}|null, lockedPaths: Set, paidPaths: Set }
// lockedPaths are pages inside an observation window or an experiment: they are
// reported but never recommended for edits.
export function analyzeSearch(parsed, context = {}) {
	const { inboundByPath = null, lockedPaths = new Set(), paidPaths = new Set() } = context;
	const pooled = pooledCtrByBucket(parsed.pages.filter((p) => p.impressions > 0));
	const queryByPath = new Map();
	for (const q of parsed.queryPages) (queryByPath.get(q.path) ?? queryByPath.set(q.path, []).get(q.path)).push(q);
	const pages = parsed.pages.map((p) => {
		const fam = pageFamily(p.path);
		const cls = classifyPage(p, pooled);
		const inbound = inboundByPath?.[p.path]?.inbound_pages;
		const lowInbound = inbound === undefined ? "UNKNOWN" : inbound <= LOW_INBOUND_PAGES;
		return {
			path: p.path,
			family: fam.family,
			clicks: p.clicks,
			impressions: p.impressions,
			position: Number(p.position.toFixed(2)),
			ctr: p.impressions ? p.clicks / p.impressions : "UNKNOWN",
			classification: cls.status,
			evidence: cls.evidence,
			note: cls.note ?? null,
			locked: lockedPaths.has(p.path),
			paid_route: paidPaths.has(p.path),
			inbound_pages: inbound ?? "UNKNOWN",
			internal_link_opportunity: p.impressions >= MIN_IMPRESSIONS && p.position <= 20 && lowInbound === true,
			exported_queries: (queryByPath.get(p.path) ?? []).length,
		};
	});
	const actionable = pages
		.filter((p) => !p.locked && ["SNIPPET_UNDERPERFORMING_VS_SITE_BASELINE", "NEAR_PAGE_ONE"].includes(p.classification))
		.sort((a, b) => b.impressions - a.impressions || a.path.localeCompare(b.path));
	const topNoise = pages
		.filter((p) => p.classification === "WITHIN_NOISE" && p.clicks === 0)
		.sort((a, b) => b.impressions - a.impressions || a.path.localeCompare(b.path));
	const byClass = {};
	for (const p of pages) byClass[p.classification] = (byClass[p.classification] ?? 0) + 1;
	const familyTotals = {};
	for (const p of pages) {
		const f = (familyTotals[p.family] ??= { pages: 0, clicks: 0, impressions: 0 });
		f.pages++;
		f.clicks += p.clicks;
		f.impressions += p.impressions;
	}
	return {
		meta: parsed.meta,
		limitations: [
			"Page rows are a separate Search Console dimension. They are not summed to a property total and are not additive with query or country rows.",
			"Query rows are privacy-thresholded and cover only a small share of impressions; a missing query is UNKNOWN, not zero.",
			"Position is an impression-weighted average, so a page-level position can mix very different queries.",
			"One 28-day window is not a trend. Overlapping windows are not independent samples.",
		],
		position_buckets: pooled,
		family_totals: familyTotals,
		classification_counts: byClass,
		pages,
		actionable,
		within_noise_zero_click: topNoise.slice(0, 15),
		query_clusters: queryClusters(parsed.queryPages),
		intent_mismatch_hypotheses: intentMismatches(parsed.queryPages),
		internal_link_opportunities: pages.filter((p) => p.internal_link_opportunity && !p.locked).sort((a, b) => b.impressions - a.impressions || a.path.localeCompare(b.path)),
	};
}
