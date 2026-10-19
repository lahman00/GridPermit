// Organic measurement report. Pure functions over (a) two built-site snapshots
// (scripts/organic-engine-qa.mjs) for the structural link graph, which is real
// and always measurable, and (b) optional PRIVATE aggregate exports from the
// already-authorized analytics sources for behaviour. A metric that was not
// exported is UNKNOWN, never 0. Funnel stages are reported separately and are
// never combined or used to infer leads, installs, commission or cash.

export const UNKNOWN = "UNKNOWN";
export const MIN_ENTRANCES_FOR_COMPARISON = 100;

// Funnel stages and the metrics that belong to each. Only metrics that the
// existing analytics instrumentation can actually record are listed.
export const STAGES = Object.freeze({
	ORGANIC_SESSION: ["organic_entrances", "engaged_sessions", "page_views"],
	INTERNAL_NAVIGATION: ["internal_resource_clicked", "permit_guide_clicked"],
	PARTNER_OUTBOUND: ["cpl_cta_clicked", "affiliate_cta_clicked", "external_partner_clicked"],
});
export const NOT_INFERRED = Object.freeze(["qualified_leads", "installs", "commission", "cash"]);

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

// Link-graph metrics from a snapshot: how many distinct pages link to each
// target, split by page type. Pure and deterministic.
export function structuralMetrics(snapshot, targets) {
	const out = {};
	for (const t of targets) out[t] = { inbound_pages: 0, from_location_pages: 0, from_utility_hubs: 0, from_articles: 0 };
	for (const [path, facts] of Object.entries(snapshot.pages)) {
		for (const t of targets) {
			if (path === t || !facts.internal_links.includes(t)) continue;
			const m = out[t];
			m.inbound_pages++;
			if (/\/solar-permit-guide\/$/.test(path)) m.from_location_pages++;
			else if (/^\/[a-z-]+\/utility\//.test(path)) m.from_utility_hubs++;
			else if (path.startsWith("/blog/")) m.from_articles++;
		}
	}
	return out;
}

export function compareStructural(base, head, targets) {
	const b = structuralMetrics(base, targets);
	const h = structuralMetrics(head, targets);
	return targets.map((t) => ({
		target: t,
		before: b[t],
		after: h[t],
		delta_inbound_pages: h[t].inbound_pages - b[t].inbound_pages,
		delta_from_location_pages: h[t].from_location_pages - b[t].from_location_pages,
	}));
}

// Sum a metric over a page set. Any page missing the metric (absent or null)
// makes the whole sum UNKNOWN and names the pages, so a gap is never
// silently counted as zero.
export function sumMetric(period, pages, metric) {
	let total = 0;
	const missing = [];
	for (const p of pages) {
		const v = period?.pages?.[p]?.[metric];
		if (isNum(v)) total += v;
		else missing.push(p);
	}
	return missing.length ? { value: UNKNOWN, missing_pages: missing } : { value: total, missing_pages: [] };
}

export function rate(numerator, denominator) {
	if (numerator.value === UNKNOWN || denominator.value === UNKNOWN) return UNKNOWN;
	if (denominator.value === 0) return UNKNOWN;
	return numerator.value / denominator.value;
}

function periodBlock(period, pages) {
	const metrics = {};
	for (const [stage, names] of Object.entries(STAGES)) {
		metrics[stage] = {};
		for (const m of names) metrics[stage][m] = sumMetric(period, pages, m);
	}
	const entrances = metrics.ORGANIC_SESSION.organic_entrances;
	const rates = {
		internal_resource_clicks_per_entrance: rate(metrics.INTERNAL_NAVIGATION.internal_resource_clicked, entrances),
		partner_outbound_clicks_per_entrance: rate(sumCombined(metrics.PARTNER_OUTBOUND), entrances),
	};
	return { range: period?.range ?? UNKNOWN, source: period?.source ?? UNKNOWN, metrics, rates };
}

function sumCombined(stageMetrics) {
	const vals = Object.values(stageMetrics);
	if (vals.some((v) => v.value === UNKNOWN)) return { value: UNKNOWN, missing_pages: [] };
	return { value: vals.reduce((s, v) => s + v.value, 0), missing_pages: [] };
}

// Behaviour comparison for the slice against its control pages. Returns
// verdict "INSUFFICIENT_DATA" unless both periods have known, large-enough
// entrances for both groups: a hypothesis is never reported as a result.
export function behaviourReport({ before, after, slicePages, controlPages }) {
	const groups = {};
	let sufficient = true;
	const reasons = [];
	for (const [name, pages] of [["slice", slicePages], ["control", controlPages]]) {
		groups[name] = { pages: pages.length, before: periodBlock(before, pages), after: periodBlock(after, pages) };
		for (const when of ["before", "after"]) {
			const e = groups[name][when].metrics.ORGANIC_SESSION.organic_entrances.value;
			if (e === UNKNOWN) {
				sufficient = false;
				reasons.push(`${name} ${when}: organic entrances UNKNOWN`);
			} else if (e < MIN_ENTRANCES_FOR_COMPARISON) {
				sufficient = false;
				reasons.push(`${name} ${when}: ${e} entrances (< ${MIN_ENTRANCES_FOR_COMPARISON})`);
			}
		}
	}
	return {
		verdict: sufficient ? "COMPARABLE_NOT_CAUSAL" : "INSUFFICIENT_DATA",
		reasons,
		groups,
		not_inferred: NOT_INFERRED.map((m) => ({ metric: m, value: "NOT_INFERRED_FROM_CLICKS" })),
	};
}

const fmt = (v) => (v === UNKNOWN ? "UNKNOWN" : typeof v === "number" && !Number.isInteger(v) ? v.toFixed(4) : String(v));

export function renderReportMarkdown(report) {
	const L = [`# GridPermit organic engine report`, "", `Generated for ${report.generated_for}. Real values only: UNKNOWN means not exported, never zero.`, ""];
	L.push("## Link graph (built site, measured now)", "", "| Target | Pages linking before | after | From location guides before → after |", "|---|---|---|---|");
	for (const r of report.structural) L.push(`| ${r.target} | ${r.before.inbound_pages} | ${r.after.inbound_pages} | ${r.before.from_location_pages} → ${r.after.from_location_pages} |`);
	L.push("");
	if (!report.behaviour) {
		L.push("## Behaviour", "", "No analytics export was supplied, so every behavioural metric is UNKNOWN. Nothing is estimated.", "");
	} else {
		L.push("## Behaviour", "", `Verdict: **${report.behaviour.verdict}**.`, "");
		for (const r of report.behaviour.reasons) L.push(`- ${r}`);
		for (const [name, g] of Object.entries(report.behaviour.groups)) {
			L.push("", `### ${name} (${g.pages} pages)`, "", "| Stage / metric | before | after |", "|---|---|---|");
			for (const [stage, ms] of Object.entries(g.before.metrics)) {
				for (const m of Object.keys(ms)) L.push(`| ${stage} / ${m} | ${fmt(ms[m].value)} | ${fmt(g.after.metrics[stage][m].value)} |`);
			}
			for (const k of Object.keys(g.before.rates)) L.push(`| rate / ${k} | ${fmt(g.before.rates[k])} | ${fmt(g.after.rates[k])} |`);
		}
		L.push("", `Not inferred from clicks: ${NOT_INFERRED.join(", ")}.`, "");
	}
	L.push("## Reading this report", "", "Any difference is a hypothesis, not proof of cause: the slice and control pages differ, seasonality and search demand move independently, and page rows are a separate dimension that must not be summed to property totals.", "");
	return L.join("\n");
}
