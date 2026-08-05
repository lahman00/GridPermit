#!/usr/bin/env node
// Evaluates the Inland Empire batch (Batch 2 of the California
// locality-expansion campaign): Ontario, Rancho Cucamonga, Upland, Pomona,
// Chino, Chino Hills, Fontana, Rialto, and Redlands — all San Bernardino
// County except Pomona (Los Angeles County), all confirmed SCE territory via
// SCE's own incorporated-cities fact sheet. Claremont was investigated but
// blocked — every official source (claremontca.gov, ecode360.com, and
// qcode.us, which redirects to the same blocked ecode360 host) returned
// HTTP 403 on every attempt — so no record was created for it. Reads each
// record and its existing validation report (does not re-run collection or
// validation itself) and produces one decision report, per-record and
// aggregate, using the exact same deterministic readiness framework already
// established by every prior batch evaluator. Read-only on data/localities/
// and output/validation-reports/ — only ever writes
// output/inland-empire-batch-evaluation.json.
//
// Usage: node scripts/evaluate-inland-empire-batch.mjs

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const LOCALITIES_DIR = path.join(REPO_ROOT, "data", "localities");
const REPORTS_DIR = path.join(REPO_ROOT, "output", "validation-reports");
const OUT_PATH = path.join(REPO_ROOT, "output", "inland-empire-batch-evaluation.json");

const INLAND_EMPIRE_BATCH_RECORD_IDS = [
  "ca-san-bernardino-ontario-sce",
  "ca-san-bernardino-rancho-cucamonga-sce",
  "ca-san-bernardino-upland-sce",
  "ca-los-angeles-pomona-sce",
  "ca-san-bernardino-chino-sce",
  "ca-san-bernardino-chino-hills-sce",
  "ca-san-bernardino-fontana-sce",
  "ca-san-bernardino-rialto-sce",
  "ca-san-bernardino-redlands-sce",
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
  if (n.includes("WATER AND POWER") || n.includes("MUNICIPAL POWER") || n.includes("MUNICIPAL")) return "municipal";
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
    investigated_but_blocked: [
      "Claremont: claremontca.gov returned HTTP 403 on every attempt (including the bare domain root), ecode360.com (host of the city's expedited-solar-permitting municipal code chapter) returned HTTP 403, and qcode.us's Claremont municipal-code mirror redirects to the same blocked ecode360 host. Search-engine synthesis suggested specific facts (a 3-day expedited timeline, single-family/duplex eligibility, one required inspection) but per the rule against using search snippets as evidence, no record was created.",
    ],
    recurring_source_access_problems: [
      "pomonaca.gov and library.municode.com (Pomona's two natural sources for city-specific permit facts) both returned HTTP 403 on every attempt, leaving Pomona's record thin on permit-process specifics despite a strong, directly-confirmed CCA fact (Pomona Choice Energy, via the CCA's own site).",
      "Several statewide-guidebook-style PDFs (Rancho Cucamonga's 'Residential Photovoltaic Permitting Guide' and Chino Hills' fee schedule and 'CD-Master-Fee-Schedule') were scanned/image PDFs without a clean text layer; the fee schedule was still successfully read via the Read-tool-on-saved-PDF technique (page-image rendering), but the Rancho Cucamonga guidebook could not be rendered this session (pdftoppm/poppler is not installed in this environment) and was not used as a source.",
    ],
    schema_gaps_discovered: [
      "No new schema gaps were discovered while collecting this batch.",
    ],
    trust_rule_corrections_made_during_collection: [
      "Redlands required an extra verification step before trusting SCE as the electric utility: the city's own 'Municipal Utilities and Engineering Department' name initially raised the possibility of a municipal electric utility (as seen in Pasadena or Alameda). Direct confirmation that this department's scope is limited to water/wastewater only (no electric) was obtained before finalizing SCE, rather than assuming service territory from the SCE fact sheet listing alone.",
      "Fontana's generation_supplier was left null after finding a City of Fontana bid solicitation for a CCA feasibility study/partner search — evidence of active CCA *exploration*, not an operational program — rather than recording a CCA that does not yet exist.",
      "Pomona's Pomona Choice Energy CCA was confirmed via the program's own official site (pomonachoiceenergy.org), not merely a CalCCA industry-association article, once pomonaca.gov itself proved unreachable.",
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
    not_ready: notReady.map((r) => ({ record_id: r.record_id, city: r.city, reason: `readiness=NOT_READY (${r.error_count} schema error(s))` })),
    utilities_represented_in_recommended_set: [...new Set(ready.map((r) => r.utility_type))],
    note: "Applies the exact same deterministic thresholds already used for every prior batch (READY: completeness >=80% and score >=85 and 0 errors; LIMITED: completeness >=50% and score >=75 and 0 errors; else NOT_READY) — no record here was manually marked READY.",
  };
}

async function main() {
  const records = [];
  for (const id of INLAND_EMPIRE_BATCH_RECORD_IDS) {
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
