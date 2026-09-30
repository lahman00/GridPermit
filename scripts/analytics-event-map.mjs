// Generates the canonical analytics-event inventory directly from source code,
// so this report can never go stale relative to src/lib/analytics-events.ts
// the way a hand-written report did in a prior session (it said "17 events"
// after the code had already grown to 18).
//
// Usage: node scripts/analytics-event-map.mjs
// Writes output/revenue-intelligence/ANALYTICS_EVENT_MAP.json (and prints a
// short summary to stdout). Read-only against the repo; no network calls.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readEventsSource() {
	const text = readFileSync(path.join(REPO_ROOT, "src/lib/analytics-events.ts"), "utf8");
	const match = text.match(/export const ANALYTICS_EVENTS = \[([\s\S]*?)\] as const;/);
	if (!match) throw new Error("Could not locate ANALYTICS_EVENTS array in src/lib/analytics-events.ts");
	return [...match[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
}

// Manually-curated semantics per event. Deliberately explicit and reviewed by
// a human/agent, not inferred from the event name alone (e.g. "*_clicked"
// does not automatically mean "revenue stage" - cpl_cta_clicked is the one
// CompareSolarPrices-specific click, others are not partner-reportable).
const SEMANTICS = {
	calculator_started: { meaning: "Homeowner began the on-site savings calculator", unique_per_session: false, user_action: true, revenue_stage: "ORGANIC_SESSION", partner_reportable: false },
	calculator_completed: { meaning: "Homeowner completed the on-site savings calculator", unique_per_session: false, user_action: true, revenue_stage: "ORGANIC_SESSION", partner_reportable: false },
	locality_guide_viewed: { meaning: "A California/state locality guide page rendered", unique_per_session: false, user_action: false, revenue_stage: "ORGANIC_SESSION", partner_reportable: false },
	official_source_clicked: { meaning: "Homeowner clicked an outbound citation/source link", unique_per_session: false, user_action: true, revenue_stage: "ORGANIC_SESSION", partner_reportable: false },
	blog_article_viewed: { meaning: "A blog post page rendered", unique_per_session: false, user_action: false, revenue_stage: "ORGANIC_SESSION", partner_reportable: false },
	search_used: { meaning: "Homeowner used the site search box", unique_per_session: false, user_action: true, revenue_stage: "ORGANIC_SESSION", partner_reportable: false },
	permit_guide_clicked: { meaning: "Homeowner clicked into a locality guide from an index/hub page", unique_per_session: false, user_action: true, revenue_stage: "ORGANIC_SESSION", partner_reportable: false },
	external_partner_clicked: { meaning: "Generic outbound partner link click (non-CompareSolarPrices)", unique_per_session: false, user_action: true, revenue_stage: "PARTNER_OUTBOUND", partner_reportable: false },
	faq_expanded: { meaning: "Homeowner opened a FAQ <details> item", unique_per_session: false, user_action: true, revenue_stage: "ORGANIC_SESSION", partner_reportable: false },
	pro_interest_clicked: { meaning: "Homeowner/installer expressed interest in GridPermit Pro", unique_per_session: false, user_action: true, revenue_stage: "ORGANIC_SESSION", partner_reportable: false },
	page_not_found: { meaning: "A 404 page rendered", unique_per_session: false, user_action: false, revenue_stage: null, partner_reportable: false },
	affiliate_cta_viewed: { meaning: "A hardware-affiliate CTA (e.g. LiTime/Renogy) rendered", unique_per_session: false, user_action: false, revenue_stage: "CTA_RENDERED", partner_reportable: false },
	affiliate_cta_clicked: { meaning: "Homeowner clicked a hardware-affiliate CTA", unique_per_session: false, user_action: true, revenue_stage: "PARTNER_OUTBOUND", partner_reportable: false, note: "Dormant/gated partner path, not CompareSolarPrices - see docs/MONETIZATION_CANONICAL_STATE.md" },
	cpl_cta_viewed: { meaning: "The CompareSolarPrices CTA rendered on an eligible page (historical 'render' event)", unique_per_session: false, user_action: false, revenue_stage: "CTA_RENDERED", partner_reportable: false },
	cpl_cta_exposed: { meaning: "The CompareSolarPrices CTA actually entered the viewport (real visibility, not just render)", unique_per_session: false, user_action: false, revenue_stage: "CTA_EXPOSED", partner_reportable: false },
	cpl_cta_clicked: { meaning: "Homeowner clicked the CompareSolarPrices CTA button; carries the fresh non-PII CID", unique_per_session: false, user_action: true, revenue_stage: "CTA_CLICKED", partner_reportable: false, note: "This is a click, NOT a lead. A lead only exists once CompareSolarPrices reports one back against this CID." },
	pay_per_call_cta_viewed: { meaning: "A pay-per-call CTA (e.g. DMM) rendered", unique_per_session: false, user_action: false, revenue_stage: "CTA_RENDERED", partner_reportable: false, note: "Dormant/gated partner path" },
	pay_per_call_clicked: { meaning: "Homeowner clicked a pay-per-call CTA", unique_per_session: false, user_action: true, revenue_stage: "PARTNER_OUTBOUND", partner_reportable: false, note: "Dormant/gated partner path" },
};

function findFiringSites(eventName) {
	const sites = new Set();
	const patterns = [
		`trackEvent\\("${eventName}"`,
		`data-track-view="${eventName}"`,
		`data-track-click="${eventName}"`,
		`data-track-toggle="${eventName}"`,
	];
	for (const pattern of patterns) {
		try {
			const out = execSync(`grep -rlE '${pattern}' src/ 2>/dev/null`, { cwd: REPO_ROOT, encoding: "utf8" });
			out.split("\n").filter(Boolean).forEach((f) => sites.add(f));
		} catch {
			// grep exits 1 on no match - not an error here
		}
	}
	return [...sites].sort();
}

function main() {
	const declared = readEventsSource();
	const rows = declared.map((name) => {
		const sites = findFiringSites(name);
		const semantics = SEMANTICS[name];
		if (!semantics) throw new Error(`No curated semantics entry for declared event "${name}" - add one before trusting this report`);
		return {
			name,
			trigger: semantics.meaning,
			source_files: sites,
			fires_anywhere_in_codebase: sites.length > 0,
			unique_per_session: semantics.unique_per_session,
			user_action: semantics.user_action,
			revenue_stage: semantics.revenue_stage,
			partner_reportable: semantics.partner_reportable,
			note: semantics.note ?? null,
		};
	});

	const undeclaredButFiring = []; // sanity check: any data-track-* in src/ not in ANALYTICS_EVENTS
	let allTrackAttrs = [];
	try {
		const out = execSync(`grep -rohE 'data-track-(view|click|toggle)="[a-z_]+"' src/ 2>/dev/null`, { cwd: REPO_ROOT, encoding: "utf8" });
		allTrackAttrs = [...new Set(out.split("\n").filter(Boolean).map((l) => l.match(/"([a-z_]+)"/)[1]))];
	} catch {
		/* none found */
	}
	for (const name of allTrackAttrs) {
		if (!declared.includes(name)) undeclaredButFiring.push(name);
	}

	const zeroFire = rows.filter((r) => !r.fires_anywhere_in_codebase).map((r) => r.name);

	const report = {
		generated_at: new Date().toISOString().slice(0, 10),
		generated_by: "scripts/analytics-event-map.mjs (source-derived, not hand-maintained)",
		declared_event_count: declared.length,
		events: rows,
		integrity_checks: {
			events_declared_but_never_fired: zeroFire,
			track_attributes_in_markup_but_not_declared: undeclaredButFiring,
		},
	};

	mkdirSync(path.join(REPO_ROOT, "output/revenue-intelligence"), { recursive: true });
	writeFileSync(
		path.join(REPO_ROOT, "output/revenue-intelligence/ANALYTICS_EVENT_MAP.json"),
		JSON.stringify(report, null, 2) + "\n",
	);

	console.log(`Declared events: ${declared.length}`);
	console.log(`Events with 0 firing sites found: ${zeroFire.length}${zeroFire.length ? " -> " + zeroFire.join(", ") : ""}`);
	console.log(`Track attributes in markup but not declared: ${undeclaredButFiring.length}${undeclaredButFiring.length ? " -> " + undeclaredButFiring.join(", ") : ""}`);
	console.log("Written to output/revenue-intelligence/ANALYTICS_EVENT_MAP.json");
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) main();
