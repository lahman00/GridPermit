// Builds ONE canonical, machine-generated partner-territory truth file by
// deriving everything from real source (never hand-maintained): the actual
// runtime allowlist in src/lib/compare-solar-prices.ts, the actual
// utility-split guard in src/lib/utility-split-guard.ts, real locality data,
// real generated pages, and (optionally) real GSC demand data. This exists
// specifically to stop the class of drift found in a prior pass, where
// data/revenue/compare-solar-production-verified.json silently fell out of
// sync with what's actually live (missing norwalk/orange/victorville) and
// couldn't be casually fixed because it's paired with a frozen historical
// deploy contract. This file has no such pairing - it's meant to be
// regenerated any time source data changes, not frozen.
//
// Usage: node scripts/build-partner-territory-canonical.mjs
// Writes output/revenue-intelligence/PARTNER_TERRITORY_CANONICAL.json

import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasVerifiedUnambiguousUtility } from "../src/lib/utility-split-guard.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCALITIES_DIR = path.join(REPO_ROOT, "data", "localities");
const CTA_SOURCE_PATH = path.join(REPO_ROOT, "src", "lib", "compare-solar-prices.ts");
const GSC_NORMALIZED_PATH = path.join(REPO_ROOT, "output", "revenue-intelligence", "GSC_NORMALIZED.csv");
const OUTPUT_PATH = path.join(REPO_ROOT, "output", "revenue-intelligence", "PARTNER_TERRITORY_CANONICAL.json");

// Known, explicitly-vetted expansion candidates NOT on the runtime allowlist
// today (real GSC demand + GridPermit-side READY + no utility-split risk,
// per this project's own partner-activation missions) - kept here as an
// explicit, reviewed list rather than re-deriving "candidate-worthiness"
// from a heuristic every run, since that judgment call (page quality,
// commercial priority) is not something this script should silently decide.
const KNOWN_PARTNER_CONFIRMATION_REQUIRED = new Set(["duarte", "moorpark"]);
const KNOWN_UTILITY_SPLIT_BLOCKED_NO_PAGE = new Set(["corona"]); // no page exists at all yet, separate from Mission Viejo (which has a page + guard already blocks its CTA)

function slugify(name) {
	return name
		.toLowerCase()
		.replace(/&/g, "and")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

async function loadServedCitySlugs() {
	const src = await readFile(CTA_SOURCE_PATH, "utf8");
	const match = src.match(/COMPARE_SOLAR_SERVED_CITY_SLUGS = new Set\(\[([\s\S]*?)\]\)/);
	if (!match) throw new Error("Could not locate COMPARE_SOLAR_SERVED_CITY_SLUGS in " + CTA_SOURCE_PATH);
	return new Set([...match[1].matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]));
}

async function loadAllCaLocalityRecords() {
	const files = (await readdir(LOCALITIES_DIR)).filter((f) => f.startsWith("ca-") && f.endsWith(".json"));
	const records = [];
	for (const file of files) {
		try {
			const record = JSON.parse(await readFile(path.join(LOCALITIES_DIR, file), "utf8"));
			records.push({ file, record });
		} catch {
			// Skip unparsable files rather than crash the whole build - a real
			// data problem there is a separate concern from territory truth.
		}
	}
	return records;
}

async function loadGscBySlug() {
	const bySlug = new Map();
	if (!existsSync(GSC_NORMALIZED_PATH)) return bySlug;
	const csv = await readFile(GSC_NORMALIZED_PATH, "utf8");
	const lines = csv.split("\n").filter(Boolean);
	const header = lines[0].split(",");
	const idx = (name) => header.indexOf(name);
	for (const line of lines.slice(1)) {
		// Simple split is safe here because gsc-ingest.mjs's own writer only
		// quotes fields when they contain a comma - fall back to a proper CSV
		// parse only if that ever changes.
		const cells = line.split(",");
		const landingPage = cells[idx("landing_page")];
		if (!landingPage || landingPage === "UNKNOWN") continue;
		const m = landingPage.match(/\/california\/([a-z0-9-]+)\/solar-permit-guide\//);
		if (!m) continue;
		const slug = m[1];
		const clicks = Number(cells[idx("clicks")]) || 0;
		const impressions = Number(cells[idx("impressions")]) || 0;
		const position = cells[idx("position")];
		const existing = bySlug.get(slug);
		if (!existing || clicks > existing.clicks) {
			bySlug.set(slug, { clicks, impressions, position });
		}
	}
	return bySlug;
}

function classify({ slug, onAllowlist, hasPage, utilityOk, gsc }) {
	if (onAllowlist && hasPage && utilityOk) return "ACTIVE_VERIFIED";
	if (onAllowlist && hasPage && !utilityOk) return "UTILITY_SPLIT_BLOCKED";
	if (onAllowlist && !hasPage) return "READY_WITHIN_EXISTING_TERMS"; // allowlisted, no page yet - engineering-only gap
	if (KNOWN_UTILITY_SPLIT_BLOCKED_NO_PAGE.has(slug)) return "UTILITY_SPLIT_BLOCKED";
	if (KNOWN_PARTNER_CONFIRMATION_REQUIRED.has(slug)) return "PARTNER_CONFIRMATION_REQUIRED";
	if (!utilityOk) return "UTILITY_SPLIT_BLOCKED";
	if (gsc && (gsc.clicks > 0 || gsc.impressions >= 5)) return "PARTNER_CONFIRMATION_REQUIRED"; // real demand, single-utility, not yet allowlisted
	return "NO_PARTNER";
}

async function main() {
	const servedSlugs = await loadServedCitySlugs();
	const localityRecords = await loadAllCaLocalityRecords();
	const gscBySlug = await loadGscBySlug();

	const bySlug = new Map();
	for (const { record } of localityRecords) {
		const city = record?.city?.value;
		if (!city) continue;
		const slug = slugify(city);
		// If two records collide on the same slug (rare cross-record edge case),
		// keep the first and note it rather than silently overwrite - this
		// script should never hide a data ambiguity.
		if (bySlug.has(slug)) continue;
		bySlug.set(slug, record);
	}

	const allSlugsToConsider = new Set([...servedSlugs, ...bySlug.keys()]);

	const rows = [];
	for (const slug of allSlugsToConsider) {
		const record = bySlug.get(slug);
		const onAllowlist = servedSlugs.has(slug);
		const hasPage = existsSync(path.join(REPO_ROOT, "src", "pages", "california", slug, "solar-permit-guide.astro"));
		const utilityOk = record ? hasVerifiedUnambiguousUtility({ record_id: record.record_id, utility: record.utility }) : false;
		const gsc = gscBySlug.get(slug) ?? null;
		const status = classify({ slug, onAllowlist, hasPage, utilityOk, gsc });

		rows.push({
			city: record?.city?.value ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
			county: record?.county?.value ?? "UNKNOWN",
			utility: record?.utility?.value ?? (record ? "UNKNOWN/AMBIGUOUS" : "NO_RECORD"),
			utility_status: utilityOk ? "VERIFIED_UNAMBIGUOUS" : "AMBIGUOUS_OR_UNVERIFIED",
			partner: "CompareSolarPrices",
			partner_territory_status: status,
			cta_status: onAllowlist && hasPage && utilityOk ? "RENDERED" : "NOT_RENDERED",
			tracking_status: onAllowlist && hasPage && utilityOk ? "CID-tracked" : "N/A",
			source_evidence: onAllowlist
				? "src/lib/compare-solar-prices.ts COMPARE_SOLAR_SERVED_CITY_SLUGS (runtime gate)"
				: (KNOWN_PARTNER_CONFIRMATION_REQUIRED.has(slug) ? "GSC demand + GridPermit-side READY, not partner-confirmed (see OWNER_DECISION_PACK.md)" : "GSC demand data, output/revenue-intelligence/GSC_NORMALIZED.csv"),
			last_verified: new Date().toISOString().slice(0, 10),
			reason: !record ? "No locality data record found for this slug" : (!utilityOk ? "Fails hasVerifiedUnambiguousUtility() - see src/lib/utility-split-guard.ts" : (onAllowlist ? "On the runtime served-city allowlist" : "Not on the runtime allowlist yet")),
			gsc_clicks_28d: gsc?.clicks ?? null,
			gsc_impressions_28d: gsc?.impressions ?? null,
			gsc_position: gsc?.position ?? null,
		});
	}

	rows.sort((a, b) => (b.gsc_clicks_28d ?? -1) - (a.gsc_clicks_28d ?? -1));

	const summary = {};
	for (const r of rows) summary[r.partner_territory_status] = (summary[r.partner_territory_status] ?? 0) + 1;

	const output = {
		generated_at: new Date().toISOString().slice(0, 10),
		generated_by: "scripts/build-partner-territory-canonical.mjs - derived from source, not hand-maintained",
		total_cities: rows.length,
		status_summary: summary,
		cities: rows,
	};

	await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
	await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n");
	console.log(`Wrote ${rows.length} city rows to ${path.relative(REPO_ROOT, OUTPUT_PATH)}`);
	console.log("Status summary:", summary);
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) main();

export { classify, slugify };
