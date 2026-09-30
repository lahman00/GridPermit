#!/usr/bin/env node
// Activation patch generator for CompareSolarPrices California city
// eligibility. This is the ONLY supported way to add a city slug to
// COMPARE_SOLAR_SERVED_CITY_SLUGS in src/lib/compare-solar-prices.ts — that
// Set is the one real runtime gate isCompareSolarServedLocality() reads, so
// hand-editing it risks a typo, a wrong sort position, or (worse) adding a
// city whose own locality record has a genuine multi-utility split (see
// src/lib/utility-split-guard.ts — Mission Viejo is the real example this
// tool must refuse).
//
// This tool never touches data/revenue/compare-solar-production-verified.json
// (that evidence file is a separate, already-flagged, known-stale concern —
// see tests/production-cta-contract.test.mjs) and never runs the test suite
// or build itself. Run `npm test` and `npm run build` yourself after --apply.
//
// Usage:
//   node scripts/activate-city.mjs --check <city-slug>
//   node scripts/activate-city.mjs --dry-run <city-slug>
//   node scripts/activate-city.mjs --apply <city-slug>
//   node scripts/activate-city.mjs --check --csv <path-to-csv>
//   node scripts/activate-city.mjs --dry-run --csv <path-to-csv>
//   node scripts/activate-city.mjs --apply --csv <path-to-csv>
//
// The CSV has one column of city slugs, e.g.:
//   city_slug
//   berkeley
//   oakland
// A "city_slug" / "slug" / "city" header row (case-insensitive) is skipped
// automatically if present; a header-less CSV works too.
//
// Exactly one of --check / --dry-run / --apply is required, and exactly one
// of a positional <city-slug> / --csv <path> is required.
//
// Modes:
//   --check    Report which safety gates pass/fail for each city. No writes.
//   --dry-run  Same gate report, PLUS (only for eligible cities) an exact
//              preview of the array edit --apply would make. No writes.
//   --apply    Re-runs every gate; only writes when ALL of them pass for
//              that city. Never partially applies a single city. A batch
//              run applies each eligible city independently — one city's
//              refusal never blocks another city's activation.
//
// Safety gates (ALL must pass before --apply writes anything for a city):
//   1. record-found        A california state record in data/localities/*.json
//                           whose city, slugified, equals the input exists.
//   2. utility-unambiguous  hasVerifiedUnambiguousUtility(record) is true —
//                           imported directly from src/lib/utility-split-guard.ts,
//                           never reimplemented here.
//   3. not-already-active  The slug is not already in
//                           COMPARE_SOLAR_SERVED_CITY_SLUGS.
//   4. page-exists          src/pages/california/<slug>/solar-permit-guide.astro
//                           exists.
//
// Test isolation: ACTIVATE_CITY_LOCALITIES_DIR, ACTIVATE_CITY_COMPARE_SOLAR_PRICES_PATH
// and ACTIVATE_CITY_PAGES_ROOT override the three real-repo paths this tool
// reads/writes, following the same convention as
// LOCALITY_PAGES_LOCALITIES_DIR etc. in scripts/generate-locality-pages.mjs.
// Real usage never needs to set any of them.
//
// Importing this file (e.g. from a test) runs nothing — see the
// direct-execution guard at the bottom.

import { readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { Script } from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

const LOCALITIES_DIR = process.env.ACTIVATE_CITY_LOCALITIES_DIR
	? path.resolve(process.env.ACTIVATE_CITY_LOCALITIES_DIR)
	: path.join(REPO_ROOT, "data", "localities");
const COMPARE_SOLAR_PRICES_PATH = process.env.ACTIVATE_CITY_COMPARE_SOLAR_PRICES_PATH
	? path.resolve(process.env.ACTIVATE_CITY_COMPARE_SOLAR_PRICES_PATH)
	: path.join(REPO_ROOT, "src", "lib", "compare-solar-prices.ts");
const PAGES_ROOT = process.env.ACTIVATE_CITY_PAGES_ROOT
	? path.resolve(process.env.ACTIVATE_CITY_PAGES_ROOT)
	: path.join(REPO_ROOT, "src", "pages", "california");

// The two real modules this tool reuses rather than reimplements. Both are
// plain .ts files Node's built-in type-stripping imports directly (same as
// every *.test.mjs in this repo) — no build step, no --loader flag needed
// on Node 22.18+/23.6+/24.
const { normalizeCompareSolarCitySlug } = await import("../src/lib/compare-solar-prices.ts");
const { hasVerifiedUnambiguousUtility } = await import("../src/lib/utility-split-guard.ts");

class ActivationError extends Error {}

// --- COMPARE_SOLAR_SERVED_CITY_SLUGS text transform -------------------------
//
// Deliberately NOT a blind find/replace regex. This locates the exact,
// known array-literal shape, extracts every entry through a real per-line
// match (any unrecognized line aborts rather than guesses), and after
// building the replacement text re-validates it two ways: (1) re-running
// the same structural extraction on the new text and (2) compiling
// "[" + body + "]" as a real JS array literal via node:vm so a genuine
// syntax error is caught before anything is written to disk.

const ARRAY_OPEN = "export const COMPARE_SOLAR_SERVED_CITY_SLUGS = new Set([";
const ARRAY_CLOSE = "]);";
const SLUG_LINE_RE = /^"([a-z0-9]+(?:-[a-z0-9]+)*)",?$/;

function locateServedArray(fileText, sourceLabel) {
	const openIdx = fileText.indexOf(ARRAY_OPEN);
	if (openIdx === -1) {
		throw new ActivationError(
			`Could not find "${ARRAY_OPEN}" in ${sourceLabel} — refusing to edit a file whose shape doesn't match what this tool expects. Hand-edit required.`,
		);
	}
	const bodyStart = openIdx + ARRAY_OPEN.length;
	const closeIdx = fileText.indexOf(ARRAY_CLOSE, bodyStart);
	if (closeIdx === -1) {
		throw new ActivationError(
			`Found the start of COMPARE_SOLAR_SERVED_CITY_SLUGS in ${sourceLabel} but no matching "${ARRAY_CLOSE}" after it — refusing to edit. Hand-edit required.`,
		);
	}
	return { bodyStart, closeIdx, body: fileText.slice(bodyStart, closeIdx) };
}

function parseServedSlugs(body, sourceLabel) {
	const lines = body.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
	const slugs = [];
	for (const line of lines) {
		const m = SLUG_LINE_RE.exec(line);
		if (!m) {
			throw new ActivationError(
				`Unexpected line inside COMPARE_SOLAR_SERVED_CITY_SLUGS in ${sourceLabel}: ${JSON.stringify(line)} — refusing to edit an array whose contents don't match the expected one-slug-per-line shape. Hand-edit required.`,
			);
		}
		slugs.push(m[1]);
	}
	return slugs;
}

function serializeServedSlugs(slugs) {
	return "\n" + slugs.map((s) => `\t"${s}",`).join("\n") + "\n";
}

function assertRealJsArraySyntax(body, sourceLabel) {
	try {
		// Compiling (not executing) confirms this is genuinely valid JS array
		// literal syntax — a real engine-level parse check, not a regex guess.
		new Script(`(function () { return [${body}]; })`);
	} catch (err) {
		throw new ActivationError(
			`Rebuilt COMPARE_SOLAR_SERVED_CITY_SLUGS body for ${sourceLabel} failed a real JS syntax check: ${err.message}. Refusing to write.`,
		);
	}
}

function insertSorted(slugs, newSlug) {
	const next = [...slugs];
	let index = 0;
	while (index < next.length && next[index] < newSlug) index++;
	next.splice(index, 0, newSlug);
	return { next, index };
}

async function readServedSlugs(comparePricesPath) {
	const label = path.relative(REPO_ROOT, comparePricesPath);
	let fileText;
	try {
		fileText = await readFile(comparePricesPath, "utf8");
	} catch (err) {
		throw new ActivationError(`Could not read ${label}: ${err.message}`);
	}
	const located = locateServedArray(fileText, label);
	const slugs = parseServedSlugs(located.body, label);
	return { fileText, located, slugs, label };
}

/**
 * Builds and validates the new file text in memory. Never writes anything —
 * callers decide whether/when to persist it. Returns the plan plus the new
 * text so a caller can write it and then independently re-verify from disk.
 */
function planInsertion({ fileText, located, slugs, label }, newSlug) {
	const { next, index } = insertSorted(slugs, newSlug);
	const newBody = serializeServedSlugs(next);
	assertRealJsArraySyntax(newBody, label);
	const newText = fileText.slice(0, located.bodyStart) + newBody + fileText.slice(located.closeIdx);

	// Re-run the exact same structural extraction against the text we are
	// about to write, before writing it, as a second independent check.
	const relocated = locateServedArray(newText, label);
	const reparsed = parseServedSlugs(relocated.body, label);
	if (reparsed.length !== slugs.length + 1 || !reparsed.includes(newSlug)) {
		throw new ActivationError(
			`Internal consistency check failed while building the ${label} edit for "${newSlug}" — refusing to write.`,
		);
	}

	return { newText, oldCount: slugs.length, newCount: reparsed.length, index, neighbors: [next[index - 1] ?? null, next[index + 1] ?? null] };
}

// --- locality record lookup -------------------------------------------------

async function findCaliforniaRecord(slug, localitiesDir) {
	let files;
	try {
		files = await readdir(localitiesDir);
	} catch (err) {
		throw new ActivationError(`Could not read locality records from ${path.relative(REPO_ROOT, localitiesDir) || localitiesDir}: ${err.message}`);
	}
	const matches = [];
	for (const file of files) {
		if (!file.endsWith(".json")) continue;
		const fullPath = path.join(localitiesDir, file);
		let record;
		try {
			record = JSON.parse(await readFile(fullPath, "utf8"));
		} catch {
			continue; // malformed/unrelated JSON in the directory is not this tool's problem
		}
		if (typeof record?.state !== "string" || record.state.toUpperCase() !== "CA") continue;
		if (typeof record?.city?.value !== "string") continue;
		if (normalizeCompareSolarCitySlug(record.city.value) !== slug) continue;
		matches.push({ file, record });
	}
	return matches;
}

function explainUtilityGuardFailure(record) {
	if (!record || typeof record !== "object") return "record is not a well-formed object.";
	if (typeof record.record_id !== "string" || record.record_id.trim().length === 0) {
		return "record is missing a record_id.";
	}
	if (/-multi(?:-|$)/i.test(record.record_id)) {
		return `record_id "${record.record_id}" uses the "-multi" suffix convention, marking it as covering more than one utility.`;
	}
	const value = record.utility?.value;
	if (typeof value !== "string" || value.trim().length === 0) {
		return "utility.value is null/empty — this city's utility was never confirmed for the whole city.";
	}
	const notes = record.utility?.notes;
	if (typeof notes === "string" && /\bgenuinely?\s+split\b|\bis\s+split\s+between\b|\bsplit[\s-]territory\b|\bsplit\s+between\s+two\b/i.test(notes)) {
		return `utility.notes states this city is split between utilities: "${notes.slice(0, 220)}${notes.length > 220 ? "…" : ""}"`;
	}
	return "hasVerifiedUnambiguousUtility() returned false for a reason not covered by this tool's diagnostic messaging — inspect the record directly.";
}

// --- per-city gate evaluation ------------------------------------------------

async function evaluateCity(rawInput, config) {
	const slug = normalizeCompareSolarCitySlug(rawInput);
	const gates = {};

	const matches = await findCaliforniaRecord(slug, config.localitiesDir);
	if (matches.length === 0) {
		gates.recordFound = { pass: false, detail: `No California locality record under ${path.relative(REPO_ROOT, config.localitiesDir) || config.localitiesDir} has a city slugifying to "${slug}".` };
	} else if (matches.length > 1) {
		gates.recordFound = {
			pass: false,
			detail: `${matches.length} locality records slugify to "${slug}" (${matches.map((m) => m.file).join(", ")}) — refusing to guess which one is authoritative.`,
		};
	} else {
		gates.recordFound = { pass: true, detail: matches[0].file };
	}
	const record = matches.length === 1 ? matches[0].record : null;

	if (record) {
		const utilityOk = hasVerifiedUnambiguousUtility(record);
		gates.utilityUnambiguous = utilityOk
			? { pass: true, detail: `utility.value = ${JSON.stringify(record.utility?.value)}` }
			: { pass: false, detail: explainUtilityGuardFailure(record) };
	} else {
		gates.utilityUnambiguous = { pass: false, detail: "cannot evaluate — no single matching locality record." };
	}

	let servedSlugs = [];
	try {
		const served = await readServedSlugs(config.comparePricesPath);
		servedSlugs = served.slugs;
		const already = servedSlugs.includes(slug);
		gates.notAlreadyActive = already
			? { pass: false, detail: `"${slug}" is already in COMPARE_SOLAR_SERVED_CITY_SLUGS — already active, nothing to do.` }
			: { pass: true, detail: "not currently in the allowlist." };
	} catch (err) {
		gates.notAlreadyActive = { pass: false, detail: err.message };
	}

	const pageFile = path.join(config.pagesRoot, slug, "solar-permit-guide.astro");
	const hasPage = existsSync(pageFile);
	gates.pageExists = hasPage
		? { pass: true, detail: path.relative(REPO_ROOT, pageFile) }
		: { pass: false, detail: `${path.relative(REPO_ROOT, pageFile)} does not exist.` };

	const eligible = Object.values(gates).every((g) => g.pass);
	return { input: rawInput, slug, record, gates, eligible, servedSlugs };
}

// --- printing ----------------------------------------------------------------

const GATE_ORDER = ["recordFound", "utilityUnambiguous", "notAlreadyActive", "pageExists"];
const GATE_LABEL = {
	recordFound: "record-found       ",
	utilityUnambiguous: "utility-unambiguous",
	notAlreadyActive: "not-already-active ",
	pageExists: "page-exists         ",
};

function printGateReport(result) {
	console.log(`\n${result.slug === result.input ? result.slug : `${result.input} -> ${result.slug}`}`);
	for (const key of GATE_ORDER) {
		const g = result.gates[key];
		console.log(`  [${g.pass ? "PASS" : "FAIL"}] ${GATE_LABEL[key]}  ${g.detail}`);
	}
	console.log(`  => ${result.eligible ? "ELIGIBLE" : "NOT ELIGIBLE"}`);
}

// A dry-run preview only needs the count/position math, not a real write —
// computed directly here rather than reusing planInsertion's write-oriented
// signature (which builds and syntax-checks real replacement file text).
async function dryRunPreview(result, config) {
	if (!result.eligible) {
		console.log("  DRY RUN: not eligible — no change would be made.");
		return null;
	}
	const served = await readServedSlugs(config.comparePricesPath);
	const { index, next } = insertSorted(served.slugs, result.slug);
	console.log("  DRY RUN — would change:");
	console.log(`    file: ${served.label}`);
	console.log(`    old array length: ${served.slugs.length}`);
	console.log(`    new array length: ${next.length}`);
	console.log(
		`    insert position: index ${index} (between ${index > 0 ? JSON.stringify(next[index - 1]) : "the start of the array"} and ${index < next.length - 1 ? JSON.stringify(next[index + 1]) : "the end of the array"})`,
	);
	console.log("    no file was written.");
	return { file: served.label, oldCount: served.slugs.length, newCount: next.length, index };
}

async function applyCity(result, config) {
	if (!result.eligible) {
		console.log("  REFUSED — not all safety gates passed. No file was written.");
		return { applied: false };
	}
	const served = await readServedSlugs(config.comparePricesPath);
	if (served.slugs.includes(result.slug)) {
		// Re-check at write time in case the file changed between evaluate and apply.
		console.log(`  REFUSED — "${result.slug}" is already in the allowlist as of the moment of writing. No file was written.`);
		return { applied: false };
	}
	const plan = planInsertion(served, result.slug);
	await writeFile(config.comparePricesPath, plan.newText, "utf8");

	// Re-read from disk (not just from memory) to verify the write really
	// landed and still parses as a well-formed array containing the new slug.
	const verifyText = await readFile(config.comparePricesPath, "utf8");
	const verifyLocated = locateServedArray(verifyText, served.label);
	const verifySlugs = parseServedSlugs(verifyLocated.body, served.label);
	if (verifySlugs.length !== plan.newCount || !verifySlugs.includes(result.slug)) {
		throw new ActivationError(
			`Wrote ${served.label} but post-write verification failed (expected ${plan.newCount} entries including "${result.slug}", found ${verifySlugs.length}). Inspect the file manually — do not trust its current state.`,
		);
	}

	console.log("  APPLIED:");
	console.log(`    file: ${served.label}`);
	console.log(`    old array length: ${plan.oldCount} -> new array length: ${plan.newCount}`);
	console.log(`    inserted at index ${plan.index}`);
	console.log("    verified: re-read from disk, new slug present, array well-formed.");
	return { applied: true, file: served.label, oldCount: plan.oldCount, newCount: plan.newCount, index: plan.index };
}

// --- CSV ----------------------------------------------------------------------

function parseCsvSlugs(csvText) {
	const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
	if (lines.length === 0) return [];
	let rows = lines.map((l) => l.split(",")[0].trim().replace(/^"(.*)"$/, "$1").trim());
	if (["city_slug", "slug", "city"].includes(rows[0].toLowerCase())) rows = rows.slice(1);
	return rows.filter((r) => r.length > 0);
}

// --- CLI -----------------------------------------------------------------------

function parseArgs(argv) {
	const modeFlags = ["--check", "--dry-run", "--apply"];
	const modes = argv.filter((a) => modeFlags.includes(a));
	if (modes.length !== 1) {
		throw new ActivationError(`Exactly one of ${modeFlags.join(", ")} is required (got: ${modes.length === 0 ? "none" : modes.join(", ")}).`);
	}
	const mode = modes[0].replace(/^--/, "").replace("-", "");

	const csvIdx = argv.indexOf("--csv");
	let csvPath = null;
	if (csvIdx !== -1) {
		csvPath = argv[csvIdx + 1];
		if (!csvPath) throw new ActivationError("--csv requires a file path argument.");
	}

	const positionals = argv.filter((a, i) => !modeFlags.includes(a) && a !== "--csv" && !(csvIdx !== -1 && i === csvIdx + 1));
	if (csvPath && positionals.length > 0) {
		throw new ActivationError(`Provide either a single city slug or --csv <path>, not both (got extra args: ${positionals.join(", ")}).`);
	}
	if (!csvPath && positionals.length !== 1) {
		throw new ActivationError(`Provide exactly one city slug, or --csv <path> for batch mode (got: ${positionals.length === 0 ? "none" : positionals.join(", ")}).`);
	}

	return { mode, csvPath, citySlug: csvPath ? null : positionals[0] };
}

async function runOne(mode, rawInput, config) {
	const result = await evaluateCity(rawInput, config);
	printGateReport(result);
	if (mode === "check") return { ...result, action: null };
	if (mode === "dryrun") {
		const preview = await dryRunPreview(result, config);
		return { ...result, action: preview };
	}
	if (mode === "apply") {
		const action = await applyCity(result, config);
		return { ...result, action };
	}
	throw new ActivationError(`Unknown mode "${mode}".`);
}

export async function main(argv = process.argv.slice(2)) {
	let parsed;
	try {
		parsed = parseArgs(argv);
	} catch (err) {
		console.error(`error: ${err.message}`);
		console.error("\nUsage: node scripts/activate-city.mjs --check|--dry-run|--apply <city-slug>");
		console.error("       node scripts/activate-city.mjs --check|--dry-run|--apply --csv <path>");
		return 1;
	}

	const config = { localitiesDir: LOCALITIES_DIR, comparePricesPath: COMPARE_SOLAR_PRICES_PATH, pagesRoot: PAGES_ROOT };

	const inputs = parsed.csvPath ? parseCsvSlugs(await readFile(path.resolve(parsed.csvPath), "utf8")) : [parsed.citySlug];
	if (inputs.length === 0) {
		console.error(`error: ${parsed.csvPath} contained no city slugs to process.`);
		return 1;
	}

	console.log(`mode: --${parsed.mode === "dryrun" ? "dry-run" : parsed.mode}${parsed.csvPath ? ` (batch: ${parsed.csvPath}, ${inputs.length} row(s))` : ""}`);

	const rows = [];
	let hadUnexpectedError = false;
	for (const input of inputs) {
		try {
			const row = await runOne(parsed.mode, input, config);
			rows.push({
				input: row.input,
				slug: row.slug,
				eligible: row.eligible,
				applied: row.action?.applied ?? null,
				gates: Object.fromEntries(Object.entries(row.gates).map(([k, v]) => [k, v.pass])),
			});
		} catch (err) {
			hadUnexpectedError = true;
			console.log(`\n${input}\n  ERROR: ${err.message}`);
			rows.push({ input, slug: null, eligible: false, applied: false, error: err.message });
		}
	}

	if (inputs.length > 1) {
		console.log("\n--- batch summary ---");
		for (const r of rows) {
			console.log(`  ${r.input}: ${r.error ? `ERROR (${r.error})` : r.eligible ? (parsed.mode === "apply" ? (r.applied ? "APPLIED" : "ELIGIBLE, NOT APPLIED") : "ELIGIBLE") : "NOT ELIGIBLE"}`);
		}
	}

	console.log("\n" + JSON.stringify({ mode: parsed.mode, rows }, null, 2));

	return hadUnexpectedError ? 1 : 0;
}

// Direct-execution guard: main() only runs when this file is the process's
// entry point, never when it's imported (by a test or anything else).
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
	main()
		.then((code) => process.exit(code))
		.catch((err) => {
			console.error("error:", err.stack ?? String(err));
			process.exit(1);
		});
}
