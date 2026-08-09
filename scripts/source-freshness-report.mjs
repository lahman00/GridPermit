#!/usr/bin/env node
// Read-only content-freshness report for every READY locality record.
// Reports last_verified age and oldest/newest source accessed_date per
// record — it never mutates data/localities/*.json or any evaluation
// output. Two distinct kinds of "freshness" are reported and must not be
// confused: last_verified (when GridPermit's own researcher last confirmed
// the record) and each individual source's own accessed_date (when that
// specific citation was retrieved) — a record can have a recent
// last_verified built on an older source citation, and that's a real,
// reportable gap, not a bug.
//
// Live external URL health-checking already exists in validate-record.mjs
// (checkUrl / the broken_url check) and is intentionally NOT duplicated or
// invoked here by default — this script is the fast, offline half of
// freshness reporting; run validate-record.mjs per record (or a batch
// wrapper over it) for the live external source-health half. Keeping the
// two separate means this script stays fast and network-free enough to run
// anytime, including from a laptop with no network, while the live check
// stays a deliberate, rate-aware, separately-run step — never silently
// bundled into a CI gate (see docs note in site-inventory.mjs's --check).
//
// Usage: node scripts/source-freshness-report.mjs [--json]

import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const LOCALITIES_DIR = path.join(REPO_ROOT, "data", "localities");
const OUTPUT_DIR = path.join(REPO_ROOT, "output");
const OUT_PATH = path.join(OUTPUT_DIR, "source-freshness-report.json");
const EXCLUDED_OUTPUT_FILES = new Set([
	"research-progress-report.json",
	"statewide-research-queue.json",
	"site-inventory.json",
	"source-freshness-report.json",
]);

// A record's own last-verified freshness bucket relative to "now" — not a
// claim about accuracy, just how long it's been since GridPermit last
// independently re-confirmed the record against its cited sources.
const STALE_THRESHOLD_DAYS = 180;

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

function daysBetween(fromIso, toDate) {
	const from = new Date(fromIso);
	if (Number.isNaN(from.valueOf())) return null;
	return Math.floor((toDate.valueOf() - from.valueOf()) / (1000 * 60 * 60 * 24));
}

async function main() {
	const now = new Date();
	const readyIds = await loadReadyRecords();

	const perRecord = [];
	for (const recordId of readyIds) {
		const filePath = path.join(LOCALITIES_DIR, `${recordId}.json`);
		let record;
		try {
			record = JSON.parse(await readFile(filePath, "utf8"));
		} catch {
			continue;
		}
		const lastVerified = record.last_verified;
		const lastVerifiedAgeDays = daysBetween(lastVerified, now);
		const accessedDates = (record.sources ?? [])
			.map((s) => s.accessed_date)
			.filter((d) => typeof d === "string" && !Number.isNaN(new Date(d).valueOf()));
		const oldestSourceAccessed = accessedDates.length
			? accessedDates.reduce((a, b) => (new Date(a) < new Date(b) ? a : b))
			: null;
		const newestSourceAccessed = accessedDates.length
			? accessedDates.reduce((a, b) => (new Date(a) > new Date(b) ? a : b))
			: null;
		perRecord.push({
			record_id: recordId,
			city: record.city?.value ?? null,
			last_verified: lastVerified,
			last_verified_age_days: lastVerifiedAgeDays,
			is_stale: lastVerifiedAgeDays !== null && lastVerifiedAgeDays > STALE_THRESHOLD_DAYS,
			source_count: record.sources?.length ?? 0,
			oldest_source_accessed_date: oldestSourceAccessed,
			newest_source_accessed_date: newestSourceAccessed,
		});
	}

	perRecord.sort((a, b) => (b.last_verified_age_days ?? -1) - (a.last_verified_age_days ?? -1));

	const ages = perRecord.map((r) => r.last_verified_age_days).filter((d) => d !== null);
	const report = {
		generated_at: now.toISOString(),
		stale_threshold_days: STALE_THRESHOLD_DAYS,
		ready_record_count: perRecord.length,
		stale_count: perRecord.filter((r) => r.is_stale).length,
		oldest_last_verified_age_days: ages.length ? Math.max(...ages) : null,
		newest_last_verified_age_days: ages.length ? Math.min(...ages) : null,
		records: perRecord,
	};

	await writeFile(OUT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");

	if (process.argv.includes("--json")) {
		console.log(JSON.stringify(report, null, 2));
	} else {
		console.log(`READY records checked: ${report.ready_record_count}`);
		console.log(`Stale (last_verified > ${STALE_THRESHOLD_DAYS} days ago): ${report.stale_count}`);
		console.log(`Oldest last_verified age: ${report.oldest_last_verified_age_days} days`);
		console.log(`Newest last_verified age: ${report.newest_last_verified_age_days} days`);
		if (report.stale_count > 0) {
			console.log("\nStale records:");
			for (const r of perRecord.filter((r) => r.is_stale)) {
				console.log(`  ${r.city} (${r.record_id}): last verified ${r.last_verified}, ${r.last_verified_age_days} days ago`);
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
