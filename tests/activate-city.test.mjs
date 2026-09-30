// Lightweight tests for scripts/activate-city.mjs. Uses only Node's
// built-in test runner (node:test) and assert — no new dependency required.
// Mirrors the fixture/isolation conventions in tests/collect-pilot.test.mjs
// and tests/generate-locality-pages.test.mjs (ACTIVATE_CITY_* env-var
// overrides instead of touching real repo files).
//
// Run with: npm test  (== node --test tests/*.test.mjs)

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const SCRIPT = path.join(REPO_ROOT, "scripts", "activate-city.mjs");
const REAL_COMPARE_SOLAR_PRICES_PATH = path.join(REPO_ROOT, "src", "lib", "compare-solar-prices.ts");

function runCLI(args, envOverrides = {}) {
	return spawnSync("node", [SCRIPT, ...args], {
		cwd: REPO_ROOT,
		encoding: "utf8",
		env: { ...process.env, ...envOverrides },
	});
}

// --- fixture tree ------------------------------------------------------------
//
// A self-contained fixture tree: its own localities dir, its own
// compare-solar-prices.ts stand-in (only the one exported piece this tool
// actually reads/writes — the array literal — needs to match the real
// file's shape), and its own pages/california root. The REAL
// src/lib/utility-split-guard.ts is still imported directly (it's pure logic
// over a record's own fields, nothing to fake), so this also exercises the
// real gate, not a reimplementation of it.

const COMPARE_SOLAR_PRICES_STUB_HEADER = `// Fixture stand-in for src/lib/compare-solar-prices.ts — only the one export
// scripts/activate-city.mjs actually reads/writes needs to be present here.
export function normalizeCompareSolarCitySlug(city) {
	return city
		.trim()
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\\u0300-\\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

`;

function writeComparePricesFixture(comparePricesPath, servedSlugs) {
	const body = servedSlugs.map((s) => `\t"${s}",`).join("\n");
	const content = `${COMPARE_SOLAR_PRICES_STUB_HEADER}export const COMPARE_SOLAR_SERVED_CITY_SLUGS = new Set([\n${body}\n]);\n`;
	writeFileSync(comparePricesPath, content, "utf8");
}

function writeLocality(localitiesDir, recordId, { city, state = "CA", utilityValue = "Fixture Electric Co.", utilityNotes = undefined }) {
	const record = {
		record_id: recordId,
		schema_version: "1.4.0",
		state,
		utility: { value: utilityValue, confidence: 0.9, source_ids: ["S1"], ...(utilityNotes ? { notes: utilityNotes } : {}) },
		city: { value: city, confidence: 1, source_ids: ["S1"] },
	};
	writeFileSync(path.join(localitiesDir, `${recordId}.json`), JSON.stringify(record, null, 2));
	return record;
}

function writePage(pagesRoot, slug) {
	mkdirSync(path.join(pagesRoot, slug), { recursive: true });
	writeFileSync(path.join(pagesRoot, slug, "solar-permit-guide.astro"), "<!-- fixture page -->\n");
}

function makeFixture() {
	const dir = mkdtempSync(path.join(tmpdir(), "gridpermit-activate-city-test-"));
	const localitiesDir = path.join(dir, "localities");
	const pagesRoot = path.join(dir, "pages-california");
	const comparePricesPath = path.join(dir, "compare-solar-prices.ts");
	mkdirSync(localitiesDir, { recursive: true });
	mkdirSync(pagesRoot, { recursive: true });
	return { dir, localitiesDir, pagesRoot, comparePricesPath };
}

function fixtureEnv({ localitiesDir, comparePricesPath, pagesRoot }) {
	return {
		ACTIVATE_CITY_LOCALITIES_DIR: localitiesDir,
		ACTIVATE_CITY_COMPARE_SOLAR_PRICES_PATH: comparePricesPath,
		ACTIVATE_CITY_PAGES_ROOT: pagesRoot,
	};
}

// --- 1. importing the module runs nothing -----------------------------------

test("importing activate-city.mjs as a module runs nothing", async () => {
	const before = statSync(REAL_COMPARE_SOLAR_PRICES_PATH).mtimeMs;
	const before2 = readFileSync(REAL_COMPARE_SOLAR_PRICES_PATH, "utf8");
	const mod = await import("../scripts/activate-city.mjs");
	assert.equal(typeof mod.main, "function", "main should be exported for programmatic/test use");
	assert.equal(statSync(REAL_COMPARE_SOLAR_PRICES_PATH).mtimeMs, before, "import must not touch src/lib/compare-solar-prices.ts");
	assert.equal(readFileSync(REAL_COMPARE_SOLAR_PRICES_PATH, "utf8"), before2);
});

// --- 2. a real, currently-eligible-but-not-yet-active city -------------------
//
// Berkeley (data/localities/ca-alameda-berkeley-pge.json) is a real,
// well-formed, unambiguous-utility (PG&E) California locality record with a
// real page at src/pages/california/berkeley/solar-permit-guide.astro, and
// as of this writing is NOT in COMPARE_SOLAR_SERVED_CITY_SLUGS. It is used
// here read-only (--check, --dry-run against the REAL repo paths) — never
// applied against the real file. The full apply path is instead proven
// against the synthetic fixture tree in the tests below, so a future
// activation of Berkeley itself can never invalidate this suite.

test("a real eligible-but-not-yet-active city (Berkeley) passes every gate on --check against the real repo", () => {
	const result = runCLI(["--check", "berkeley"]);
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /\[PASS\] record-found/);
	assert.match(result.stdout, /\[PASS\] utility-unambiguous/);
	assert.match(result.stdout, /\[PASS\] not-already-active/);
	assert.match(result.stdout, /\[PASS\] page-exists/);
	assert.match(result.stdout, /=> ELIGIBLE/);
	const report = JSON.parse(result.stdout.slice(result.stdout.indexOf("{")));
	assert.equal(report.rows[0].eligible, true);
});

test("--apply on a synthetic eligible city actually inserts it, sorted, into the fixture allowlist", () => {
	const fx = makeFixture();
	try {
		writeComparePricesFixture(fx.comparePricesPath, ["alpha-city", "zeta-city"]);
		writeLocality(fx.localitiesDir, "ca-fixture-midcity-pge", { city: "Mid City" });
		writePage(fx.pagesRoot, "mid-city");

		const before = readFileSync(fx.comparePricesPath, "utf8");
		const result = runCLI(["--apply", "mid-city"], fixtureEnv(fx));
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /APPLIED/);

		const after = readFileSync(fx.comparePricesPath, "utf8");
		assert.notEqual(after, before);
		assert.match(after, /"alpha-city",\s*\n\s*"mid-city",\s*\n\s*"zeta-city",/, "mid-city must be inserted in alphabetically sorted position");

		const report = JSON.parse(result.stdout.slice(result.stdout.indexOf("{")));
		assert.equal(report.rows[0].applied, true);
	} finally {
		rmSync(fx.dir, { recursive: true, force: true });
	}
});

// --- 3. Mission Viejo: a real, genuine utility-split-ambiguity refusal ------

test("Mission Viejo (real genuine SCE/SDG&E utility-split ambiguity) is refused, never applied, on --check", () => {
	const result = runCLI(["--check", "mission-viejo"]);
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /\[FAIL\] utility-unambiguous/);
	assert.match(result.stdout, /split/i);
	assert.match(result.stdout, /=> NOT ELIGIBLE/);
});

test("Mission Viejo is refused on --apply against the real repo and the real file is never written", () => {
	const before = readFileSync(REAL_COMPARE_SOLAR_PRICES_PATH, "utf8");
	const result = runCLI(["--apply", "mission-viejo"]);
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /REFUSED/);
	const after = readFileSync(REAL_COMPARE_SOLAR_PRICES_PATH, "utf8");
	assert.equal(after, before, "the real compare-solar-prices.ts must be byte-for-byte unchanged");
	const report = JSON.parse(result.stdout.slice(result.stdout.indexOf("{")));
	assert.equal(report.rows[0].eligible, false);
	assert.equal(report.rows[0].applied, false);
});

test("a synthetic utility-split-ambiguity record (record_id ending in -multi) is refused on --apply", () => {
	const fx = makeFixture();
	try {
		writeComparePricesFixture(fx.comparePricesPath, ["alpha-city"]);
		writeLocality(fx.localitiesDir, "ca-fixture-splitcity-multi", { city: "Split City", utilityValue: null });
		writePage(fx.pagesRoot, "split-city");

		const before = readFileSync(fx.comparePricesPath, "utf8");
		const result = runCLI(["--apply", "split-city"], fixtureEnv(fx));
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /REFUSED/);
		assert.match(result.stdout, /\[FAIL\] utility-unambiguous/);
		assert.equal(readFileSync(fx.comparePricesPath, "utf8"), before, "fixture allowlist file must be unchanged");
	} finally {
		rmSync(fx.dir, { recursive: true, force: true });
	}
});

// --- 4. a nonexistent city slug ----------------------------------------------

test("a nonexistent city slug is refused with a clear reason on --check", () => {
	const result = runCLI(["--check", "totally-fake-city-that-does-not-exist"]);
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /\[FAIL\] record-found/);
	assert.match(result.stdout, /No California locality record/);
	assert.match(result.stdout, /=> NOT ELIGIBLE/);
});

test("a nonexistent city slug is refused on --apply and writes nothing", () => {
	const fx = makeFixture();
	try {
		writeComparePricesFixture(fx.comparePricesPath, ["alpha-city"]);
		const before = readFileSync(fx.comparePricesPath, "utf8");
		const result = runCLI(["--apply", "totally-fake-city"], fixtureEnv(fx));
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /REFUSED/);
		assert.equal(readFileSync(fx.comparePricesPath, "utf8"), before);
	} finally {
		rmSync(fx.dir, { recursive: true, force: true });
	}
});

// --- 5. a city slug already in the allowlist ---------------------------------

test("a city slug already in the allowlist is refused as already-active on --check", () => {
	const fx = makeFixture();
	try {
		writeComparePricesFixture(fx.comparePricesPath, ["already-active-city"]);
		writeLocality(fx.localitiesDir, "ca-fixture-alreadyactivecity-pge", { city: "Already Active City" });
		writePage(fx.pagesRoot, "already-active-city");

		const result = runCLI(["--check", "already-active-city"], fixtureEnv(fx));
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /\[FAIL\] not-already-active/);
		assert.match(result.stdout, /already active/);
		assert.match(result.stdout, /=> NOT ELIGIBLE/);
	} finally {
		rmSync(fx.dir, { recursive: true, force: true });
	}
});

test("a city slug already in the allowlist is refused on --apply and the array is untouched", () => {
	const fx = makeFixture();
	try {
		writeComparePricesFixture(fx.comparePricesPath, ["already-active-city", "zeta-city"]);
		writeLocality(fx.localitiesDir, "ca-fixture-alreadyactivecity-pge", { city: "Already Active City" });
		writePage(fx.pagesRoot, "already-active-city");

		const before = readFileSync(fx.comparePricesPath, "utf8");
		const result = runCLI(["--apply", "already-active-city"], fixtureEnv(fx));
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /REFUSED/);
		assert.equal(readFileSync(fx.comparePricesPath, "utf8"), before, "already-active city must never be re-applied/re-inserted");
	} finally {
		rmSync(fx.dir, { recursive: true, force: true });
	}
});

// --- 6. missing locality-guide page ------------------------------------------

test("an otherwise-eligible city with no locality guide page is refused", () => {
	const fx = makeFixture();
	try {
		writeComparePricesFixture(fx.comparePricesPath, ["alpha-city"]);
		writeLocality(fx.localitiesDir, "ca-fixture-nopagecity-pge", { city: "No Page City" });
		// deliberately never call writePage() for this city

		const result = runCLI(["--check", "no-page-city"], fixtureEnv(fx));
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /\[FAIL\] page-exists/);
		assert.match(result.stdout, /=> NOT ELIGIBLE/);
	} finally {
		rmSync(fx.dir, { recursive: true, force: true });
	}
});

// --- 7. batch mode: mixed valid/invalid rows, independent per-row results ---

test("batch --check with a mix of valid and invalid rows reports each row independently", () => {
	const fx = makeFixture();
	try {
		writeComparePricesFixture(fx.comparePricesPath, ["already-active-city"]);
		writeLocality(fx.localitiesDir, "ca-fixture-goodcity-pge", { city: "Good City" });
		writePage(fx.pagesRoot, "good-city");
		writeLocality(fx.localitiesDir, "ca-fixture-splitcity-pge", { city: "Split City", utilityNotes: "This city is split between two providers." });
		writePage(fx.pagesRoot, "split-city");
		writeLocality(fx.localitiesDir, "ca-fixture-alreadyactivecity-pge", { city: "Already Active City" });
		writePage(fx.pagesRoot, "already-active-city");

		const csvPath = path.join(fx.dir, "batch.csv");
		writeFileSync(csvPath, "city_slug\ngood-city\nsplit-city\nnonexistent-row-city\nalready-active-city\n");

		const result = runCLI(["--check", "--csv", csvPath], fixtureEnv(fx));
		assert.equal(result.status, 0, result.stderr);

		const report = JSON.parse(result.stdout.slice(result.stdout.indexOf("{")));
		assert.equal(report.rows.length, 4, "one bad/ineligible row must not remove other rows from the batch");

		const byInput = Object.fromEntries(report.rows.map((r) => [r.input, r]));
		assert.equal(byInput["good-city"].eligible, true);
		assert.equal(byInput["split-city"].eligible, false);
		assert.equal(byInput["nonexistent-row-city"].eligible, false);
		assert.equal(byInput["already-active-city"].eligible, false);
	} finally {
		rmSync(fx.dir, { recursive: true, force: true });
	}
});

test("batch --apply activates only the eligible rows and leaves the others out, independently", () => {
	const fx = makeFixture();
	try {
		writeComparePricesFixture(fx.comparePricesPath, ["already-active-city"]);
		writeLocality(fx.localitiesDir, "ca-fixture-goodcitya-pge", { city: "Good City A" });
		writePage(fx.pagesRoot, "good-city-a");
		writeLocality(fx.localitiesDir, "ca-fixture-goodcityb-pge", { city: "Good City B" });
		writePage(fx.pagesRoot, "good-city-b");
		writeLocality(fx.localitiesDir, "ca-fixture-splitcity-pge", { city: "Split City", utilityNotes: "This city is split between two providers." });
		writePage(fx.pagesRoot, "split-city");

		const csvPath = path.join(fx.dir, "batch.csv");
		writeFileSync(csvPath, "city_slug\ngood-city-a\nsplit-city\nnonexistent-row-city\nalready-active-city\ngood-city-b\n");

		const result = runCLI(["--apply", "--csv", csvPath], fixtureEnv(fx));
		assert.equal(result.status, 0, result.stderr);

		const finalText = readFileSync(fx.comparePricesPath, "utf8");
		assert.match(finalText, /"good-city-a"/);
		assert.match(finalText, /"good-city-b"/);
		assert.equal(finalText.includes('"split-city"'), false);
		assert.equal(finalText.includes('"nonexistent-row-city"'), false);
		// already-active-city was pre-existing, so it should still appear exactly once
		assert.equal(finalText.split('"already-active-city"').length - 1, 1);

		const report = JSON.parse(result.stdout.slice(result.stdout.indexOf("{")));
		const byInput = Object.fromEntries(report.rows.map((r) => [r.input, r]));
		assert.equal(byInput["good-city-a"].applied, true);
		assert.equal(byInput["good-city-b"].applied, true);
		assert.equal(byInput["split-city"].applied, false);
		assert.equal(byInput["nonexistent-row-city"].applied, false);
		assert.equal(byInput["already-active-city"].applied, false);
	} finally {
		rmSync(fx.dir, { recursive: true, force: true });
	}
});

// --- 8. dry-run never modifies any file --------------------------------------

test("--dry-run against the real repo modifies nothing (content and mtime both unchanged)", () => {
	const statBefore = statSync(REAL_COMPARE_SOLAR_PRICES_PATH);
	const contentBefore = readFileSync(REAL_COMPARE_SOLAR_PRICES_PATH, "utf8");

	const result = runCLI(["--dry-run", "berkeley"]);
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /DRY RUN/);
	assert.match(result.stdout, /old array length: \d+/);
	assert.match(result.stdout, /new array length: \d+/);
	assert.match(result.stdout, /insert position: index \d+/);

	const statAfter = statSync(REAL_COMPARE_SOLAR_PRICES_PATH);
	const contentAfter = readFileSync(REAL_COMPARE_SOLAR_PRICES_PATH, "utf8");
	assert.equal(statAfter.mtimeMs, statBefore.mtimeMs, "mtime must be unchanged after --dry-run");
	assert.equal(contentAfter, contentBefore, "content must be byte-for-byte unchanged after --dry-run");
});

test("--dry-run on a synthetic fixture writes nothing (content and mtime both unchanged)", () => {
	const fx = makeFixture();
	try {
		writeComparePricesFixture(fx.comparePricesPath, ["alpha-city", "zeta-city"]);
		writeLocality(fx.localitiesDir, "ca-fixture-midcity-pge", { city: "Mid City" });
		writePage(fx.pagesRoot, "mid-city");

		const statBefore = statSync(fx.comparePricesPath);
		const contentBefore = readFileSync(fx.comparePricesPath, "utf8");

		const result = runCLI(["--dry-run", "mid-city"], fixtureEnv(fx));
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /old array length: 2/);
		assert.match(result.stdout, /new array length: 3/);

		const statAfter = statSync(fx.comparePricesPath);
		const contentAfter = readFileSync(fx.comparePricesPath, "utf8");
		assert.equal(statAfter.mtimeMs, statBefore.mtimeMs);
		assert.equal(contentAfter, contentBefore);
	} finally {
		rmSync(fx.dir, { recursive: true, force: true });
	}
});

// --- 9. CLI usage errors -------------------------------------------------------

test("no mode flag is a usage error, not a silent no-op", () => {
	const result = runCLI(["berkeley"]);
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Exactly one of --check, --dry-run, --apply is required/);
});

test("providing both a positional slug and --csv is a usage error", () => {
	const fx = makeFixture();
	try {
		const csvPath = path.join(fx.dir, "batch.csv");
		writeFileSync(csvPath, "city_slug\nberkeley\n");
		const result = runCLI(["--check", "berkeley", "--csv", csvPath]);
		assert.equal(result.status, 1);
		assert.match(result.stderr, /not both/);
	} finally {
		rmSync(fx.dir, { recursive: true, force: true });
	}
});
