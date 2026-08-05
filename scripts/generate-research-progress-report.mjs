#!/usr/bin/env node
// Deterministic research-progress report for the California
// locality-expansion campaign (San Gabriel Valley, Inland Empire, Orange
// County, two Peninsula batches, Sacramento region, and Central Valley).
// Reads every output/*-evaluation.json batch file and every
// data/localities/*.json record (does not re-run collection or validation
// itself) and produces one report listing every investigated locality by
// readiness (READY / LIMITED / NOT_READY), plus the localities that were
// investigated but blocked and never got a record at all. Read-only on
// output/ and data/localities/ — only ever writes
// output/research-progress-report.json.
//
// Usage: node scripts/generate-research-progress-report.mjs

import { readFile, writeFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const OUTPUT_DIR = path.join(REPO_ROOT, "output");
const LOCALITIES_DIR = path.join(REPO_ROOT, "data", "localities");
const OUT_PATH = path.join(OUTPUT_DIR, "research-progress-report.json");

// Cities explicitly investigated this campaign but blocked on every official
// source attempted, so no data/localities/ record was ever created for them.
// Kept here (rather than inferred) since there is no record file to derive
// this list from — this is the one manually-maintained list in this script.
const INVESTIGATED_BUT_BLOCKED = [
	{
		city: "South Pasadena",
		batch: "San Gabriel Valley",
		reason: "A fee schedule figure was found only via search-result synthesis, never via direct fetch (southpasadenaca.gov returned HTTP 403 on both the fee PDF and the Building Division page on every attempt). Per the rule against using search snippets as evidence, no record was created.",
	},
	{
		city: "Claremont",
		batch: "Inland Empire",
		reason: "claremontca.gov returned HTTP 403 on every attempt (including the bare domain root), ecode360.com (host of the city's expedited-solar-permitting municipal code chapter) returned HTTP 403, and qcode.us's Claremont municipal-code mirror redirects to the same blocked ecode360 host. No record was created.",
	},
];

const BATCHES = [
	{ name: "San Gabriel Valley", evaluationFile: "san-gabriel-valley-batch-evaluation.json" },
	{ name: "Inland Empire", evaluationFile: "inland-empire-batch-evaluation.json" },
	{ name: "Orange County", evaluationFile: "orange-county-batch-evaluation.json" },
	{ name: "Peninsula (second batch)", evaluationFile: "peninsula-batch-2-evaluation.json" },
	{ name: "Sacramento region", evaluationFile: "sacramento-region-batch-evaluation.json" },
	{ name: "Central Valley", evaluationFile: "central-valley-batch-evaluation.json" },
];

function loadAllRecordIds() {
	return new Set(
		readdirSync(LOCALITIES_DIR)
			.filter((f) => f.endsWith(".json"))
			.map((f) => f.replace(".json", "")),
	);
}

async function loadBatch(batch) {
	const evalPath = path.join(OUTPUT_DIR, batch.evaluationFile);
	const evaluation = JSON.parse(await readFile(evalPath, "utf8"));
	return {
		batch: batch.name,
		evaluation_file: batch.evaluationFile,
		evaluated_at: evaluation.evaluated_at,
		record_count: evaluation.record_count,
		ready: evaluation.records.filter((r) => r.readiness === "READY").map((r) => ({ record_id: r.record_id, city: r.city, county: r.county, completeness_pct: r.completeness_pct, validation_score: r.validation_score })),
		limited: evaluation.records.filter((r) => r.readiness === "LIMITED").map((r) => ({ record_id: r.record_id, city: r.city, county: r.county, completeness_pct: r.completeness_pct, validation_score: r.validation_score })),
		not_ready: evaluation.records.filter((r) => r.readiness === "NOT_READY").map((r) => ({ record_id: r.record_id, city: r.city, county: r.county, completeness_pct: r.completeness_pct, validation_score: r.validation_score })),
	};
}

async function main() {
	const allRecordIds = loadAllRecordIds();
	const batches = [];
	for (const b of BATCHES) {
		batches.push(await loadBatch(b));
	}

	// Sanity check: every record referenced by a batch evaluation must exist
	// on disk, and every record in this campaign's batches must appear in
	// exactly one batch (no double-counting).
	const seen = new Set();
	for (const b of batches) {
		for (const r of [...b.ready, ...b.limited, ...b.not_ready]) {
			if (!allRecordIds.has(r.record_id)) {
				throw new Error(`${b.batch}: record ${r.record_id} has no file at data/localities/${r.record_id}.json`);
			}
			if (seen.has(r.record_id)) {
				throw new Error(`record ${r.record_id} appears in more than one batch evaluation`);
			}
			seen.add(r.record_id);
		}
	}

	const totalReady = batches.reduce((s, b) => s + b.ready.length, 0);
	const totalLimited = batches.reduce((s, b) => s + b.limited.length, 0);
	const totalNotReady = batches.reduce((s, b) => s + b.not_ready.length, 0);
	const totalInvestigatedWithRecord = totalReady + totalLimited + totalNotReady;
	const totalInvestigated = totalInvestigatedWithRecord + INVESTIGATED_BUT_BLOCKED.length;

	const report = {
		generated_at: new Date().toISOString(),
		summary: {
			batches_completed: batches.length,
			localities_investigated_with_a_record: totalInvestigatedWithRecord,
			localities_investigated_but_blocked_no_record: INVESTIGATED_BUT_BLOCKED.length,
			localities_investigated_total: totalInvestigated,
			ready_count: totalReady,
			limited_count: totalLimited,
			not_ready_count: totalNotReady,
		},
		batches,
		investigated_but_blocked: INVESTIGATED_BUT_BLOCKED,
	};

	await writeFile(OUT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");
	console.log(JSON.stringify(report.summary, null, 2));
	console.error(`\nReport written to ${path.relative(REPO_ROOT, OUT_PATH)}`);
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
	main().catch((err) => {
		console.error("error:", err.stack ?? String(err));
		process.exit(1);
	});
}
