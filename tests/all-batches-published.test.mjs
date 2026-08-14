// Cross-batch publication regression guard, added at the end of the
// California locality-expansion campaign (San Gabriel Valley, Inland
// Empire, Orange County, two Peninsula batches, Sacramento region, and
// Central Valley). Unlike tests/netlify-redirects.test.mjs (which only
// checks that existing generated pages have a matching redirect),
// this file walks every output/*-evaluation.json batch file directly and
// asserts the two directions that actually matter for correctness:
//   1. every record marked READY has a public page, a netlify.toml
//      redirect, and is wired into all three shared aggregator files
//      (the guide index, search, and the layout's cross-link list) —
//      so a READY record can never silently fail to publish; and
//   2. every record marked LIMITED or NOT_READY has NO public page —
//      so a non-READY record can never accidentally leak into production.
// Runs entirely offline against checked-in JSON and .astro source text (no
// live build, no network) so it stays fast and deterministic.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const OUTPUT_DIR = path.join(REPO_ROOT, "output");
const LOCALITIES_DIR = path.join(REPO_ROOT, "data", "localities");
const NETLIFY_TOML_PATH = path.join(REPO_ROOT, "netlify.toml");

// Mirrors src/lib/state-meta.ts's STATE_META — kept as a separate literal
// here for the same isolation reason scripts/generate-locality-pages.mjs's
// own STATE_SLUGS documents. Every state a READY record can exist for must
// be registered here, or this file's own assertions (rather than a build
// failure) will catch the gap first.
const STATE_SLUGS = {
	CA: "california", RI: "rhode-island", DE: "delaware", VT: "vermont",
	CO: "colorado", AZ: "arizona", HI: "hawaii", OR: "oregon", NM: "new-mexico",
	NV: "nevada", IL: "illinois", NJ: "new-jersey", UT: "utah", MD: "maryland",
	VA: "virginia",
	NC: "north-carolina",
	SC: "south-carolina",
	GA: "georgia",
	WI: "wisconsin",
	MN: "minnesota",
	CT: "connecticut",
	MA: "massachusetts",
	NH: "new-hampshire",
	ME: "maine",
	MI: "michigan",
	WA: "washington",
	ID: "idaho",
	FL: "florida",
	KY: "kentucky",
	IN: "indiana",
	TN: "tennessee",
	LA: "louisiana",
	OH: "ohio",
	PA: "pennsylvania",
	AK: "alaska",
	NY: "new-york",
	WV: "west-virginia",
	OK: "oklahoma",
	TX: "texas",
	MS: "mississippi",
	AR: "arkansas",
	AL: "alabama",
};

const AGGREGATOR_FILES = [
	path.join(REPO_ROOT, "src", "pages", "california", "solar-permit-guides.astro"),
	path.join(REPO_ROOT, "src", "pages", "search.astro"),
	path.join(REPO_ROOT, "src", "layouts", "LocalityGuideLayout.astro"),
	path.join(REPO_ROOT, "src", "pages", "[state]", "index.astro"),
];

function evaluationFileNames() {
	return readdirSync(OUTPUT_DIR).filter((f) => f.endsWith("-evaluation.json"));
}

function loadAllEvaluatedRecords() {
	const all = [];
	for (const file of evaluationFileNames()) {
		const evaluation = JSON.parse(readFileSync(path.join(OUTPUT_DIR, file), "utf8"));
		for (const record of evaluation.records) {
			all.push({ evaluationFile: file, ...record });
		}
	}
	return all;
}

function localityRecordFor(recordId) {
	return JSON.parse(readFileSync(path.join(LOCALITIES_DIR, `${recordId}.json`), "utf8"));
}

function citySlugFor(recordId) {
	const record = localityRecordFor(recordId);
	// Mirrors scripts/generate-locality-pages.mjs's own slugify(): strip
	// diacritics (so "San José" slugs to "san-jose", not "san-jos"), then
	// strip every non-alphanumeric run (not just whitespace) so names like
	// "St. Helena" slug to "st-helena", matching the folder the generator
	// actually writes.
	return record.city.value
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

// Every locality record carries explicit state identity (schema v1.4.0+) —
// the page's state-prefixed path is derived from the record's own `state`,
// never assumed to be California. See src/lib/state-meta.ts.
function stateSlugFor(recordId) {
	const record = localityRecordFor(recordId);
	const slug = STATE_SLUGS[record.state];
	assert.ok(slug, `record_id "${recordId}" has unrecognized state "${record.state}" — register it in STATE_SLUGS at the top of this test file`);
	return slug;
}

function pageFileFor(stateSlug, citySlug) {
	return path.join(REPO_ROOT, "src", "pages", stateSlug, citySlug, "solar-permit-guide.astro");
}

// Every aggregator file loads output/*-evaluation.json via import.meta.glob
// rather than one hardcoded import per batch file, so a new batch's
// evaluation file is picked up automatically with no wiring step to forget.
// Accepts either relative-depth variant ("../../../output/..." from
// src/pages/california/*.astro, or "../../output/..." from
// src/pages/search.astro and src/layouts/LocalityGuideLayout.astro).
const EVALUATION_GLOB_PATTERN = /import\.meta\.glob\(\s*["'](?:\.\.\/)+output\/\*-evaluation\.json["']/;

const allRecords = loadAllEvaluatedRecords();
const readyRecords = allRecords.filter((r) => r.readiness === "READY");
const nonReadyRecords = allRecords.filter((r) => r.readiness !== "READY");
const aggregatorSources = new Map(AGGREGATOR_FILES.map((f) => [f, readFileSync(f, "utf8")]));

test("at least one batch evaluation file exists and contains at least one READY record", () => {
	assert.ok(evaluationFileNames().length > 0, "expected at least one output/*-evaluation.json file");
	assert.ok(readyRecords.length > 0, "expected at least one READY record across all batches");
});

test("every READY record has a generated public page", () => {
	for (const r of readyRecords) {
		const stateSlug = stateSlugFor(r.record_id);
		const citySlug = citySlugFor(r.record_id);
		assert.ok(
			existsSync(pageFileFor(stateSlug, citySlug)),
			`${r.record_id} (${r.city}) is READY in ${r.evaluationFile} but has no page at src/pages/${stateSlug}/${citySlug}/solar-permit-guide.astro`,
		);
	}
});

test("every READY record has a matching netlify.toml redirect", () => {
	const netlifyToml = readFileSync(NETLIFY_TOML_PATH, "utf8");
	for (const r of readyRecords) {
		const stateSlug = stateSlugFor(r.record_id);
		const citySlug = citySlugFor(r.record_id);
		const fromLine = `from = "/${stateSlug}/${citySlug}/"`;
		const toLine = `to = "/${stateSlug}/${citySlug}/solar-permit-guide/"`;
		assert.ok(
			netlifyToml.includes(fromLine) && netlifyToml.includes(toLine),
			`${r.record_id} (${r.city}) is READY but netlify.toml has no redirect for /${stateSlug}/${citySlug}/`,
		);
	}
});

test("every aggregator file loads every output/*-evaluation.json via glob (not a hardcoded per-batch import)", () => {
	// A glob-based invariant is strictly stronger than checking each current
	// file is named explicitly: it guarantees any *future* batch evaluation
	// file is automatically included too, with no wiring step to forget.
	for (const [aggregatorPath, source] of aggregatorSources) {
		assert.ok(
			EVALUATION_GLOB_PATTERN.test(source),
			`${path.relative(REPO_ROOT, aggregatorPath)} does not glob-import output/*-evaluation.json — a new batch's evaluation file could silently fail to be included`,
		);
		assert.ok(
			/\.flatMap\(\s*\(mod\)\s*=>\s*mod\.default\.records\s*\)/.test(source),
			`${path.relative(REPO_ROOT, aggregatorPath)} globs the evaluation files but never flattens .records from every module into allEvaluatedRecords`,
		);
	}
});

test("every LIMITED or NOT_READY record has NO generated public page", () => {
	for (const r of nonReadyRecords) {
		const stateSlug = stateSlugFor(r.record_id);
		const citySlug = citySlugFor(r.record_id);
		assert.ok(
			!existsSync(pageFileFor(stateSlug, citySlug)),
			`${r.record_id} (${r.city}) is ${r.readiness} in ${r.evaluationFile} but a page exists at src/pages/${stateSlug}/${citySlug}/solar-permit-guide.astro — a non-READY record must never be published`,
		);
	}
});
