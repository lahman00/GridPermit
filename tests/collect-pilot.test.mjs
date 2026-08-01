// Lightweight tests for scripts/collect-pilot.mjs. Uses only Node's built-in
// test runner (node:test) and assert — no new dependency required.
//
// Run with: npm test  (== node --test tests/*.test.mjs)

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const SCRIPT = path.join(REPO_ROOT, "scripts", "collect-pilot.mjs");
const REAL_TARGETS_PATH = path.join(REPO_ROOT, "data", "pilot-targets.json");
const REAL_LOCALITIES_DIR = path.join(REPO_ROOT, "data", "localities");
const REAL_RUNS_DIR = path.join(REPO_ROOT, "output", "pilot-runs");
// scripts/validate-record.mjs (out of this task's scope to modify) has no
// output-path override, so any test that lets a target reach the "write +
// validate" step causes it to write a report here using the fixture's
// record_id as the filename. Those tests must delete their own stray report.
const REAL_VALIDATION_REPORTS_DIR = path.join(REPO_ROOT, "output", "validation-reports");

function snapshotDir(dir) {
  return existsSync(dir) ? readdirSync(dir).sort() : null;
}

function runCLI(args, envOverrides = {}) {
  const result = spawnSync("node", [SCRIPT, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, ...envOverrides },
  });
  return result;
}

function makeTmpFixture() {
  const dir = mkdtempSync(path.join(tmpdir(), "gridpermit-pilot-test-"));
  const localitiesDir = path.join(dir, "localities");
  const payloadsDir = path.join(dir, "payloads");
  const runsDir = path.join(dir, "runs");
  mkdirSync(localitiesDir, { recursive: true });
  mkdirSync(payloadsDir, { recursive: true });
  mkdirSync(runsDir, { recursive: true });
  return { dir, localitiesDir, payloadsDir, runsDir };
}

// county/city display names deliberately have no " County" suffix or
// multi-word ambiguity, so their slug is an unambiguous, direct lowercase of
// the name — record_id is then derived the same way collect-pilot.mjs
// derives it, so a fixture's record_id can never drift out of sync with its
// own slugs the way a hand-typed literal could.
function makeTarget({ localitiesDir, payloadsDir, utilitySlug = "pge", citySlug = "fixturecity", countySlug = "fixturecounty" }) {
  const recordId = ["ca", countySlug, citySlug, utilitySlug].join("-");
  return {
    state: "California",
    state_code: "ca",
    utility: "Fixture Utility",
    utility_slug: utilitySlug,
    city: citySlug,
    city_slug: citySlug,
    county: countySlug,
    county_slug: countySlug,
    record_id: recordId,
    locality_file: path.join(localitiesDir, `${recordId}.json`),
    source_payload_file: path.join(payloadsDir, `${recordId}.json`),
  };
}

function writeTargetsFile(fixtureDir, targets) {
  const p = path.join(fixtureDir, "pilot-targets.json");
  writeFileSync(p, JSON.stringify({ targets }, null, 2));
  return p;
}

// --- 1. dry-run creates no files -------------------------------------------

test("dry-run against the real repo config creates no files", () => {
  const before = {
    localities: snapshotDir(REAL_LOCALITIES_DIR),
    runs: snapshotDir(REAL_RUNS_DIR),
  };

  const result = runCLI(["--dry-run"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /DRY RUN/);

  const after = {
    localities: snapshotDir(REAL_LOCALITIES_DIR),
    runs: snapshotDir(REAL_RUNS_DIR),
  };
  assert.deepEqual(after.localities, before.localities, "data/localities/ must be unchanged by --dry-run");
  assert.deepEqual(after.runs, before.runs, "output/pilot-runs/ must be unchanged by --dry-run");
});

// --- 2. importing the module creates no files ------------------------------

test("importing collect-pilot.mjs as a module runs nothing", async () => {
  const before = {
    localities: snapshotDir(REAL_LOCALITIES_DIR),
    runs: snapshotDir(REAL_RUNS_DIR),
  };

  const mod = await import("../scripts/collect-pilot.mjs");
  assert.equal(typeof mod.main, "function", "main should be exported for programmatic/test use");

  const after = {
    localities: snapshotDir(REAL_LOCALITIES_DIR),
    runs: snapshotDir(REAL_RUNS_DIR),
  };
  assert.deepEqual(after.localities, before.localities, "importing must not touch data/localities/");
  assert.deepEqual(after.runs, before.runs, "importing must not create output/pilot-runs/");
});

// --- 3. CONFIG_ERROR exits 1 -----------------------------------------------

test("a target with invalid naming produces CONFIG_ERROR and exit code 1", () => {
  const { dir, localitiesDir, payloadsDir, runsDir } = makeTmpFixture();
  try {
    const badTarget = makeTarget({ localitiesDir, payloadsDir, utilitySlug: "PGE_Bad!" });
    const targetsPath = writeTargetsFile(dir, [badTarget]);

    const result = runCLI([], { PILOT_TARGETS_PATH: targetsPath, PILOT_RUNS_DIR: runsDir });
    assert.equal(result.status, 1, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.results[0].status, "CONFIG_ERROR");
    assert.equal(report.summary.config_error, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- 4. unknown --force record exits 1 -------------------------------------

test("--force with an unknown record_id exits 1 with a CONFIG_ERROR entry", () => {
  const { dir, localitiesDir, payloadsDir, runsDir } = makeTmpFixture();
  try {
    const target = makeTarget({ localitiesDir, payloadsDir });
    const targetsPath = writeTargetsFile(dir, [target]);

    const result = runCLI(["--force", "ca-does-not-exist-anywhere"], {
      PILOT_TARGETS_PATH: targetsPath,
      PILOT_RUNS_DIR: runsDir,
    });
    assert.equal(result.status, 1, result.stderr);
    const report = JSON.parse(result.stdout);
    const forceEntry = report.results.find((r) => r.record_id === "ca-does-not-exist-anywhere");
    assert.ok(forceEntry, "expected a synthetic result for the unmatched --force record_id");
    assert.equal(forceEntry.status, "CONFIG_ERROR");
    // The one real target should be unaffected by the bogus --force value.
    const realEntry = report.results.find((r) => r.record_id === target.record_id);
    assert.equal(realEntry.status, "COLLECTION_REQUIRED");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- 5. targeted --force affects only one target ---------------------------

test("--force <record_id> overwrites only that record, leaving others untouched", () => {
  const { dir, localitiesDir, payloadsDir, runsDir } = makeTmpFixture();
  try {
    const targetA = makeTarget({ localitiesDir, payloadsDir, citySlug: "alpha" });
    const targetB = makeTarget({ localitiesDir, payloadsDir, citySlug: "beta" });
    const targetsPath = writeTargetsFile(dir, [targetA, targetB]);

    // Pre-seed both localities as already "existing" with distinguishable content.
    writeFileSync(targetA.locality_file, JSON.stringify({ record_id: targetA.record_id, marker: "original-A" }));
    writeFileSync(targetB.locality_file, JSON.stringify({ record_id: targetB.record_id, marker: "original-B" }));

    // Only target A gets a source payload, so only forcing A can do anything.
    writeFileSync(targetA.source_payload_file, JSON.stringify({ record_id: targetA.record_id, marker: "overwritten-A" }));

    const result = runCLI(["--force", targetA.record_id], {
      PILOT_TARGETS_PATH: targetsPath,
      PILOT_RUNS_DIR: runsDir,
    });
    // Non-zero is fine here (the fixture payload isn't schema-valid, so the
    // chained validator will report FAIL) — what this test checks is the
    // overwrite/skip behavior itself, not full schema validity.
    const report = JSON.parse(result.stdout);

    const contentA = JSON.parse(readFileSync(targetA.locality_file, "utf8"));
    const contentB = JSON.parse(readFileSync(targetB.locality_file, "utf8"));

    assert.equal(contentA.marker, "overwritten-A", "forced target's locality file should be overwritten with the payload");
    assert.equal(contentB.marker, "original-B", "non-forced target's locality file must remain untouched");

    const resultB = report.results.find((r) => r.record_id === targetB.record_id);
    assert.equal(resultB.status, "SKIPPED_EXISTS", "non-forced existing target must be SKIPPED_EXISTS");

    // targetA reached validate-record.mjs, which writes its report to the
    // real output/validation-reports/ (no override exists for that path) —
    // clean up the stray file this test caused there.
    rmSync(path.join(REAL_VALIDATION_REPORTS_DIR, `${targetA.record_id}.json`), { force: true });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- 6. normal COLLECTION_REQUIRED run exits 0 ------------------------------

test("a run with no payloads and no existing records is COLLECTION_REQUIRED and exits 0", () => {
  const { dir, localitiesDir, payloadsDir, runsDir } = makeTmpFixture();
  try {
    const target = makeTarget({ localitiesDir, payloadsDir });
    const targetsPath = writeTargetsFile(dir, [target]);

    const result = runCLI([], { PILOT_TARGETS_PATH: targetsPath, PILOT_RUNS_DIR: runsDir });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.results[0].status, "COLLECTION_REQUIRED");
    assert.equal(report.summary.collection_required, 1);
    assert.ok(existsSync(runsDir), "a run summary directory should exist");
    assert.equal(readdirSync(runsDir).length, 1, "exactly one run summary file should have been written");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
