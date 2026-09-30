#!/usr/bin/env node

import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { stateSlug } from "../src/lib/state-meta.ts";
import {
	READY_COMPLETENESS_PCT,
	READY_POPULATED_FIELD_COUNT,
	READY_VALIDATION_SCORE,
	SUPPRESSION_KIND_PRECEDENCE,
	buildDistributionSuppressionReport,
} from "./lib/distribution-suppression.mjs";
import { COVERAGE_FIELDS, normalizeCitySlug } from "./lib/revenue-intelligence.mjs";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const DEFAULT_OUTPUT_DIR = path.join(REPO_ROOT, "output", "distribution");
const EVALUATION_FILE_SUFFIX = "-evaluation.json";

async function exists(filePath) {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

function parseArgs(argv) {
	let asOf = null;
	let outputDir = DEFAULT_OUTPUT_DIR;
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--as-of") asOf = argv[++index];
		else if (arg === "--output-dir") outputDir = path.resolve(argv[++index]);
		else throw new Error(`Unknown argument: ${arg}`);
		if (!argv[index]) throw new Error(`${arg} requires a value`);
	}
	return { asOf, outputDir };
}

function jsonText(value) {
	return `${JSON.stringify(value, null, 2)}\n`;
}

function csvCell(value) {
	const rendered = Array.isArray(value) || (value && typeof value === "object") ? JSON.stringify(value) : String(value ?? "");
	return /[",\r\n]/.test(rendered) ? `"${rendered.replaceAll('"', '""')}"` : rendered;
}

function toCsv(rows, columns) {
	return `${columns.join(",")}\n${rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")).join("\n")}\n`;
}

function inputHash(entries) {
	const hash = createHash("sha256");
	for (const [name, contents] of [...entries].sort(([a], [b]) => a.localeCompare(b))) {
		hash.update(name);
		hash.update("\0");
		hash.update(contents);
		hash.update("\0");
	}
	return hash.digest("hex");
}

async function main(argv = process.argv.slice(2)) {
	const { asOf: requestedAsOf, outputDir } = parseArgs(argv);
	const trackedInputs = new Map();
	const readTracked = async (filePath) => {
		const raw = await readFile(filePath, "utf8");
		trackedInputs.set(path.relative(REPO_ROOT, filePath), raw);
		return raw;
	};
	const readJson = async (filePath) => JSON.parse(await readTracked(filePath));

	const allowlistDocument = await readJson(path.join(REPO_ROOT, "data", "revenue", "compare-solar-prices-allowlist.json"));
	const productionDocument = await readJson(path.join(REPO_ROOT, "data", "revenue", "compare-solar-production-verified.json"));
	await readTracked(path.join(REPO_ROOT, "src", "lib", "state-meta.ts"));
	const allowlist = new Set(allowlistDocument.city_slugs);
	const productionVerified = new Set(productionDocument.verified_city_slugs);

	const outputRoot = path.join(REPO_ROOT, "output");
	const evaluationFiles = (await readdir(outputRoot))
		.filter((name) => name.endsWith(EVALUATION_FILE_SUFFIX))
		.sort();
	const evaluationsById = new Map();
	for (const file of evaluationFiles) {
		const document = await readJson(path.join(outputRoot, file));
		for (const evaluation of document.records ?? []) {
			if (evaluationsById.has(evaluation.record_id)) {
				throw new Error(`${evaluation.record_id}: duplicate recorded readiness in ${evaluationsById.get(evaluation.record_id).evaluation_file} and ${file}`);
			}
			evaluationsById.set(evaluation.record_id, { ...evaluation, evaluation_file: `output/${file}` });
		}
	}

	const localityDir = path.join(REPO_ROOT, "data", "localities");
	const validationDir = path.join(REPO_ROOT, "output", "validation-reports");
	const localityFiles = (await readdir(localityDir)).filter((name) => name.endsWith(".json")).sort();
	const items = [];
	for (const file of localityFiles) {
		const record = await readJson(path.join(localityDir, file));
		const recordedEvaluation = evaluationsById.get(record.record_id) ?? null;
		const validationPath = path.join(validationDir, file);
		const validationReportExists = await exists(validationPath);
		const validation = validationReportExists
			? await readJson(validationPath)
			: { score: 0, status: "MISSING", errors: [], warnings: [] };
		const citySlug = normalizeCitySlug(record.city?.value);
		const statePath = stateSlug(record.state);
		const pagePath = `/${statePath}/${citySlug}/solar-permit-guide/`;
		const absolutePageFile = path.join(REPO_ROOT, "src", "pages", statePath, citySlug, "solar-permit-guide.astro");
		items.push({
			record,
			validation,
			validationReportExists,
			recordedEvaluation,
			pageExists: await exists(absolutePageFile),
			pagePath,
			pageFile: path.relative(REPO_ROOT, absolutePageFile),
		});
	}
	const unmatchedEvaluations = [...evaluationsById].filter(([recordId]) => !items.some((item) => item.record.record_id === recordId));
	if (unmatchedEvaluations.length > 0) {
		throw new Error(`evaluation records without locality files: ${unmatchedEvaluations.map(([recordId]) => recordId).join(", ")}`);
	}

	const asOf = requestedAsOf ?? items.map((item) => item.record.last_verified).sort().at(-1);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(String(asOf))) {
		throw new Error(`--as-of must be YYYY-MM-DD; received ${JSON.stringify(asOf)}`);
	}
	trackedInputs.set("virtual:analysis-as-of", `${asOf}\n`);
	trackedInputs.set(
		"virtual:existing-locality-page-manifest",
		items.filter((item) => item.pageExists).map((item) => item.pagePath).sort().join("\n"),
	);

	const report = buildDistributionSuppressionReport(items, { allowlist, productionVerified, asOf });
	const document = {
		schema_version: "1.0.0",
		input_sha256: inputHash(trackedInputs),
		as_of: asOf,
		freshness_reference: requestedAsOf ? "explicit --as-of" : "maximum included locality last_verified date",
		purpose: "Auditable local distribution suppression inventory; this is not a production-state assertion.",
		thresholds: {
			ready_completeness_pct: READY_COMPLETENESS_PCT,
			ready_validation_score: READY_VALIDATION_SCORE,
			ready_populated_field_count: READY_POPULATED_FIELD_COUNT,
			total_coverage_field_count: COVERAGE_FIELDS.length,
		},
		suppression_kind_precedence: SUPPRESSION_KIND_PRECEDENCE,
		...report,
	};
	const flatRows = document.suppressed_rows.map((row) => ({
		suppression_rank: row.suppression_rank,
		record_id: row.record_id,
		city: row.city,
		state: row.state,
		page_exists: row.page_signal.exists,
		page_path: row.page_signal.path,
		recorded_readiness: row.recorded_readiness.status,
		recomputed_readiness: row.recomputed_readiness.status,
		readiness_disagreement: row.readiness_disagreement,
		evaluation_stale: row.evaluation_drift.stale,
		primary_suppression_kind: row.primary_suppression_kind,
		suppression_causes: row.suppression_causes,
		unlock_class: row.unlock_class,
		fields_needed_to_publish: row.fields_needed_to_publish,
		completeness_pct: row.recomputed_readiness.completeness_pct,
		validation_score: row.recomputed_readiness.validation_score,
		validation_error_count: row.recomputed_readiness.validation_error_count,
		missing_fields: row.missing_fields,
		compare_solar_allowlisted: row.compare_solar_allowlisted,
		compare_solar_production_verified: row.compare_solar_production_verified,
		last_verified: row.last_verified,
		freshness_age_days: row.freshness_age_days,
		unlock_action: row.unlock_action,
	}));

	await mkdir(outputDir, { recursive: true });
	const outputs = [
		["distribution-suppression-pack.json", jsonText(document)],
		["distribution-suppression-pack.csv", toCsv(flatRows, [
			"suppression_rank", "record_id", "city", "state", "page_exists", "page_path",
			"recorded_readiness", "recomputed_readiness", "readiness_disagreement", "evaluation_stale",
			"primary_suppression_kind", "suppression_causes", "unlock_class", "fields_needed_to_publish",
			"completeness_pct", "validation_score", "validation_error_count", "missing_fields",
			"compare_solar_allowlisted", "compare_solar_production_verified", "last_verified",
			"freshness_age_days", "unlock_action",
		])],
	];
	for (const [name, contents] of outputs) await writeFile(path.join(outputDir, name), contents, "utf8");

	console.log(JSON.stringify({
		as_of: asOf,
		input_sha256: document.input_sha256,
		output_dir: path.relative(REPO_ROOT, outputDir) || ".",
		files_written: outputs.map(([name]) => name),
		summary: document.summary,
	}, null, 2));
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
	main().catch((error) => {
		console.error(error.stack ?? String(error));
		process.exitCode = 1;
	});
}

export { main };
