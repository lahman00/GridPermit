#!/usr/bin/env node
// "Is GridPermit search-ready?" — a single repeatable gate over the things
// this repo actually controls: build health, SEO metadata, data quality,
// sitemap/robots/canonical consistency, and internal-link graph health
// (orphans, noindex/sitemap conflicts). It does NOT and CANNOT claim
// rankings, indexation, or traffic — those depend on Google, not on this
// repo. Run after `npm run build`.
//
// Usage: node scripts/search-readiness.mjs

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { REPO_ROOT, DIST_DIR } from "./site-inventory.mjs";

const PRODUCTION_HOST = "https://mygridpermit.com";

function section(name, ok, detail) {
	const mark = ok ? "PASS" : "FAIL";
	console.log(`[${mark}] ${name}${detail ? " — " + detail : ""}`);
	return ok;
}

async function main() {
	if (!existsSync(DIST_DIR)) {
		console.error("No dist/ found — run `npm run build` first.");
		process.exit(1);
	}

	const results = [];

	// 1. Site inventory hard-defect gate (title/description/canonical/H1/
	// structured-data/orphan/sitemap-drift/dead-link checks already live in
	// scripts/site-inventory.mjs --check).
	try {
		execFileSync("node", ["scripts/site-inventory.mjs", "--check"], { cwd: REPO_ROOT, stdio: "pipe" });
		results.push(section("SEO hard-defect check (site-inventory --check)", true));
	} catch (err) {
		results.push(section("SEO hard-defect check (site-inventory --check)", false, "hard defects found — see `npm run seo-check`"));
	}

	// 2. Data quality gate.
	try {
		execFileSync("node", ["scripts/data-quality-check.mjs"], { cwd: REPO_ROOT, stdio: "pipe" });
		results.push(section("Data quality check", true));
	} catch {
		results.push(section("Data quality check", false, "see `npm run data-quality-check`"));
	}

	// 3. Indexation ledger — orphans, noindex/sitemap conflicts.
	execFileSync("node", ["scripts/build-indexation-ledger.mjs"], { cwd: REPO_ROOT, stdio: "pipe" });
	const ledger = JSON.parse(await readFile(path.join(REPO_ROOT, "output", "indexation-ledger.json"), "utf8"));
	results.push(section("No orphan pages", ledger.summary.orphans === 0, `${ledger.summary.orphans} orphan(s)`));
	results.push(
		section(
			"No indexable pages missing from sitemap",
			ledger.summary.not_in_sitemap_but_indexable === 0,
			`${ledger.summary.not_in_sitemap_but_indexable} missing`,
		),
	);
	results.push(
		section("No pages with zero inbound internal links", ledger.summary.zero_inbound_links === 0, `${ledger.summary.zero_inbound_links} found`),
	);

	// 4. robots.txt sanity.
	const robotsPath = path.join(DIST_DIR, "robots.txt");
	let robotsOk = false;
	let robotsDetail = "missing dist/robots.txt";
	if (existsSync(robotsPath)) {
		const robots = await readFile(robotsPath, "utf8");
		const allowsAll = /User-agent:\s*\*/i.test(robots) && /Allow:\s*\//.test(robots) && !/Disallow:\s*\/\s*$/im.test(robots);
		const hasSitemap = robots.includes(`${PRODUCTION_HOST}/sitemap-index.xml`);
		robotsOk = allowsAll && hasSitemap;
		robotsDetail = robotsOk ? "" : "robots.txt missing an Allow rule or the correct Sitemap: line";
	}
	results.push(section("robots.txt allows crawling and references the sitemap", robotsOk, robotsDetail));

	// 5. Sitemap host/protocol consistency.
	const sitemapPath = path.join(DIST_DIR, "sitemap-0.xml");
	let sitemapOk = false;
	let sitemapDetail = "missing dist/sitemap-0.xml";
	if (existsSync(sitemapPath)) {
		const xml = await readFile(sitemapPath, "utf8");
		const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
		const badHost = locs.filter((l) => !l.startsWith(PRODUCTION_HOST));
		const noTrailingSlash = locs.filter((l) => !l.endsWith("/"));
		const dupes = locs.length - new Set(locs).size;
		sitemapOk = badHost.length === 0 && noTrailingSlash.length === 0 && dupes === 0;
		sitemapDetail = sitemapOk
			? `${locs.length} URLs, all canonical host/protocol, all trailing-slash, 0 duplicates`
			: `${badHost.length} bad-host, ${noTrailingSlash.length} no-trailing-slash, ${dupes} duplicate URLs`;
	}
	results.push(section("Sitemap host/protocol/trailing-slash/duplicate check", sitemapOk, sitemapDetail));

	// 6. Canonical host/protocol + self-referential consistency (from the ledger).
	const badCanonicals = ledger.entries.filter((e) => !e.canonical || !e.canonical.startsWith(PRODUCTION_HOST));
	const nonSelfCanonicals = ledger.entries.filter((e) => e.canonical && e.canonical.replace(PRODUCTION_HOST, "") !== e.url);
	results.push(
		section(
			"Canonical tags: correct host + self-referential",
			badCanonicals.length === 0 && nonSelfCanonicals.length === 0,
			`${badCanonicals.length} bad-host, ${nonSelfCanonicals.length} non-self-referential`,
		),
	);

	// 7. No accidental noindex on published locality guides / state hubs / home / /permits.
	const shouldBeIndexable = ledger.entries.filter((e) =>
		["home", "locality-directory", "locality-guide", "state-hub", "california-hub"].includes(e.family),
	);
	const accidentallyNoindex = shouldBeIndexable.filter((e) => e.index_status === "noindex");
	results.push(
		section(
			"No accidental noindex on core discoverable pages",
			accidentallyNoindex.length === 0,
			`${accidentallyNoindex.length} core page(s) noindexed`,
		),
	);

	const allPass = results.every(Boolean);
	console.log("");
	console.log(allPass ? "SEARCH-READY: yes, on everything this repo controls." : "SEARCH-READY: no — see FAIL lines above.");
	console.log("This does not and cannot guarantee crawling, indexation, ranking, or traffic — those depend on Google.");

	if (!allPass) process.exitCode = 1;
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
	main().catch((err) => {
		console.error("error:", err.stack ?? String(err));
		process.exit(1);
	});
}
