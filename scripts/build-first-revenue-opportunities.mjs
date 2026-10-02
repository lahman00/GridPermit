#!/usr/bin/env node
// Deterministic first-revenue opportunity analysis over already-saved GSC
// artifacts plus the same fail-closed commercial routing state production uses.
// No new credentials, live analytics fetches, referral clicks or mutations.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadPlatformRegistry } from "./lib/partner-config-io.mjs";
import { debugPartnerRoutes } from "../src/lib/commercial/partner-platform.ts";
import { normalizeCompareSolarCitySlug } from "../src/lib/compare-solar-prices.ts";
import { stateSlug as canonicalStateSlug } from "../src/lib/state-meta.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function localityInfoFromUrl(url) {
	const u = new URL(url);
	const parts = u.pathname.split("/").filter(Boolean);
	if (parts.length === 3 && parts[2] === "solar-permit-guide") return { stateSlug: parts[0], citySlug: parts[1] };
	return null;
}

function parseArgs(argv) {
	if (!argv.length) throw new Error("Usage: build-first-revenue-opportunities.mjs <path-to-saved-gsc-dir> [--now <ISO timestamp>]");
	const gscDir = argv[0];
	let now = new Date().toISOString();
	for (let i = 1; i < argv.length; i++) {
		if (argv[i] === "--now" && argv[i + 1]) now = argv[++i];
		else throw new Error("Invalid option");
	}
	if (!Number.isFinite(Date.parse(now))) throw new Error("Invalid --now timestamp");
	return { gscDir, now };
}

function findLocalityRecord(registry, locality) {
	const matches = registry.records.filter((r) =>
		canonicalStateSlug(r.state) === locality.stateSlug &&
		normalizeCompareSolarCitySlug(r.city?.value ?? "") === locality.citySlug
	);
	return matches.length === 1 ? matches[0] : null;
}

function currentCommercialState(record, pagePath, registry, now) {
	const context = {
		state: record.state,
		city: record.city.value,
		recordId: record.record_id,
		utility: record.utility,
		pagePath,
		pageType: "locality_guide",
		intent: "NEW_SOLAR",
		pageIntent: "NEW_SOLAR",
	};
	const audit = debugPartnerRoutes(context, registry, now);
	const selected = audit.selected ?? null;
	const csp = audit.candidates?.find((c) => c.partner_id === "compare-solar-prices") ?? null;
	return { audit, selected, csp };
}

async function main(gscDir, { now = new Date().toISOString() } = {}) {
	if (!gscDir) throw new Error("Usage: build-first-revenue-opportunities.mjs <path-to-saved-gsc-dir> [--now <ISO timestamp>]");
	if (!Number.isFinite(Date.parse(now))) throw new Error("Invalid clock");

	const [pageData, registry] = await Promise.all([
		readFile(path.join(gscDir, "current_page.json"), "utf8").then(JSON.parse),
		loadPlatformRegistry(ROOT),
	]);
	if (!Array.isArray(pageData.rows)) throw new Error("current_page.json rows required");
	const rows = pageData.rows.filter((r) => r.clicks > 0 || r.impressions >= 10);

	const opportunities = [];
	for (const row of rows) {
		const url = row.keys[0];
		const pagePath = new URL(url).pathname;
		const locality = localityInfoFromUrl(url);
		const entry = {
			page_path: pagePath,
			gsc_clicks: row.clicks,
			gsc_impressions: row.impressions,
			gsc_position: Math.round(row.position * 100) / 100,
			city: null,
			utility: null,
			intent: null,
			currently_paid_route: false,
			partner: null,
			routing_reason: null,
			partner_blockers: [],
			reason: "",
			classification: null,
			confidence: null,
			actionability: null,
		};

		if (locality) {
			entry.city = locality.citySlug;
			entry.intent = "PERMIT_INFORMATION_NEW_SOLAR_SECONDARY";
			const record = findLocalityRecord(registry, locality);
			if (!record) {
				entry.classification = "NO_ACTION";
				entry.reason = "Locality URL did not resolve to exactly one canonical record; treat as a data-integrity question, not a monetization opportunity.";
				entry.confidence = "HIGH";
				entry.actionability = "NONE";
				opportunities.push(entry);
				continue;
			}
			entry.utility = record.utility?.value ?? null;

			const { audit, selected, csp } = currentCommercialState(record, pagePath, registry, now);
			entry.routing_reason = audit.reason ?? null;
			entry.partner_blockers = csp?.reasons ?? [];

			if (selected?.selected) {
				entry.currently_paid_route = true;
				entry.partner = selected.partner_id;
				entry.classification = "ALREADY_MONETIZED_SAFE";
				entry.reason = `The production routing engine selects ${selected.partner_id} for this exact canonical context at the supplied clock; approval, tracking, territory, utility and destination-health gates all pass.`;
				entry.confidence = "HIGH";
				entry.actionability = "MONITOR_ONLY";
			} else if (
				record.state !== "CA" ||
				entry.partner_blockers.includes("TERRITORY_MISMATCH") ||
				entry.partner_blockers.includes("APPROVED_SCOPE_MISMATCH")
			) {
				// Geography is the primary blocker when the only active paid
				// partner does not cover the state/city. Do not mislabel a
				// non-covered locality as an actionable utility problem merely
				// because its record also fails the utility-split guard.
				entry.classification = "GEOGRAPHY_MISMATCH";
				entry.reason = "Real organic demand exists, but no currently verified production partner route covers this exact locality context.";
				entry.confidence = "HIGH";
				entry.actionability = record.state === "CA"
					? "REQUIRES_PARTNER_TERRITORY_CONFIRMATION_NOT_ENGINEERING"
					: "REQUIRES_A_NON_CA_PARTNER_NOT_ENGINEERING";
			} else if (entry.partner_blockers.includes("UTILITY_UNSAFE")) {
				entry.classification = "UTILITY_UNSAFE";
				entry.reason = "The locality is inside the verified commercial geography, but production routing still fails closed because the canonical utility context is ambiguous or split.";
				entry.confidence = "HIGH";
				entry.actionability = "NEEDS_NEW_WRITTEN_UTILITY_EVIDENCE_BEFORE_ANY_CHANGE";
			} else {
				entry.classification = "NO_ACTION";
				entry.reason = `No paid route is currently selectable by the production routing engine at the supplied clock. Blockers: ${entry.partner_blockers.join(";") || audit.reason || "UNKNOWN"}.`;
				entry.confidence = "HIGH";
				entry.actionability = "COMMERCIAL_ROUTE_NOT_CURRENTLY_LIVE";
			}
		} else if (url.includes("/blog/")) {
			entry.intent = "BLOG_EDITORIAL";
			entry.classification = "SAFE_INTERNAL_HANDOFF_OPPORTUNITY";
			entry.reason = "Blog/editorial page with real demand; requires manual intent/geography review before any internal handoff is added.";
			entry.confidence = "MEDIUM";
			entry.actionability = "MANUAL_REVIEW_ONLY";
		} else {
			entry.intent = "OTHER_SITE_STRUCTURE";
			entry.classification = "NO_ACTION";
			entry.reason = "Non-locality, non-blog page (hub/static/home). Not automatically a money-page candidate.";
			entry.confidence = "HIGH";
			entry.actionability = "NONE";
		}
		opportunities.push(entry);
	}

	opportunities.sort((a, b) => b.gsc_clicks - a.gsc_clicks || b.gsc_impressions - a.gsc_impressions);
	const summary = {};
	for (const o of opportunities) summary[o.classification] = (summary[o.classification] ?? 0) + 1;

	const output = {
		generated_at: now,
		method: "Read-only analysis over an already-saved GSC current_page.json joined to the same fail-closed partner registry and debugPartnerRoutes() logic used by production. currently_paid_route=true only when the exact canonical locality context is selectable at the supplied clock, including destination-health freshness.",
		gsc_window: { start: pageData.start, end: pageData.end },
		candidate_count: opportunities.length,
		classification_summary: summary,
		candidates: opportunities,
	};
	console.log(JSON.stringify(output, null, 2));
}

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
	try {
		const { gscDir, now } = parseArgs(process.argv.slice(2));
		await main(gscDir, { now });
	} catch (e) {
		console.error(e);
		process.exitCode = 1;
	}
}
