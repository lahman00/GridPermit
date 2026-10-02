#!/usr/bin/env node
// One-off deterministic local analysis for the 2026-10-02 first-revenue
// sprint. Reads only already-saved GSC artifacts and real repo state - no
// new credentials, no live fetch. Not part of the production build.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { COMPARE_SOLAR_SERVED_CITY_SLUGS, normalizeCompareSolarCitySlug } from "../src/lib/compare-solar-prices.ts";
import { hasVerifiedUnambiguousUtility } from "../src/lib/utility-split-guard.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function localityInfoFromUrl(url) {
	const u = new URL(url);
	const parts = u.pathname.split("/").filter(Boolean);
	// /{state-slug}/{city}/solar-permit-guide/ - works for any state, not just CA.
	if (parts.length === 3 && parts[2] === "solar-permit-guide") return { stateSlug: parts[0], citySlug: parts[1] };
	return null;
}

async function loadLocalityRecord(citySlug) {
	const { readdir } = await import("node:fs/promises");
	const files = await readdir(path.join(ROOT, "data/localities"));
	const match = files.find((f) => f.startsWith("ca-") && f.includes(`-${citySlug}-`) && f.endsWith(".json"));
	if (!match) return null;
	return JSON.parse(await readFile(path.join(ROOT, "data/localities", match), "utf8"));
}

async function main(gscDir) {
	if (!gscDir) throw new Error("Usage: build-first-revenue-opportunities.mjs <path-to-saved-gsc-dir-with-current_page.json>");
	const pageData = JSON.parse(await readFile(path.join(gscDir, "current_page.json"), "utf8"));
	const rows = pageData.rows.filter((r) => r.clicks > 0 || r.impressions >= 10);

	const opportunities = [];
	for (const row of rows) {
		const url = row.keys[0];
		const locality = localityInfoFromUrl(url);
		const citySlug = locality && locality.stateSlug === "california" ? locality.citySlug : null;
		const entry = {
			page_path: new URL(url).pathname,
			gsc_clicks: row.clicks,
			gsc_impressions: row.impressions,
			gsc_position: Math.round(row.position * 100) / 100,
			city: null,
			utility: null,
			intent: null,
			currently_paid_route: false,
			partner: null,
			reason: "",
			classification: null,
			confidence: null,
			actionability: null,
		};

		if (citySlug) {
			entry.city = citySlug;
			entry.intent = "PERMIT_INFORMATION_NEW_SOLAR_SECONDARY";
			const record = await loadLocalityRecord(citySlug);
			if (!record) {
				entry.classification = "NO_ACTION";
				entry.reason = "Locality page matched by URL but no corresponding data record found - data integrity gap, not a monetization gap.";
				entry.confidence = "HIGH";
				entry.actionability = "NONE";
				opportunities.push(entry);
				continue;
			}
			entry.utility = record.utility?.value ?? null;
			const normalizedSlug = normalizeCompareSolarCitySlug(citySlug);
			const onAllowlist = COMPARE_SOLAR_SERVED_CITY_SLUGS.has(normalizedSlug);
			const utilitySafe = hasVerifiedUnambiguousUtility(record);
			if (onAllowlist && utilitySafe) {
				entry.currently_paid_route = true;
				entry.partner = "compare-solar-prices";
				entry.classification = "ALREADY_MONETIZED_SAFE";
				entry.reason = "On the CompareSolarPrices allowlist with a verified unambiguous utility - the CTA renders live on this page today.";
				entry.confidence = "HIGH";
				entry.actionability = "MONITOR_ONLY";
			} else if (onAllowlist && !utilitySafe) {
				entry.classification = "UTILITY_UNSAFE";
				entry.reason = "On the CompareSolarPrices allowlist but utility-split-guard fails closed (ambiguous or split utility) - CTA correctly does not render.";
				entry.confidence = "HIGH";
				entry.actionability = "NEEDS_NEW_WRITTEN_UTILITY_EVIDENCE_BEFORE_ANY_CHANGE";
			} else {
				entry.classification = "GEOGRAPHY_MISMATCH";
				entry.reason = "Real organic demand exists, but this city is not on CompareSolarPrices' confirmed served-city allowlist.";
				entry.confidence = "HIGH";
				entry.actionability = "REQUIRES_PARTNER_TERRITORY_CONFIRMATION_NOT_ENGINEERING";
			}
		} else if (url.includes("/blog/")) {
			entry.intent = "BLOG_EDITORIAL";
			entry.classification = "SAFE_INTERNAL_HANDOFF_OPPORTUNITY";
			entry.reason = "Blog/editorial page with real impressions - already reviewed for internal-link opportunities in PR101/PR102/PR103; no further untapped handoff identified this pass without new evidence.";
			entry.confidence = "MEDIUM";
			entry.actionability = "ALREADY_ACTED_ON_OR_NO_FURTHER_ACTION";
		} else if (locality) {
			// A real locality guide, just not in California - CompareSolarPrices
			// (the only production-active partner) is confirmed CA-only, so this
			// is a real, state-level geography mismatch, not "no action."
			entry.city = locality.citySlug;
			entry.intent = "PERMIT_INFORMATION_NEW_SOLAR_SECONDARY";
			entry.classification = "GEOGRAPHY_MISMATCH";
			entry.reason = `Real organic demand for a ${locality.stateSlug} locality guide, but the only production-active partner (CompareSolarPrices) is confirmed California-only - no state-level route exists.`;
			entry.confidence = "HIGH";
			entry.actionability = "REQUIRES_A_NON_CA_PARTNER_NOT_ENGINEERING";
		} else {
			entry.intent = "OTHER_SITE_STRUCTURE";
			entry.classification = "NO_ACTION";
			entry.reason = "Non-locality, non-blog page (hub/static/home). Not a money-page candidate.";
			entry.confidence = "HIGH";
			entry.actionability = "NONE";
		}
		opportunities.push(entry);
	}

	opportunities.sort((a, b) => b.gsc_clicks - a.gsc_clicks || b.gsc_impressions - a.gsc_impressions);

	const summary = {};
	for (const o of opportunities) summary[o.classification] = (summary[o.classification] ?? 0) + 1;

	const output = {
		generated_at: "2026-10-02",
		method: "Deterministic local analysis over already-saved GSC artifacts (current_page.json, window 2026-09-01..2026-09-28) cross-referenced with the live COMPARE_SOLAR_SERVED_CITY_SLUGS allowlist and hasVerifiedUnambiguousUtility() guard. No new credentials or live fetches used.",
		gsc_window: { start: pageData.start, end: pageData.end },
		candidate_count: opportunities.length,
		classification_summary: summary,
		candidates: opportunities,
	};
	console.log(JSON.stringify(output, null, 2));
}
const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) main(process.argv[2]).catch((e) => { console.error(e); process.exitCode = 1; });
