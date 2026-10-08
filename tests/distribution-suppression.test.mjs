import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import {
	SUPPRESSION_KIND_PRECEDENCE,
	buildDistributionRecord,
} from "../scripts/lib/distribution-suppression.mjs";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const CLI_PATH = path.join(REPO_ROOT, "scripts", "distribution-suppression.mjs");
let tempRoot;
let firstDir;
let secondDir;
let pack;

async function readJson(directory, name) {
	return JSON.parse(await readFile(path.join(directory, name), "utf8"));
}

before(async () => {
	tempRoot = await mkdtemp(path.join(os.tmpdir(), "gridpermit-distribution-suppression-"));
	firstDir = path.join(tempRoot, "first");
	secondDir = path.join(tempRoot, "second");
	for (const outputDir of [firstDir, secondDir]) {
		const result = spawnSync(process.execPath, [
			"--experimental-strip-types",
			CLI_PATH,
			"--as-of",
			"2026-08-31",
			"--output-dir",
			outputDir,
		], { cwd: REPO_ROOT, encoding: "utf8" });
		assert.equal(result.status, 0, `pipeline failed:\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
	}
	pack = await readJson(firstDir, "distribution-suppression-pack.json");
});

after(async () => {
	if (tempRoot) await rm(tempRoot, { recursive: true });
});

test("distribution outputs are byte-deterministic and contain no generated timestamp", async () => {
	const firstFiles = (await readdir(firstDir)).sort();
	const secondFiles = (await readdir(secondDir)).sort();
	assert.deepEqual(firstFiles, ["distribution-suppression-pack.csv", "distribution-suppression-pack.json"]);
	assert.deepEqual(firstFiles, secondFiles);
	for (const file of firstFiles) {
		assert.deepEqual(await readFile(path.join(firstDir, file)), await readFile(path.join(secondDir, file)), file);
	}
	assert.ok(!JSON.stringify(pack).includes("generated_at"));
});

test("the report reconciles every locality into a published or suppressed partition", () => {
	assert.equal(pack.summary.record_count, 414);
	assert.equal(pack.records.length, 414);
	assert.equal(pack.summary.published_route_count, 351);
	assert.equal(pack.summary.suppressed_record_count, 63);
	assert.equal(pack.summary.published_route_count + pack.summary.suppressed_record_count, pack.summary.record_count);
	assert.equal(pack.summary.recorded_ready_count, 351);
	assert.equal(pack.summary.recorded_limited_count, 61);
	assert.equal(pack.summary.recorded_not_ready_count, 2);
	// The 2026-10-08 READY refresh added one current, primary-source-backed field
	// to each of nine previously stale published records (Glendale, Banning,
	// Loma Linda, Lodi, Shasta Lake, New Castle County, Ann Arbor, Oklahoma City
	// and Salt Lake City). All nine now recompute at 80% / READY without changing
	// their published route state.
	assert.equal(pack.summary.recomputed_ready_count, 350);
	assert.equal(pack.summary.recomputed_limited_count, 62);
	assert.equal(pack.summary.recomputed_not_ready_count, 2);
	// ca-riverside-corona-multi graduated into this disagreement set once its
	// utility field was properly sourced (was null/genuinely-ambiguous; now a
	// well-sourced majority-provider value per the City of Corona's own GIS
	// map, still correctly blocked from any monetized CTA by
	// src/lib/utility-split-guard.ts, which checks the -multi record_id
	// independent of the value) - its recorded batch evaluation (LIMITED,
	// 73.3%) hasn't caught up to its recomputed state (READY, 80%) yet.
	assert.equal(pack.summary.readiness_disagreement_count, 3);
	assert.equal(pack.summary.published_readiness_disagreement_count, 2);
	// Baldwin Park's completeness also changed (eligibility now sourced to its municipal code).
	// The 2026-10-08 full-content audit adds two published-but-still-READY
	// evaluation drifts: Lemoore recomputes 86.7% -> 80% after an exact solar
	// fee tied to a dead City document was removed, while Petaluma recomputes
	// 80% -> 86.7% after current City SolarAPP+ evidence restored documents and
	// same-day eligibility-path timing. Neither changes readiness.
	assert.equal(pack.summary.evaluation_stale_count, 36);
	assert.equal(pack.summary.published_evaluation_stale_count, 31);
	assert.equal(pack.summary.suppressed_evaluation_stale_count, 5);
});

test("each record carries independent recorded, recomputed, and page signals", () => {
	for (const row of pack.records) {
		assert.match(row.recorded_readiness.evaluation_file, /^output\/.*-evaluation\.json$/);
		assert.ok(["READY", "LIMITED", "NOT_READY"].includes(row.recorded_readiness.status));
		assert.ok(["READY", "LIMITED", "NOT_READY"].includes(row.recomputed_readiness.status));
		assert.equal(typeof row.recomputed_readiness.validation_report_exists, "boolean");
		assert.equal(typeof row.evaluation_drift.stale, "boolean");
		assert.equal(
			row.evaluation_drift.stale,
			row.evaluation_drift.status_changed || row.evaluation_drift.completeness_changed || row.evaluation_drift.score_changed,
		);
		assert.equal(typeof row.page_signal.exists, "boolean");
		assert.match(row.page_signal.path, /^\/.+\/solar-permit-guide\/$/);
	}
	const peninsulaBatchTwo = pack.records.find((row) => row.recorded_readiness.evaluation_file === "output/peninsula-batch-2-evaluation.json");
	assert.ok(peninsulaBatchTwo, "the exact root evaluation glob must include peninsula-batch-2-evaluation.json");
});

test("suppressed rows are safe, actionable, and ordered by the declared tie breakers", () => {
	assert.deepEqual(pack.suppression_kind_precedence, SUPPRESSION_KIND_PRECEDENCE);
	for (const row of pack.suppressed_rows) {
		assert.equal(row.suppressed, true);
		assert.equal(row.page_exists, false);
		assert.equal(row.page_signal.exists, false);
		assert.equal(typeof row.evaluation_drift.stale, "boolean");
		assert.ok(row.unlock_action.length > 0);
		assert.ok(row.suppression_causes.length > 0);
		assert.equal(row.primary_suppression_kind, row.suppression_causes[0]);
	}
	const independentlySorted = [...pack.suppressed_rows].sort(
		(a, b) =>
			a.fields_needed_to_publish - b.fields_needed_to_publish ||
			Number(b.compare_solar_allowlisted) - Number(a.compare_solar_allowlisted) ||
			b.recomputed_readiness.completeness_pct - a.recomputed_readiness.completeness_pct ||
			b.recomputed_readiness.validation_score - a.recomputed_readiness.validation_score ||
			a.record_id.localeCompare(b.record_id),
	);
	assert.deepEqual(pack.suppressed_rows.map((row) => row.record_id), independentlySorted.map((row) => row.record_id));
	assert.deepEqual(
		pack.suppressed_rows.map((row) => row.suppression_rank),
		Array.from({ length: pack.summary.suppressed_record_count }, (_, index) => index + 1),
	);
});

test("field-gap unlock classes and suppression precedence are deterministic", () => {
	// ca-riverside-corona-multi no longer fits this fixture (it's now
	// data-complete - see the readiness_disagreement_count note above) - a
	// still-genuinely-single-field-away record stands in for it.
	const sampleRecord = pack.records.find((row) => row.record_id === "ca-fresno-clovis-pge");
	assert.equal(sampleRecord.fields_needed_to_publish, 1);
	assert.equal(sampleRecord.unlock_class, "single_field");

	const baseRecord = {
		record_id: "ca-example-example-utility",
		state: "CA",
		last_verified: "2026-08-30",
		city: { value: "Example" },
	};
	for (const field of [
		"utility", "generation_supplier", "county", "permit_authority", "permit_url", "interconnection_url",
		"battery_programs", "required_documents", "inspection_steps", "timeline_days", "eligibility_constraints",
		"permit_fees", "rebates", "official_contacts",
	]) baseRecord[field] = { value: null };
	const row = buildDistributionRecord({
		record: baseRecord,
		validation: { score: 10, status: "FAIL", errors: [{ category: "schema" }], warnings: [] },
		validationReportExists: true,
		recordedEvaluation: { readiness: "LIMITED", evaluation_file: "output/example-evaluation.json" },
		pageExists: false,
		pagePath: "/california/example/solar-permit-guide/",
		pageFile: "src/pages/california/example/solar-permit-guide.astro",
	}, { allowlist: new Set(), productionVerified: new Set(), asOf: "2026-08-31" });
	assert.deepEqual(row.suppression_causes, [
		"validation_error_gate",
		"data_completeness_gate",
		"validation_score_gate",
		"stale_evaluation",
	]);
	assert.equal(row.primary_suppression_kind, "validation_error_gate");
	assert.equal(row.unlock_class, "large_gap");
});

test("state and blocking-field summaries expose the empty-hub and research priorities", () => {
	const zeroPublishedStates = pack.summary.states.filter((row) => row.zero_published_routes).map((row) => row.state);
	assert.deepEqual(zeroPublishedStates, ["IN", "KS", "MO", "OH", "SD", "WY"]);
	assert.equal(pack.summary.zero_published_route_state_count, 6);
	assert.deepEqual(pack.summary.blocking_fields.slice(0, 3).map((row) => row.field), [
		"timeline_days",
		"permit_fees",
		"rebates",
	]);
});

test("the current suppressed inventory is completeness-only, while published readiness drift stays visible", () => {
	// ca-riverside-corona-multi is the one deliberate exception now: it's
	// data-complete (fields_needed_to_publish 0) but still suppressed because
	// its recorded batch evaluation is stale, not because of a completeness
	// gate - a genuinely different, valid suppression reason.
	const nonCorona = pack.suppressed_rows.filter((row) => row.record_id !== "ca-riverside-corona-multi");
	assert.equal(nonCorona.every((row) => row.primary_suppression_kind === "data_completeness_gate"), true);
	const corona = pack.suppressed_rows.find((row) => row.record_id === "ca-riverside-corona-multi");
	assert.equal(corona.primary_suppression_kind, "stale_evaluation");
	assert.equal(corona.fields_needed_to_publish, 0);
	assert.equal(Math.min(...pack.suppressed_rows.map((row) => row.recomputed_readiness.validation_score)), 91);
	assert.deepEqual(
		Object.fromEntries([1, 2, 3, 4].map((gap) => [gap, pack.suppressed_rows.filter((row) => row.fields_needed_to_publish === gap).length])),
		{ 1: 23, 2: 16, 3: 10, 4: 11 },
	);
	assert.deepEqual(
		pack.records.filter((row) => row.readiness_disagreement).map((row) => row.record_id),
		[
			"ca-riverside-corona-multi",
			"me-cumberland-southportland-cmp",
			"vt-statewide-vermont-gmp",
		],
	);
	assert.deepEqual(
		pack.suppressed_rows.filter((row) => row.evaluation_drift.stale).map((row) => row.record_id).sort(),
		[
			"ca-monterey-greenfield-pge",
			"ca-placer-rocklin-pge",
			"ca-riverside-corona-multi",
			"ca-shasta-redding-reu",
			"ca-stanislaus-newman-pge",
		],
	);
	for (const row of pack.suppressed_rows.filter((item) => item.evaluation_drift.stale)) {
		assert.ok(row.suppression_causes.includes("stale_evaluation"));
	}
});

test("CompareSolar overlay flags identify the remaining allowlisted suppressed records without reclassifying coverage", () => {
	const allowlisted = pack.suppressed_rows.filter((row) => row.compare_solar_allowlisted);
	assert.deepEqual(allowlisted.map((row) => row.city_slug).sort(), ["corona", "indian-wells", "palm-desert", "rancho-mirage"]);
	assert.equal(allowlisted.every((row) => row.compare_solar_production_verified === false), true);
	assert.equal(pack.suppressed_rows.some((row) => "classification" in row), false);
});
