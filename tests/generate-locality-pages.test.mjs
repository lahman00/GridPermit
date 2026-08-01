// Lightweight tests for scripts/generate-locality-pages.mjs. Uses only
// Node's built-in test runner (node:test) and assert — no new dependency
// required. Mirrors the fixture/isolation conventions in
// tests/collect-pilot.test.mjs.
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
const SCRIPT = path.join(REPO_ROOT, "scripts", "generate-locality-pages.mjs");
const REAL_PAGES_ROOT = path.join(REPO_ROOT, "src", "pages", "california");
const REAL_LAYOUT_PATH = path.join(REPO_ROOT, "src", "layouts", "LocalityGuideLayout.astro");

function snapshotTree(dir) {
  if (!existsSync(dir)) return null;
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...snapshotTree(full).map((f) => path.join(entry.name, f)));
    else out.push(entry.name);
  }
  return out;
}

function runCLI(args, envOverrides = {}) {
  return spawnSync("node", [SCRIPT, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, ...envOverrides },
  });
}

function makeFixture() {
  const dir = mkdtempSync(path.join(tmpdir(), "gridpermit-locality-pages-test-"));
  const localitiesDir = path.join(dir, "localities");
  const pagesRoot = path.join(dir, "pages-california");
  mkdirSync(localitiesDir, { recursive: true });
  mkdirSync(pagesRoot, { recursive: true });
  return { dir, localitiesDir, pagesRoot };
}

function writeLocality(localitiesDir, recordId, cityValue) {
  const record = { record_id: recordId, city: { value: cityValue }, schema_version: "1.3.0" };
  writeFileSync(path.join(localitiesDir, `${recordId}.json`), JSON.stringify(record, null, 2));
  return record;
}

function writeEvaluation(dir, readyRecordIds, limitedRecordIds = []) {
  const evalPath = path.join(dir, "pilot-evaluation.json");
  const records = [
    ...readyRecordIds.map((record_id) => ({ record_id, readiness: "READY" })),
    ...limitedRecordIds.map((record_id) => ({ record_id, readiness: "LIMITED" })),
  ];
  writeFileSync(evalPath, JSON.stringify({ records }, null, 2));
  return evalPath;
}

function fixtureEnv({ localitiesDir, evaluationPath, pagesRoot }) {
  return {
    LOCALITY_PAGES_LOCALITIES_DIR: localitiesDir,
    LOCALITY_PAGES_EVALUATION_PATH: evaluationPath,
    LOCALITY_PAGES_OUTPUT_ROOT: pagesRoot,
    LOCALITY_PAGES_LAYOUT_PATH: REAL_LAYOUT_PATH,
  };
}

// --- 1. dry-run writes nothing ---------------------------------------------

test("dry-run against the real repo config creates no files", () => {
  const before = snapshotTree(REAL_PAGES_ROOT);
  const result = runCLI(["--dry-run"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /DRY RUN/);
  const after = snapshotTree(REAL_PAGES_ROOT);
  assert.deepEqual(after, before, "src/pages/california/ must be unchanged by --dry-run");
});

test("no-flags default behaves like --dry-run and writes nothing", () => {
  const before = snapshotTree(REAL_PAGES_ROOT);
  const result = runCLI([]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /DRY RUN/);
  const after = snapshotTree(REAL_PAGES_ROOT);
  assert.deepEqual(after, before, "no-flag default must be dry-run and write nothing");
});

test("importing generate-locality-pages.mjs as a module runs nothing", async () => {
  const before = snapshotTree(REAL_PAGES_ROOT);
  const mod = await import("../scripts/generate-locality-pages.mjs");
  assert.equal(typeof mod.main, "function", "main should be exported for programmatic/test use");
  const after = snapshotTree(REAL_PAGES_ROOT);
  assert.deepEqual(after, before, "importing must not touch src/pages/california/");
});

// --- 2. READY records are planned, LIMITED records are excluded ------------

test("READY records are planned and LIMITED records are excluded from generation", () => {
  const { dir, localitiesDir, pagesRoot } = makeFixture();
  try {
    writeLocality(localitiesDir, "ca-fixture-readycity-pge", "ReadyCity");
    writeLocality(localitiesDir, "ca-fixture-limitedcity-pge", "LimitedCity");
    const evaluationPath = writeEvaluation(dir, ["ca-fixture-readycity-pge"], ["ca-fixture-limitedcity-pge"]);

    const result = runCLI(["--dry-run"], fixtureEnv({ localitiesDir, evaluationPath, pagesRoot }));
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ca-fixture-readycity-pge[\s\S]*?planned outcome: PLANNED —/);
    assert.match(result.stdout, /ca-fixture-limitedcity-pge[\s\S]*?planned outcome: SKIPPED_NOT_READY/);

    assert.equal(existsSync(path.join(pagesRoot, "readycity", "solar-permit-guide.astro")), false, "dry-run must not write");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("--write creates pages only for READY records, skipping LIMITED ones entirely", () => {
  const { dir, localitiesDir, pagesRoot } = makeFixture();
  try {
    writeLocality(localitiesDir, "ca-fixture-readycity-pge", "ReadyCity");
    writeLocality(localitiesDir, "ca-fixture-limitedcity-pge", "LimitedCity");
    const evaluationPath = writeEvaluation(dir, ["ca-fixture-readycity-pge"], ["ca-fixture-limitedcity-pge"]);

    const result = runCLI(["--write"], fixtureEnv({ localitiesDir, evaluationPath, pagesRoot }));
    assert.equal(result.status, 0, result.stderr);

    assert.ok(existsSync(path.join(pagesRoot, "readycity", "solar-permit-guide.astro")), "READY record's page should be created");
    assert.equal(
      existsSync(path.join(pagesRoot, "limitedcity", "solar-permit-guide.astro")),
      false,
      "LIMITED record must never get a generated page",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- 3. Oakland (or any existing page) is skipped, not overwritten ---------

test("a READY record whose page already exists is skipped, not regenerated, without --force", () => {
  const { dir, localitiesDir, pagesRoot } = makeFixture();
  try {
    writeLocality(localitiesDir, "ca-fixture-existingcity-pge", "ExistingCity");
    const evaluationPath = writeEvaluation(dir, ["ca-fixture-existingcity-pge"]);

    const cityDir = path.join(pagesRoot, "existingcity");
    mkdirSync(cityDir, { recursive: true });
    const pageFile = path.join(cityDir, "solar-permit-guide.astro");
    writeFileSync(pageFile, "ORIGINAL HAND-EDITED CONTENT\n");

    const result = runCLI(["--write"], fixtureEnv({ localitiesDir, evaluationPath, pagesRoot }));
    assert.equal(result.status, 0, result.stderr);

    assert.equal(readFileSync(pageFile, "utf8"), "ORIGINAL HAND-EDITED CONTENT\n", "existing page must not be overwritten without --force");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the real Oakland page is reported SKIPPED_EXISTS by the real repo's dry-run", () => {
  const result = runCLI(["--dry-run"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /ca-alameda-oakland-pge[\s\S]*?planned outcome: SKIPPED_EXISTS/,
    "Oakland's page already exists in the real repo and must be reported as skipped, not planned for (re)creation",
  );
});

// --- 4. generated wrapper content -------------------------------------------

test("a generated wrapper imports the correct locality JSON and passes an explicit cityPath", () => {
  const { dir, localitiesDir, pagesRoot } = makeFixture();
  try {
    writeLocality(localitiesDir, "ca-fixture-newcity-pge", "New City");
    const evaluationPath = writeEvaluation(dir, ["ca-fixture-newcity-pge"]);

    const result = runCLI(["--write"], fixtureEnv({ localitiesDir, evaluationPath, pagesRoot }));
    assert.equal(result.status, 0, result.stderr);

    const pageFile = path.join(pagesRoot, "new-city", "solar-permit-guide.astro");
    assert.ok(existsSync(pageFile), "expected a generated page at the slugified city directory");
    const content = readFileSync(pageFile, "utf8");

    // Imports the correct JSON record — a relative path that actually
    // resolves to the fixture's locality file, not a hardcoded guess.
    assert.match(content, /import record from "([^"]+)";/);
    const jsonImportMatch = content.match(/import record from "([^"]+)";/);
    const resolvedJsonPath = path.resolve(path.dirname(pageFile), jsonImportMatch[1]);
    assert.equal(resolvedJsonPath, path.join(localitiesDir, "ca-fixture-newcity-pge.json"));

    // Uses the shared layout, not duplicated markup.
    assert.match(content, /import LocalityGuideLayout from "[^"]+";/);
    assert.doesNotMatch(content, /<html/, "generated wrapper must not duplicate layout markup");
    assert.doesNotMatch(content, /New City/, "generated wrapper must contain no hardcoded locality fact");

    // Passes an explicit cityPath, not something the layout has to guess.
    assert.match(content, /const CITY_PATH = "\/california\/new-city\/";/);
    assert.match(content, /const PAGE_PATH = "\/california\/new-city\/solar-permit-guide\/";/);
    assert.match(content, /cityPath=\{CITY_PATH\}/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- 5. --force behavior -----------------------------------------------

test("unknown --force record_id exits 1 in --write mode", () => {
  const { dir, localitiesDir, pagesRoot } = makeFixture();
  try {
    writeLocality(localitiesDir, "ca-fixture-onlyone-pge", "Only One");
    const evaluationPath = writeEvaluation(dir, ["ca-fixture-onlyone-pge"]);

    const result = runCLI(
      ["--write", "--force", "ca-does-not-exist-anywhere"],
      fixtureEnv({ localitiesDir, evaluationPath, pagesRoot }),
    );
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /--force ca-does-not-exist-anywhere does not match any locality record_id/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("unknown --force record_id in --dry-run mode only warns and still exits 0", () => {
  const { dir, localitiesDir, pagesRoot } = makeFixture();
  try {
    writeLocality(localitiesDir, "ca-fixture-onlyone-pge", "Only One");
    const evaluationPath = writeEvaluation(dir, ["ca-fixture-onlyone-pge"]);

    const result = runCLI(
      ["--dry-run", "--force", "ca-does-not-exist-anywhere"],
      fixtureEnv({ localitiesDir, evaluationPath, pagesRoot }),
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /WARNING: --force ca-does-not-exist-anywhere does not match/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("targeted --force regenerates only the named record, leaving other existing pages untouched", () => {
  const { dir, localitiesDir, pagesRoot } = makeFixture();
  try {
    writeLocality(localitiesDir, "ca-fixture-alpha-pge", "Alpha");
    writeLocality(localitiesDir, "ca-fixture-beta-pge", "Beta");
    const evaluationPath = writeEvaluation(dir, ["ca-fixture-alpha-pge", "ca-fixture-beta-pge"]);

    const alphaDir = path.join(pagesRoot, "alpha");
    const betaDir = path.join(pagesRoot, "beta");
    mkdirSync(alphaDir, { recursive: true });
    mkdirSync(betaDir, { recursive: true });
    const alphaFile = path.join(alphaDir, "solar-permit-guide.astro");
    const betaFile = path.join(betaDir, "solar-permit-guide.astro");
    writeFileSync(alphaFile, "ORIGINAL ALPHA\n");
    writeFileSync(betaFile, "ORIGINAL BETA\n");

    const result = runCLI(
      ["--write", "--force", "ca-fixture-alpha-pge"],
      fixtureEnv({ localitiesDir, evaluationPath, pagesRoot }),
    );
    assert.equal(result.status, 0, result.stderr);

    assert.notEqual(readFileSync(alphaFile, "utf8"), "ORIGINAL ALPHA\n", "forced record's page should be regenerated");
    assert.match(readFileSync(alphaFile, "utf8"), /ca-fixture-alpha-pge/);
    assert.equal(readFileSync(betaFile, "utf8"), "ORIGINAL BETA\n", "non-forced existing page must remain untouched");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("--force without a record_id argument is a usage error, not a silent force-all", () => {
  const { dir, localitiesDir, pagesRoot } = makeFixture();
  try {
    writeLocality(localitiesDir, "ca-fixture-onlyone-pge", "Only One");
    const evaluationPath = writeEvaluation(dir, ["ca-fixture-onlyone-pge"]);

    const result = runCLI(["--write", "--force"], fixtureEnv({ localitiesDir, evaluationPath, pagesRoot }));
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /--force requires a record_id argument/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
