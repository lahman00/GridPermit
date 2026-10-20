#!/usr/bin/env node
// Builds the GridPermit Growth Command Center from existing evidence. Local
// files only: no network, no analytics call, no credential, no posting.
//
//   node scripts/build-growth-command-center.mjs --gsc <private-gsc-export.json> --snapshot <dist-snapshot.json> --out <dir outside the repo> [--today YYYY-MM-DD]
//        [--ga4 <ga4-report-export.json>] [--outbound <outbound-export.json>] [--partner-report <rows.json>]
//        [--partner-report-complete]  assert the partner report covers the whole window (otherwise pages without rows are UNKNOWN)
//        [--now <ISO timestamp>]
//
// Inputs that carry private search or revenue metrics stay outside the
// repository, and so does the output: the script refuses an --out inside it.

import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { citySlug, guideUrlForCitySlug, utilityShortName } from "../src/lib/locality-guide.ts";
import { QUICK_ANSWER_PILOTS } from "../src/lib/quick-answer-pilots.ts";
import { COMMERCIAL_SEO_PROFILES } from "../src/lib/commercial-seo-profiles.ts";
import { PERMIT_PATHWAY_RECORD_IDS } from "../src/lib/permit-pathway-answer.ts";
import { analyzeSearch, parseGscExport } from "./lib/search-opportunities.mjs";
import { buildFreshnessQueue } from "./lib/freshness-queue.mjs";
import { buildFunnel, parseGa4Export } from "./lib/growth-funnel.mjs";
import { structuralMetrics } from "./lib/organic-report.mjs";
import { buildQueue, renderQueueMarkdown } from "./lib/distribution-queue.mjs";
import { applyGate, buildReplyQueue, evaluateGate } from "./lib/distribution-controls.mjs";
import { contextFromSnapshot } from "./build-distribution-queue.mjs";
import { buildCommandCenter, localitySiblingStats, renderHebrew } from "./lib/growth-command-center.mjs";
import { REPO_ROOT as SHARED_ROOT, assertOutsideRepo, insideRepo } from "./lib/private-output.mjs";

export { insideRepo };

const REPO_ROOT = SHARED_ROOT;
const CONTENT_LINK_PILOT_MERGED = "2026-10-20";
const OBSERVATION_DAYS = 28;

const arg = (argv, name, fallback) => {
	const i = argv.indexOf(name);
	return i >= 0 ? argv[i + 1] : fallback;
};
const readText = (p) => readFileSync(p, "utf8");
const readJson = (p) => JSON.parse(readText(p));

function addDays(iso, days) {
	return new Date(Date.parse(iso) + days * 86400000).toISOString().slice(0, 10);
}

export function loadRepoFacts() {
	const records = readdirSync(path.join(REPO_ROOT, "data/localities"))
		.filter((f) => f.endsWith(".json"))
		.map((f) => readJson(path.join(REPO_ROOT, "data/localities", f)));
	const ready = new Set();
	for (const f of readdirSync(path.join(REPO_ROOT, "output")).filter((f) => f.endsWith("-evaluation.json"))) {
		for (const r of readJson(path.join(REPO_ROOT, "output", f)).records ?? []) if (r.readiness === "READY") ready.add(r.record_id);
	}
	const urlFor = (r) => guideUrlForCitySlug(r.state, citySlug(r.city.value));
	const byId = new Map(records.map((r) => [r.record_id, r]));
	const manifestPath = path.join(REPO_ROOT, "netlify/generated/outbound-routes.json");
	const paid = existsSync(manifestPath) ? new Set(readJson(manifestPath).map((r) => r.page_path)) : null;
	const registry = readJson(path.join(REPO_ROOT, "data/content-links/registry.json"));
	return { records, ready, urlFor, byId, paid, registry };
}

// Pages that are inside an experiment or an observation window. They are
// analysed and reported but never recommended for editing.
export function buildLocks(facts, today) {
	const locks = new Map();
	const add = (p, why) => locks.set(p, [...(locks.get(p) ?? []), why]);
	const lockRecord = (id, why) => {
		const r = facts.byId.get(id);
		if (r) add(facts.urlFor(r), why);
	};
	for (const p of QUICK_ANSWER_PILOTS.values()) lockRecord(p.recordId, "Quick Answer pilot (28 days and at least 25 views before interpretation)");
	for (const id of COMMERCIAL_SEO_PROFILES.keys()) lockRecord(id, "commercial SEO/CRO profile under observation");
	for (const id of PERMIT_PATHWAY_RECORD_IDS) lockRecord(id, "reviewed permit-pathway block");
	const until = addDays(CONTENT_LINK_PILOT_MERGED, OBSERVATION_DAYS);
	for (const u of [...facts.registry.rollout.locality_pages, ...facts.registry.rollout.utility_hubs, ...facts.registry.rollout.articles]) {
		if (today < until) add(u, `PTO link pilot (PR #140) observation until ${until}`);
	}
	const br = facts.registry.balanced_related;
	if (br) {
		for (const u of br.pages) add(u, "balanced related-cities experiment: measurement window starts at deploy; do not edit");
		for (const u of br.control_pages ?? []) add(u, "balanced related-cities experiment control: leave unchanged during measurement");
	}
	return locks;
}

export function buildAll(opts) {
	const { gscText, ga4Text = null, outbound = null, partnerRows = null, partnerReportComplete = false, snapshot, today, facts } = opts;
	// Real run time when the report is for today; end of day for a past date, so same-day rows never lie in the future.
	const now = opts.now ?? (today === new Date().toISOString().slice(0, 10) ? new Date().toISOString() : `${today}T23:59:59.999Z`);
	const locks = buildLocks(facts, today);
	const parsed = parseGscExport(gscText);
	const inboundByPath = Object.fromEntries(Object.entries(structuralMetrics(snapshot, Object.keys(snapshot.pages))));
	const search = analyzeSearch(parsed, { inboundByPath, lockedPaths: new Set(locks.keys()), paidPaths: facts.paid ?? new Set() });
	const demand = new Map(search.pages.map((p) => [p.path, { impressions: p.impressions, clicks: p.clicks }]));
	const reviews = readJson(path.join(REPO_ROOT, "data/freshness/reviews.json")).reviews;
	const freshness = buildFreshnessQueue(facts.records, { today, readyIds: facts.ready, urlFor: facts.urlFor, demand, paidPaths: facts.paid ?? new Set(), reviews });
	const recordByPath = new Map(facts.records.map((r) => [facts.urlFor(r), r]));
	const topicFor = (p) => {
		const rec = recordByPath.get(p);
		if (rec) return `locality:${utilityShortName(rec.utility.value) ?? "unknown-utility"}`;
		const res = facts.registry.resources.find((r) => r.url === p);
		if (res) return `article:${res.kind}`;
		return `page:${p.startsWith("/blog/") ? "blog" : p.includes("/utility/") ? "utility_hub" : p.includes("/county/") ? "county_hub" : "other"}`;
	};
	const funnel = buildFunnel({
		search,
		ga4: ga4Text ? parseGa4Export(ga4Text) : null,
		outboundExport: outbound,
		partnerRows,
		partnerReportComplete,
		paidPaths: facts.paid, // null when the route manifest is missing: paid-route status is then UNKNOWN
		topicFor,
		now,
	});
	const candidates = readJson(path.join(REPO_ROOT, "data/distribution/candidates.json")).candidates;
	const ledgerFile = readJson(path.join(REPO_ROOT, "data/distribution/posted-topics.json"));
	const gate = readJson(path.join(REPO_ROOT, "data/distribution/publishing-gate.json"));
	const discussionsFile = readJson(path.join(REPO_ROOT, "data/distribution/discussions.json"));
	const dctx = contextFromSnapshot(snapshot, ledgerFile.entries, today);
	const queue = applyGate(buildQueue(candidates, dctx), gate);
	const replies = buildReplyQueue(discussionsFile.replies, discussionsFile.discussions, { today, ledger: ledgerFile.entries, builtPages: dctx.builtPages, gate });
	const targets = [...new Set(facts.registry.resources.map((r) => r.url))].sort();
	const linkGraph = structuralMetrics(snapshot, targets);
	const cc = buildCommandCenter({
		today,
		search,
		funnel,
		freshness,
		queue,
		replies,
		gate: evaluateGate(gate, "linkedin", null),
		ledgerEntries: ledgerFile.entries,
		lockedPaths: locks,
		linkGraph,
		sibling: localitySiblingStats(snapshot, facts.registry.balanced_related?.pages ?? []),
	});
	return { cc, search, funnel, freshness, queue, replies };
}

function main(argv) {
	const gsc = arg(argv, "--gsc");
	const snapshotPath = arg(argv, "--snapshot");
	const out = arg(argv, "--out");
	if (!gsc || !snapshotPath || !out) {
		console.error("usage: build-growth-command-center.mjs --gsc <export.json> --snapshot <dist-snapshot.json> --out <dir outside the repo> [--today YYYY-MM-DD] [--ga4 f] [--outbound f] [--partner-report f]");
		return 2;
	}
	try {
		assertOutsideRepo(out);
	} catch (e) {
		console.error(e.message);
		return 2;
	}
	const today = arg(argv, "--today", new Date().toISOString().slice(0, 10));
	const result = buildAll({
		gscText: readText(gsc),
		ga4Text: arg(argv, "--ga4") ? readText(arg(argv, "--ga4")) : null,
		outbound: arg(argv, "--outbound") ? readJson(arg(argv, "--outbound")) : null,
		partnerRows: arg(argv, "--partner-report") ? readJson(arg(argv, "--partner-report")) : null,
		partnerReportComplete: argv.includes("--partner-report-complete"),
		now: arg(argv, "--now"),
		snapshot: readJson(snapshotPath),
		today,
		facts: loadRepoFacts(),
	});
	mkdirSync(out, { recursive: true });
	writeFileSync(path.join(out, "growth-command-center.json"), JSON.stringify(result.cc, null, 2));
	writeFileSync(path.join(out, "growth-command-center.he.md"), renderHebrew(result.cc));
	writeFileSync(path.join(out, "search-analysis.json"), JSON.stringify(result.search, null, 2));
	writeFileSync(path.join(out, "freshness-queue.json"), JSON.stringify(result.freshness, null, 2));
	writeFileSync(path.join(out, "growth-funnel.json"), JSON.stringify(result.funnel, null, 2));
	writeFileSync(path.join(out, "distribution-review-queue.json"), JSON.stringify(result.queue, null, 2));
	writeFileSync(path.join(out, "distribution-review-queue.md"), renderQueueMarkdown(result.queue));
	console.log(JSON.stringify({ out, next_actions: result.cc.next_actions.length, freshness: result.freshness.counts, search: result.search.classification_counts }));
	return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));
