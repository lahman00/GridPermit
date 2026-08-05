// Tests for scripts/generate-research-progress-report.mjs — the
// deterministic end-of-campaign report listing every investigated locality
// by readiness, plus the ones investigated but blocked with no record.
// Runs the real script against the real repo data (read-only; the script
// itself never writes outside output/research-progress-report.json) so this
// doubles as a consistency check between the report and the batch
// evaluation files it summarizes.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const SCRIPT = path.join(REPO_ROOT, "scripts", "generate-research-progress-report.mjs");
const REPORT_PATH = path.join(REPO_ROOT, "output", "research-progress-report.json");
const OUTPUT_DIR = path.join(REPO_ROOT, "output");

function runScript() {
	return spawnSync("node", [SCRIPT], { cwd: REPO_ROOT, encoding: "utf8" });
}

test("generate-research-progress-report.mjs runs cleanly against the real dataset", () => {
	const result = runScript();
	assert.equal(result.status, 0, result.stderr);
});

test("the report's summary counts match a fresh independent tally of every output/*-evaluation.json file", () => {
	runScript();
	const report = JSON.parse(readFileSync(REPORT_PATH, "utf8"));

	const campaignEvaluationFiles = report.batches.map((b) => b.evaluation_file);
	let ready = 0, limited = 0, notReady = 0;
	for (const file of campaignEvaluationFiles) {
		const evaluation = JSON.parse(readFileSync(path.join(OUTPUT_DIR, file), "utf8"));
		for (const r of evaluation.records) {
			if (r.readiness === "READY") ready++;
			else if (r.readiness === "LIMITED") limited++;
			else notReady++;
		}
	}

	assert.equal(report.summary.ready_count, ready);
	assert.equal(report.summary.limited_count, limited);
	assert.equal(report.summary.not_ready_count, notReady);
	assert.equal(report.summary.localities_investigated_with_a_record, ready + limited + notReady);
});

test("every record listed in the report exists as a real file in data/localities/", () => {
	runScript();
	const report = JSON.parse(readFileSync(REPORT_PATH, "utf8"));
	const realRecordFiles = new Set(readdirSync(path.join(REPO_ROOT, "data", "localities")).filter((f) => f.endsWith(".json")));

	for (const b of report.batches) {
		for (const r of [...b.ready, ...b.limited, ...b.not_ready]) {
			assert.ok(realRecordFiles.has(`${r.record_id}.json`), `${r.record_id} listed in report but has no file in data/localities/`);
		}
	}
});

test("no record_id appears in more than one batch in the report", () => {
	runScript();
	const report = JSON.parse(readFileSync(REPORT_PATH, "utf8"));
	const seen = new Set();
	for (const b of report.batches) {
		for (const r of [...b.ready, ...b.limited, ...b.not_ready]) {
			assert.ok(!seen.has(r.record_id), `${r.record_id} appears in more than one batch`);
			seen.add(r.record_id);
		}
	}
});

test("the report includes the investigated-but-blocked localities with no record", () => {
	runScript();
	const report = JSON.parse(readFileSync(REPORT_PATH, "utf8"));
	assert.ok(report.investigated_but_blocked.length >= 2, "expected at least South Pasadena and Claremont to be listed");
	const cities = report.investigated_but_blocked.map((b) => b.city);
	assert.ok(cities.includes("South Pasadena"));
	assert.ok(cities.includes("Claremont"));
});
