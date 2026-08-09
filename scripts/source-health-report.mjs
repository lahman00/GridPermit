#!/usr/bin/env node
// Controlled, read-only external source-health sweep across every READY
// locality record's cited sources (Workstream 22: broken-link audit,
// external half). Reuses validate-record.mjs's already-tested checkUrl
// logic (HEAD-then-GET fallback, 10s timeout, bot-challenge detection,
// REACHABLE/BLOCKED_OR_UNVERIFIABLE/CONFIRMED_BROKEN classification) via
// its exported validate() function rather than duplicating it — this
// script only aggregates per-record results across the full dataset and
// dedupes by URL, since many records cite the same utility program page.
//
// This makes live HTTP requests to real government/utility sites and can
// take several minutes across ~81 records — deliberately NOT part of
// `npm test` or the seo-check CI gate (per the mission's instruction to
// keep unstable network checks out of required CI). Run manually:
//   node scripts/source-health-report.mjs
//
// Read-only: never modifies data/localities/*.json or any evaluation
// output, and never removes a source for being blocked/unverifiable — a
// source blocked to automated access is not evidence it's wrong (see the
// HEDGE_WORDS/checkUrl comments in validate-record.mjs). This script only
// reports; any actual data change stays a separate, human-reviewed step.
//
// Usage: node scripts/source-health-report.mjs [--json]

import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./validate-record.mjs";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const LOCALITIES_DIR = path.join(REPO_ROOT, "data", "localities");
const OUTPUT_DIR = path.join(REPO_ROOT, "output");
const OUT_PATH = path.join(OUTPUT_DIR, "source-health-report.json");
const EXCLUDED_OUTPUT_FILES = new Set([
	"research-progress-report.json",
	"statewide-research-queue.json",
	"site-inventory.json",
	"source-freshness-report.json",
	"source-health-report.json",
]);

async function loadReadyRecords() {
	const outputFiles = (await readdir(OUTPUT_DIR)).filter(
		(f) => f.endsWith(".json") && !EXCLUDED_OUTPUT_FILES.has(f),
	);
	const byId = new Map();
	for (const file of outputFiles) {
		let data;
		try {
			data = JSON.parse(await readFile(path.join(OUTPUT_DIR, file), "utf8"));
		} catch {
			continue;
		}
		for (const rec of data.records ?? []) {
			if (!rec.record_id) continue;
			const existing = byId.get(rec.record_id);
			if (!existing || new Date(data.evaluated_at) > new Date(existing._evaluatedAt)) {
				byId.set(rec.record_id, { ...rec, _evaluatedAt: data.evaluated_at });
			}
		}
	}
	return [...byId.values()].filter((r) => r.readiness === "READY").map((r) => r.record_id);
}

async function main() {
	const startedAt = new Date();
	const readyIds = await loadReadyRecords();

	// URL -> { status, http_status, details, citedBy: [record_id...] } —
	// checked once per unique URL even though many records cite the same
	// utility/CPUC page, so this doesn't hammer the same host repeatedly.
	const byUrl = new Map();
	let recordsChecked = 0;

	for (const recordId of readyIds) {
		const filePath = path.join(LOCALITIES_DIR, `${recordId}.json`);
		let report;
		try {
			report = await validate(filePath);
		} catch (err) {
			console.error(`  ! ${recordId}: validate() threw: ${err.message}`);
			continue;
		}
		recordsChecked++;
		for (const check of report.url_checks ?? []) {
			const existing = byUrl.get(check.url);
			if (existing) {
				existing.citedBy.push(recordId);
			} else {
				byUrl.set(check.url, {
					url: check.url,
					status: check.status,
					http_status: check.http_status,
					details: check.details,
					citedBy: [recordId],
				});
			}
		}
		process.stderr.write(`  checked ${recordsChecked}/${readyIds.length}: ${recordId}\r`);
	}
	process.stderr.write("\n");

	const allChecks = [...byUrl.values()];
	const confirmedBroken = allChecks.filter((c) => c.status === "CONFIRMED_BROKEN");
	const blockedOrUnverifiable = allChecks.filter((c) => c.status === "BLOCKED_OR_UNVERIFIABLE");
	const reachable = allChecks.filter((c) => c.status === "REACHABLE");

	const report = {
		generated_at: new Date().toISOString(),
		duration_seconds: Math.round((Date.now() - startedAt.valueOf()) / 1000),
		ready_records_checked: recordsChecked,
		unique_urls_checked: allChecks.length,
		reachable_count: reachable.length,
		blocked_or_unverifiable_count: blockedOrUnverifiable.length,
		confirmed_broken_count: confirmedBroken.length,
		confirmed_broken: confirmedBroken,
		blocked_or_unverifiable: blockedOrUnverifiable,
	};

	await writeFile(OUT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");

	if (process.argv.includes("--json")) {
		console.log(JSON.stringify(report, null, 2));
	} else {
		console.log(`READY records checked: ${report.ready_records_checked}`);
		console.log(`Unique source URLs checked: ${report.unique_urls_checked}`);
		console.log(`Reachable: ${report.reachable_count}`);
		console.log(`Blocked/unverifiable (not confirmed broken): ${report.blocked_or_unverifiable_count}`);
		console.log(`Confirmed broken: ${report.confirmed_broken_count}`);
		if (confirmedBroken.length > 0) {
			console.log("\nConfirmed broken URLs:");
			for (const c of confirmedBroken) {
				console.log(`  ${c.url} — ${c.details} (cited by: ${c.citedBy.join(", ")})`);
			}
		}
		console.log(`\nFull report: ${path.relative(REPO_ROOT, OUT_PATH)}`);
	}
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
	main().catch((err) => {
		console.error("error:", err.stack ?? String(err));
		process.exit(1);
	});
}
