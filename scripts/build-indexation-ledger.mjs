#!/usr/bin/env node
// Reusable technical indexation ledger. Builds on site-inventory.mjs's
// per-page HTML analysis (title/description/canonical/H1/structured-data/
// internal links) and adds the graph-level facts that script doesn't
// compute: inbound link count per URL, BFS click-depth from the homepage,
// a true per-page orphan flag, state/locality/record_id extraction, source
// count (joined against data/localities/*.json), and an evidence-based
// priority tier. Read-only against dist/ and data/; writes only to output/.
//
// Usage: node scripts/build-indexation-ledger.mjs (run after `npm run build`)

import { readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	REPO_ROOT,
	DIST_DIR,
	walk,
	urlForFile,
	analyzePage,
	loadRedirectMap,
	loadSitemapUrls,
	classifyPageFamily,
} from "./site-inventory.mjs";

const SRC_PAGES_DIR = path.join(REPO_ROOT, "src", "pages");
const LOCALITIES_DIR = path.join(REPO_ROOT, "data", "localities");
const OUT_JSON = path.join(REPO_ROOT, "output", "indexation-ledger.json");
const OUT_CSV = path.join(REPO_ROOT, "output", "indexation-ledger.csv");

// Same asset/anchor/external filtering rule as site-inventory.mjs's own
// orphan detection, kept separate here since that logic isn't exported —
// only http(s)-relative page links count as an internal edge for depth/
// inbound-link purposes, not CSS/JS assets, mailto:, or same-page anchors.
function isPageLink(link) {
	if (!link.startsWith("/")) return false;
	if (link.startsWith("/_astro/") || link.startsWith("/sitemap") || link === "/robots.txt") return false;
	if (link.startsWith("#")) return false;
	return true;
}

function normalizeUrl(url) {
	// Collapse a bare path to its trailing-slash canonical form, matching
	// how urlForFile() derives URLs from dist/**/index.html — every real
	// page URL in this dataset ends in "/".
	if (url === "") return "/";
	return url.endsWith("/") ? url : `${url}/`;
}

async function loadEvaluationIndex() {
	const outputDir = path.join(REPO_ROOT, "output");
	const files = (await readdir(outputDir)).filter((f) => f.endsWith("-evaluation.json"));
	const byRecordId = new Map();
	for (const f of files) {
		const data = JSON.parse(await readFile(path.join(outputDir, f), "utf8"));
		if (!data.records) continue;
		for (const r of data.records) byRecordId.set(r.record_id, r);
	}
	return byRecordId;
}

// Extracts the record_id a generated locality page imports, straight from
// its own src/pages/**/solar-permit-guide.astro source — the single
// authoritative link between a dist URL and its data/localities/*.json
// record, since generate-locality-pages.mjs writes that import itself.
async function recordIdForLocalityUrl(url) {
	const relDir = url.replace(/^\//, "").replace(/\/$/, "");
	const astroPath = path.join(SRC_PAGES_DIR, `${relDir}.astro`);
	if (!existsSync(astroPath)) return null;
	const src = await readFile(astroPath, "utf8");
	const m = src.match(/data\/localities\/([a-z0-9-]+)\.json/);
	return m ? m[1] : null;
}

function stateSlugFromUrl(url) {
	const seg = url.replace(/^\//, "").split("/")[0];
	return seg || null;
}

// Evidence-based priority tier per Phase 20 of the launch mission: real
// data quality (completeness), location significance (family), and
// internal-link role — never search-volume guesses, since none exist yet.
function priorityTier({ family, completenessPct }) {
	if (family === "home" || family === "locality-directory" || family === "california-hub") return 1;
	if (family === "state-hub") return completenessPct != null && completenessPct >= 80 ? 1 : 2;
	if (family === "locality-guide") return completenessPct != null && completenessPct >= 80 ? 1 : 2;
	if (family === "county-hub" || family === "utility-hub" || family === "search") return 2;
	if (family === "blog-post" || family === "blog-index") return 2;
	return 3;
}

async function main() {
	const files = await walk(DIST_DIR);
	const pages = [];
	for (const file of files) {
		const url = urlForFile(file);
		const html = await readFile(file, "utf8");
		const analysis = analyzePage(url, html);
		analysis.family = classifyPageFamily(url);
		pages.push(analysis);
	}
	pages.sort((a, b) => a.url.localeCompare(b.url));

	const sitemapUrls = await loadSitemapUrls();
	const sitemapSet = new Set(sitemapUrls.map(normalizeUrl));
	const redirectMap = await loadRedirectMap();
	const evalByRecordId = await loadEvaluationIndex();

	// --- Inbound link graph (in-degree) ---
	const inboundLinks = new Map(); // url -> Set(fromUrl)
	for (const p of pages) {
		const seen = new Set();
		for (const rawLink of p.internalLinks) {
			if (!isPageLink(rawLink)) continue;
			let link = normalizeUrl(rawLink.split("?")[0].split("#")[0]);
			// Resolve one redirect hop so a link routed through a short-URL
			// redirect still counts as an inbound edge to its real target —
			// matches site-inventory.mjs's own redirect-aware dead-link check.
			if (redirectMap.has(link)) link = normalizeUrl(redirectMap.get(link));
			if (link === p.url) continue; // self-links don't count as inbound
			seen.add(link);
		}
		for (const link of seen) {
			if (!inboundLinks.has(link)) inboundLinks.set(link, new Set());
			inboundLinks.get(link).add(p.url);
		}
	}

	// --- Outbound adjacency for BFS depth ---
	const outboundByUrl = new Map();
	for (const p of pages) {
		const targets = new Set();
		for (const rawLink of p.internalLinks) {
			if (!isPageLink(rawLink)) continue;
			let link = normalizeUrl(rawLink.split("?")[0].split("#")[0]);
			if (redirectMap.has(link)) link = normalizeUrl(redirectMap.get(link));
			targets.add(link);
		}
		outboundByUrl.set(p.url, targets);
	}

	// --- BFS click-depth from homepage ---
	const depthByUrl = new Map();
	depthByUrl.set("/", 0);
	const queue = ["/"];
	while (queue.length > 0) {
		const current = queue.shift();
		const depth = depthByUrl.get(current);
		for (const next of outboundByUrl.get(current) ?? []) {
			if (!depthByUrl.has(next)) {
				depthByUrl.set(next, depth + 1);
				queue.push(next);
			}
		}
	}

	// --- Per-page ledger entries ---
	const entries = [];
	for (const p of pages) {
		const inbound = inboundLinks.get(p.url) ?? new Set();
		const stateSlug = ["locality-guide", "state-hub", "county-hub", "utility-hub"].includes(p.family)
			? stateSlugFromUrl(p.url)
			: null;

		let recordId = null;
		let sourceCount = null;
		let completenessPct = null;
		let lastVerified = null;
		if (p.family === "locality-guide") {
			recordId = await recordIdForLocalityUrl(p.url);
			if (recordId) {
				const recordPath = path.join(LOCALITIES_DIR, `${recordId}.json`);
				if (existsSync(recordPath)) {
					const record = JSON.parse(await readFile(recordPath, "utf8"));
					sourceCount = Array.isArray(record.sources) ? record.sources.length : null;
					lastVerified = record.last_verified ?? null;
				}
				const evalRecord = evalByRecordId.get(recordId);
				completenessPct = evalRecord?.completeness_pct ?? null;
			}
		}

		entries.push({
			url: p.url,
			family: p.family,
			state_slug: stateSlug,
			record_id: recordId,
			index_status: p.noindex ? "noindex" : "index",
			canonical: p.canonical,
			in_sitemap: sitemapSet.has(normalizeUrl(p.url)),
			title: p.title,
			title_length: p.titleLength,
			description: p.description,
			description_length: p.descriptionLength,
			h1: p.h1s[0] ?? null,
			h1_count: p.h1s.length,
			structured_data_types: p.structuredDataTypes,
			structured_data_errors: p.structuredDataErrors,
			internal_links_out: p.internalLinkCount,
			internal_links_in: inbound.size,
			click_depth_from_home: depthByUrl.has(p.url) ? depthByUrl.get(p.url) : null,
			is_orphan: !depthByUrl.has(p.url) && p.url !== "/",
			word_count: p.wordCount,
			source_count: sourceCount,
			completeness_pct: completenessPct,
			last_verified: lastVerified,
			priority_tier: priorityTier({ family: p.family, completenessPct }),
		});
	}

	const summary = {
		generated_at: new Date().toISOString(),
		total_entries: entries.length,
		orphans: entries.filter((e) => e.is_orphan).length,
		noindex_count: entries.filter((e) => e.index_status === "noindex").length,
		not_in_sitemap_but_indexable: entries.filter((e) => e.index_status === "index" && !e.in_sitemap).length,
		tier_counts: {
			tier_1: entries.filter((e) => e.priority_tier === 1).length,
			tier_2: entries.filter((e) => e.priority_tier === 2).length,
			tier_3: entries.filter((e) => e.priority_tier === 3).length,
		},
		max_click_depth: Math.max(...entries.map((e) => e.click_depth_from_home ?? 0)),
		zero_inbound_links: entries.filter((e) => e.internal_links_in === 0 && e.url !== "/").length,
	};

	const report = { summary, entries };
	await writeFile(OUT_JSON, JSON.stringify(report, null, 2) + "\n", "utf8");

	const csvHeader = Object.keys(entries[0]).filter((k) => !["structured_data_types", "structured_data_errors"].includes(k));
	const csvRows = entries.map((e) =>
		csvHeader
			.map((k) => {
				const v = e[k];
				if (v === null || v === undefined) return "";
				const s = String(v).replace(/"/g, '""');
				return /[",\n]/.test(s) ? `"${s}"` : s;
			})
			.join(","),
	);
	await writeFile(OUT_CSV, [csvHeader.join(","), ...csvRows].join("\n") + "\n", "utf8");

	console.log(JSON.stringify(summary, null, 2));
	console.log(`\nWritten: ${path.relative(REPO_ROOT, OUT_JSON)}`);
	console.log(`Written: ${path.relative(REPO_ROOT, OUT_CSV)}`);
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
	main().catch((err) => {
		console.error("error:", err.stack ?? String(err));
		process.exit(1);
	});
}
