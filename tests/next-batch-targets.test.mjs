// Schema/config validation tests for data/next-batch-targets.json (the
// proposed next collection batch — see docs/NEXT_BATCH_PLAN.md). This batch
// has not been collected: these tests only check the target list itself is
// well-formed, meets the requested utility mix, and passes the existing
// naming-validation pipeline (scripts/collect-pilot.mjs --dry-run) — they
// never trigger real collection.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const TARGETS_PATH = path.join(REPO_ROOT, "data", "next-batch-targets.json");
const PILOT_TARGETS_PATH = path.join(REPO_ROOT, "data", "pilot-targets.json");
const COLLECT_SCRIPT = path.join(REPO_ROOT, "scripts", "collect-pilot.mjs");
const LOCALITIES_DIR = path.join(REPO_ROOT, "data", "localities");
const REAL_RUNS_DIR = path.join(REPO_ROOT, "output", "pilot-runs");

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function loadTargets(targetsPath) {
	return JSON.parse(readFileSync(targetsPath, "utf8")).targets;
}

const targets = loadTargets(TARGETS_PATH);
const existingTargets = loadTargets(PILOT_TARGETS_PATH);

test("data/next-batch-targets.json parses as valid JSON with a targets array", () => {
	assert.ok(Array.isArray(targets));
});

test("the batch contains exactly 10 targets", () => {
	assert.equal(targets.length, 10);
});

test("every target has all required fields", () => {
	const requiredFields = [
		"utility",
		"utility_slug",
		"city",
		"county",
		"state",
		"state_code",
		"record_id",
		"locality_file",
		"source_payload_file",
		"utility_verification",
	];
	for (const target of targets) {
		for (const field of requiredFields) {
			assert.ok(
				field in target && target[field] !== null && target[field] !== undefined,
				`target ${target.record_id ?? JSON.stringify(target)} is missing required field '${field}'`,
			);
		}
	}
});

test("every slug and record_id is lowercase kebab-case", () => {
	for (const target of targets) {
		for (const field of ["utility_slug", "city_slug", "county_slug", "record_id"]) {
			assert.match(
				target[field],
				KEBAB_CASE,
				`target ${target.record_id}'s '${field}' value '${target[field]}' is not lowercase kebab-case`,
			);
		}
	}
});

test("utility mix meets the minimums: >=3 PG&E, >=3 SCE, >=2 SDG&E, >=2 municipal", () => {
	const counts = { pge: 0, sce: 0, sdge: 0, municipal: 0 };
	const municipalSlugs = new Set(["ladwp", "amp"]);
	for (const target of targets) {
		if (target.utility_slug === "pge") counts.pge += 1;
		else if (target.utility_slug === "sce") counts.sce += 1;
		else if (target.utility_slug === "sdge") counts.sdge += 1;
		else if (municipalSlugs.has(target.utility_slug)) counts.municipal += 1;
	}
	assert.ok(counts.pge >= 3, `expected >=3 PG&E targets, got ${counts.pge}`);
	assert.ok(counts.sce >= 3, `expected >=3 SCE targets, got ${counts.sce}`);
	assert.ok(counts.sdge >= 2, `expected >=2 SDG&E targets, got ${counts.sdge}`);
	assert.ok(counts.municipal >= 2, `expected >=2 municipal-utility targets, got ${counts.municipal}`);
});

test("no target city duplicates a city already collected in the existing pilot batch", () => {
	const existingCities = new Set(existingTargets.map((t) => t.city_slug));
	for (const target of targets) {
		assert.ok(
			!existingCities.has(target.city_slug),
			`target city_slug '${target.city_slug}' (${target.city}) was already collected in data/pilot-targets.json`,
		);
	}
});

test("no record_id in the batch collides with an already-collected record_id", () => {
	const existingIds = new Set(existingTargets.map((t) => t.record_id));
	for (const target of targets) {
		assert.ok(!existingIds.has(target.record_id), `record_id '${target.record_id}' collides with an existing pilot record`);
	}
});

test("record_ids within the batch are all unique", () => {
	const ids = targets.map((t) => t.record_id);
	assert.equal(new Set(ids).size, ids.length);
});

test("every target's utility_verification status is 'confirmed', never left unverified", () => {
	for (const target of targets) {
		assert.equal(
			target.utility_verification.status,
			"confirmed",
			`target ${target.record_id} has utility_verification.status '${target.utility_verification.status}', expected 'confirmed'`,
		);
		assert.ok(target.utility_verification.evidence?.length > 0, `target ${target.record_id} has no evidence entries`);
		for (const e of target.utility_verification.evidence) {
			assert.ok(e.source_url?.startsWith("http"), `target ${target.record_id} evidence has no valid source_url`);
			assert.ok(e.claim, `target ${target.record_id} evidence has no claim`);
		}
	}
});

// Updated once collection actually happened (all 10 targets were collected
// in this session) — this now asserts the collected records' basic
// integrity instead of asserting they don't exist yet.
test("every target's locality file exists on disk and is a valid, matching record", () => {
	for (const target of targets) {
		const localityPath = path.join(REPO_ROOT, target.locality_file);
		assert.ok(existsSync(localityPath), `${target.locality_file} should exist — this batch has been collected`);
		const record = JSON.parse(readFileSync(localityPath, "utf8"));
		assert.equal(record.record_id, target.record_id);
		assert.equal(record.schema_version, "1.3.0");
	}
});

// Computed fresh from output/next-batch-evaluation.json rather than a
// hardcoded list — this batch's READY set grows over time as more of its
// records clear the READY bar, so a literal list needs updating (and goes
// stale) every time that happens.
const NEXT_BATCH_EVALUATION_PATH = path.join(REPO_ROOT, "output", "next-batch-evaluation.json");
const nextBatchEvaluation = JSON.parse(readFileSync(NEXT_BATCH_EVALUATION_PATH, "utf8"));
const readyRecordIds = new Set(
	nextBatchEvaluation.records.filter((r) => r.readiness === "READY").map((r) => r.record_id),
);
const READY_CITY_SLUGS = new Set(
	targets.filter((t) => readyRecordIds.has(t.record_id)).map((t) => t.city_slug),
);

test("a public page exists only for this batch's READY records, and only those", () => {
	for (const target of targets) {
		const pageFile = path.join(REPO_ROOT, "src", "pages", "california", target.city_slug, "solar-permit-guide.astro");
		if (READY_CITY_SLUGS.has(target.city_slug)) {
			assert.ok(existsSync(pageFile), `${pageFile} should exist — ${target.city_slug} is READY`);
		} else {
			assert.equal(existsSync(pageFile), false, `${pageFile} should not exist — ${target.city_slug} is not READY yet`);
		}
	}
});

// --- Full naming-validation dry-run against the real pipeline --------------

test("scripts/collect-pilot.mjs --dry-run against the next batch reports all 10 targets as naming-valid, with no CONFIG_ERROR, and creates no files", () => {
	const beforeLocalities = existsSync(LOCALITIES_DIR) ? readdirSync(LOCALITIES_DIR).sort() : null;
	const beforeRuns = existsSync(REAL_RUNS_DIR) ? readdirSync(REAL_RUNS_DIR).sort() : null;

	const result = spawnSync("node", [COLLECT_SCRIPT, "--dry-run"], {
		cwd: REPO_ROOT,
		encoding: "utf8",
		env: { ...process.env, PILOT_TARGETS_PATH: TARGETS_PATH },
	});

	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /DRY RUN/);
	assert.doesNotMatch(result.stdout, /planned outcome: CONFIG_ERROR/, "no batch target should fail naming validation");

	for (const target of targets) {
		assert.match(result.stdout, new RegExp(target.record_id), `dry-run output should mention ${target.record_id}`);
	}

	const afterLocalities = existsSync(LOCALITIES_DIR) ? readdirSync(LOCALITIES_DIR).sort() : null;
	const afterRuns = existsSync(REAL_RUNS_DIR) ? readdirSync(REAL_RUNS_DIR).sort() : null;
	assert.deepEqual(afterLocalities, beforeLocalities, "dry-run against the next batch must not touch data/localities/");
	assert.deepEqual(afterRuns, beforeRuns, "dry-run against the next batch must not touch output/pilot-runs/");
});
