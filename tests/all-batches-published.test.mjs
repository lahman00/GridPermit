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
const CALIFORNIA_PAGES_DIR = path.join(REPO_ROOT, "src", "pages", "california");
const NETLIFY_TOML_PATH = path.join(REPO_ROOT, "netlify.toml");

const AGGREGATOR_FILES = [
	path.join(REPO_ROOT, "src", "pages", "california", "solar-permit-guides.astro"),
	path.join(REPO_ROOT, "src", "pages", "search.astro"),
	path.join(REPO_ROOT, "src", "layouts", "LocalityGuideLayout.astro"),
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

function citySlugFor(recordId) {
	const record = JSON.parse(readFileSync(path.join(LOCALITIES_DIR, `${recordId}.json`), "utf8"));
	return record.city.value.toLowerCase().replace(/\s+/g, "-");
}

// Mirrors the import-name convention every aggregator file already uses:
// "central-valley-batch-evaluation.json" -> "centralValleyBatchEvaluation".
function importVariableNameFor(evaluationFileName) {
	const base = evaluationFileName.replace(/\.json$/, "");
	return base.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function pageFileFor(citySlug) {
	return path.join(CALIFORNIA_PAGES_DIR, citySlug, "solar-permit-guide.astro");
}

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
		const slug = citySlugFor(r.record_id);
		assert.ok(
			existsSync(pageFileFor(slug)),
			`${r.record_id} (${r.city}) is READY in ${r.evaluationFile} but has no page at src/pages/california/${slug}/solar-permit-guide.astro`,
		);
	}
});

test("every READY record has a matching netlify.toml redirect", () => {
	const netlifyToml = readFileSync(NETLIFY_TOML_PATH, "utf8");
	for (const r of readyRecords) {
		const slug = citySlugFor(r.record_id);
		const fromLine = `from = "/california/${slug}/"`;
		const toLine = `to = "/california/${slug}/solar-permit-guide/"`;
		assert.ok(
			netlifyToml.includes(fromLine) && netlifyToml.includes(toLine),
			`${r.record_id} (${r.city}) is READY but netlify.toml has no redirect for /california/${slug}/`,
		);
	}
});

test("every batch evaluation file containing a READY record is imported and spread into allEvaluatedRecords in every aggregator file", () => {
	const filesWithReadyRecords = new Set(readyRecords.map((r) => r.evaluationFile));
	for (const file of filesWithReadyRecords) {
		const varName = importVariableNameFor(file);
		for (const [aggregatorPath, source] of aggregatorSources) {
			assert.ok(
				source.includes(`"../../../output/${file}"`) || source.includes(`"../../output/${file}"`),
				`${path.relative(REPO_ROOT, aggregatorPath)} does not import ${file} (needed because it contains READY records)`,
			);
			assert.ok(
				new RegExp(`\\.\\.\\.${varName}\\.records\\b`).test(source),
				`${path.relative(REPO_ROOT, aggregatorPath)} imports ${file} but never spreads ...${varName}.records into allEvaluatedRecords`,
			);
		}
	}
});

test("every LIMITED or NOT_READY record has NO generated public page", () => {
	for (const r of nonReadyRecords) {
		const slug = citySlugFor(r.record_id);
		assert.ok(
			!existsSync(pageFileFor(slug)),
			`${r.record_id} (${r.city}) is ${r.readiness} in ${r.evaluationFile} but a page exists at src/pages/california/${slug}/solar-permit-guide.astro — a non-READY record must never be published`,
		);
	}
});
