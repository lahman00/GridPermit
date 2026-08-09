#!/usr/bin/env node
// Evaluates the third Central Coast sub-batch of the statewide
// expansion mission's Wave J: Salinas, Gonzales, Soledad, Greenfield,
// and King City — the Salinas Valley, southern Monterey County.
// Reads each record and its existing validation report (does not
// re-run collection or validation itself) and produces one decision
// report, per-record and aggregate, using the exact same deterministic
// readiness framework already established by every prior batch
// evaluator. Read-only on data/localities/ and
// output/validation-reports/ — only ever writes
// output/central-coast-wave-j3-batch-evaluation.json.
//
// Usage: node scripts/evaluate-central-coast-wave-j3-batch.mjs

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const LOCALITIES_DIR = path.join(REPO_ROOT, "data", "localities");
const REPORTS_DIR = path.join(REPO_ROOT, "output", "validation-reports");
const OUT_PATH = path.join(REPO_ROOT, "output", "central-coast-wave-j3-batch-evaluation.json");

const CENTRAL_COAST_WAVE_J3_RECORD_IDS = [
	"ca-monterey-salinas-pge",
	"ca-monterey-gonzales-pge",
	"ca-monterey-soledad-pge",
	"ca-monterey-greenfield-pge",
	"ca-monterey-king-city-pge",
];

const COVERAGE_FIELDS = [
	"utility", "generation_supplier", "city", "county", "permit_authority", "permit_url",
	"interconnection_url", "battery_programs", "required_documents",
	"inspection_steps", "timeline_days", "eligibility_constraints", "permit_fees", "rebates",
	"official_contacts",
];

function classifyUtilityType(utilityName) {
	if (!utilityName) return "unknown";
	const n = utilityName.toUpperCase();
	if (n.includes("WATER AND POWER") || n.includes("MUNICIPAL POWER") || n.includes("MUNICIPAL") || n.includes("LIGHT & WATER") || n.includes("PUBLIC UTILITIES") || n.includes("ELECTRIC DEPARTMENT") || n.includes("ELECTRIC UTILITY") || n.includes("SILICON VALLEY POWER") || n.includes("CPAU") || n.includes("SMUD") || n.includes("SACRAMENTO MUNICIPAL") || n.includes("LODI") || n.includes("MODESTO IRRIGATION") || n.includes("TURLOCK IRRIGATION")) return "municipal";
	if (n.includes("PACIFIC GAS") || n.includes("PG&E")) return "IOU";
	if (n.includes("SOUTHERN CALIFORNIA EDISON") || n.includes("SCE")) return "IOU";
	if (n.includes("SAN DIEGO GAS") || n.includes("SDG&E")) return "IOU";
	return "unknown";
}

function classifyReadiness({ completenessPct, score, errorCount }) {
	if (errorCount > 0) return "NOT_READY";
	if (completenessPct >= 80 && score >= 85) return "READY";
	if (completenessPct >= 50 && score >= 75) return "LIMITED";
	return "NOT_READY";
}

async function evaluateRecord(recordId) {
	const record = JSON.parse(await readFile(path.join(LOCALITIES_DIR, `${recordId}.json`), "utf8"));
	const report = JSON.parse(await readFile(path.join(REPORTS_DIR, `${recordId}.json`), "utf8"));

	const populatedFields = COVERAGE_FIELDS.filter((f) => record[f]?.value !== null);
	const missingFields = COVERAGE_FIELDS.filter((f) => record[f]?.value === null);
	const completenessPct = Math.round((populatedFields.length / COVERAGE_FIELDS.length) * 1000) / 10;

	const warningCategories = [...new Set(report.warnings.map((w) => w.category))].sort();
	const genSupplier = record.generation_supplier?.value ?? null;
	const separateCca = genSupplier === null ? null : genSupplier.type === "cca";

	const readiness = classifyReadiness({
		completenessPct,
		score: report.score,
		errorCount: report.errors.length,
	});

	return {
		record_id: recordId,
		city: record.city?.value ?? null,
		county: record.county?.value ?? null,
		completeness_pct: completenessPct,
		validation_score: report.score,
		validation_status: report.status,
		error_count: report.errors.length,
		warning_count: report.warnings.length,
		populated_fields: populatedFields,
		missing_fields: missingFields,
		warning_categories: warningCategories,
		utility_type: classifyUtilityType(record.utility?.value),
		separate_cca_present: separateCca,
		permit_fees_available: record.permit_fees?.value !== null,
		timeline_available: record.timeline_days?.value !== null,
		required_documents_available: record.required_documents?.value !== null,
		readiness,
	};
}

function buildAggregate(records) {
	const n = records.length;
	const avgCompleteness = Math.round((records.reduce((s, r) => s + r.completeness_pct, 0) / n) * 10) / 10;
	const avgScore = Math.round((records.reduce((s, r) => s + r.validation_score, 0) / n) * 10) / 10;

	const missingCounts = {};
	for (const field of COVERAGE_FIELDS) {
		missingCounts[field] = records.filter((r) => r.missing_fields.includes(field)).length;
	}
	const fieldsMostOftenMissing = Object.entries(missingCounts)
		.filter(([, count]) => count > 0)
		.sort((a, b) => b[1] - a[1])
		.map(([field, count]) => ({ field, missing_in_records: count }));

	const warningCategoryCounts = {};
	for (const r of records) {
		for (const cat of r.warning_categories) {
			warningCategoryCounts[cat] = (warningCategoryCounts[cat] ?? 0) + 1;
		}
	}

	return {
		average_completeness_pct: avgCompleteness,
		average_validation_score: avgScore,
		ready_count: records.filter((r) => r.readiness === "READY").length,
		limited_count: records.filter((r) => r.readiness === "LIMITED").length,
		not_ready_count: records.filter((r) => r.readiness === "NOT_READY").length,
		fields_missing_count: missingCounts,
		fields_most_often_missing: fieldsMostOftenMissing,
		warning_category_recurrence: warningCategoryCounts,
		utility_coverage: [...new Set(records.map((r) => r.utility_type))].sort(),
		geographic_counties_represented: [...new Set(records.map((r) => r.county))].sort(),
		recurring_source_access_problems: [
			"salinas.gov returned HTTP 403 to automated fetch this session, limiting Salinas's record to search-engine-derived detail. gonzalesca.gov's Building Services sub-page returned HTTP 500 (its Permit Center/Building sub-page was reachable instead). cityofsoledad.com migrated to cityofsoledad.gov mid-session (confirmed 301 redirect); the new domain was reachable but did not itself surface solar-specific detail. greenfieldca.gov and kingcity.com were reachable but their fetched pages were general Building Division pages without itemized solar-specific requirements.",
		],
		schema_gaps_discovered: ["No new schema gaps were discovered while collecting this batch."],
		trust_rule_corrections_made_during_collection: [
			"Central Coast Community Energy (3CE) was reused from its already-established official-site citation (3cenergy.org/about-us/, verified in Wave J1) for all 5 cities. For King City specifically, 3CE's member-community list surfaced this session did not individually name the city, so the CCA determination was based on confirmed county membership (Monterey County, which 3CE serves) rather than a city-specific name match, and confidence was set slightly below the batch baseline to reflect that distinction.",
		],
	};
}

function buildBatchRecommendation(records) {
	const ready = records.filter((r) => r.readiness === "READY");
	const limited = records.filter((r) => r.readiness === "LIMITED");
	const notReady = records.filter((r) => r.readiness === "NOT_READY");

	return {
		recommended_publish_record_ids: ready.map((r) => r.record_id),
		limited_for_now: limited.map((r) => ({ record_id: r.record_id, city: r.city, reason: `readiness=LIMITED (completeness ${r.completeness_pct}%, score ${r.validation_score})` })),
		not_ready: notReady.map((r) => ({ record_id: r.record_id, city: r.city, reason: `readiness=NOT_READY (completeness ${r.completeness_pct}%, score ${r.validation_score})` })),
		utilities_represented_in_recommended_set: [...new Set(ready.map((r) => r.utility_type))],
		note: "Applies the exact same deterministic thresholds already used for every prior batch (READY: completeness >=80% and score >=85 and 0 errors; LIMITED: completeness >=50% and score >=75 and 0 errors; else NOT_READY) — no record here was manually marked READY.",
	};
}

async function main() {
	const records = [];
	for (const id of CENTRAL_COAST_WAVE_J3_RECORD_IDS) {
		records.push(await evaluateRecord(id));
	}

	const evaluation = {
		evaluated_at: new Date().toISOString(),
		record_count: records.length,
		records,
		aggregate: buildAggregate(records),
		batch_recommendation: buildBatchRecommendation(records),
	};

	await writeFile(OUT_PATH, JSON.stringify(evaluation, null, 2) + "\n", "utf8");
	console.log(JSON.stringify(evaluation, null, 2));
	console.error(`\nEvaluation written to ${path.relative(REPO_ROOT, OUT_PATH)}`);
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
	main().catch((err) => {
		console.error("error:", err.stack ?? String(err));
		process.exit(1);
	});
}
