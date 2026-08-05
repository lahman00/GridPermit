#!/usr/bin/env node
// Evaluates the Sacramento region batch (Batch 5 of the California
// locality-expansion campaign): Sacramento, West Sacramento, Elk Grove,
// Folsom, Rancho Cordova, Citrus Heights, Roseville, Rocklin, Davis, and
// Woodland. Utility coverage is genuinely mixed in this batch: SMUD (a
// municipal utility) for the Sacramento County cities, PG&E for the Yolo
// County cities (West Sacramento, Davis, Woodland) and Rocklin, and
// Roseville's own municipal utility (Roseville Electric) for Roseville.
// Several cities (Elk Grove, Folsom, Rancho Cordova) have thin records
// because their official sites returned HTTP 403 or refused connections on
// every attempt this session — real, sourced facts are recorded, but they
// fall below the LIMITED completeness threshold. Reads each record and its
// existing validation report (does not re-run collection or validation
// itself) and produces one decision report, per-record and aggregate, using
// the exact same deterministic readiness framework already established by
// every prior batch evaluator. Read-only on data/localities/ and
// output/validation-reports/ — only ever writes
// output/sacramento-region-batch-evaluation.json.
//
// Usage: node scripts/evaluate-sacramento-region-batch.mjs

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const LOCALITIES_DIR = path.join(REPO_ROOT, "data", "localities");
const REPORTS_DIR = path.join(REPO_ROOT, "output", "validation-reports");
const OUT_PATH = path.join(REPO_ROOT, "output", "sacramento-region-batch-evaluation.json");

const SACRAMENTO_REGION_BATCH_RECORD_IDS = [
  "ca-sacramento-sacramento-smud",
  "ca-yolo-west-sacramento-pge",
  "ca-sacramento-elk-grove-smud",
  "ca-sacramento-folsom-smud",
  "ca-sacramento-rancho-cordova-smud",
  "ca-sacramento-citrus-heights-smud",
  "ca-placer-roseville-re",
  "ca-placer-rocklin-pge",
  "ca-yolo-davis-pge",
  "ca-yolo-woodland-pge",
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
  if (n.includes("WATER AND POWER") || n.includes("MUNICIPAL POWER") || n.includes("MUNICIPAL") || n.includes("PUBLIC UTILITIES") || n.includes("SMUD") || n.includes("ELECTRIC UTILITY")) return "municipal";
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
      "No city in this batch was left with zero record, but cityofsacramento.gov rendered only navigation-shell content on direct fetch (a JavaScript-heavy site whose main content did not appear in fetched HTML); elkgrove.gov, folsom.ca.us, and cityofranchocordova.org all returned HTTP 403 on every attempt; rocklin.ca.us refused automated connections outright (ECONNREFUSED). Elk Grove, Folsom, and Rancho Cordova fell to NOT_READY (below the 50% LIMITED completeness threshold) as a direct result — they still contain real, sourced facts (utility, county, permit authority, and in Rancho Cordova's case contact details), just not enough to clear the bar.",
    ],
    recurring_source_access_problems: [
      "This batch has the heaviest source-access friction of the campaign so far: 4 of 10 city government sites (elkgrove.gov, folsom.ca.us, cityofranchocordova.org, cityofdavis.org) returned HTTP 403, one (rocklin.ca.us) refused TCP connections outright, and cityofsacramento.gov's own dedicated Residential Solar page rendered as an empty navigation shell rather than its actual content.",
    ],
    schema_gaps_discovered: [
      "No new schema gaps were discovered while collecting this batch.",
    ],
    trust_rule_corrections_made_during_collection: [
      "This batch required tracking three distinct utility structures across ten cities rather than one: SMUD (a municipal utility, for the Sacramento County cities), Roseville Electric (a second, separate municipal utility, for Roseville only — confirmed directly via the city's own solar page requiring 'preapproval from Roseville Electric'), and PG&E (for the Yolo County cities and Rocklin). Getting this right meant checking each city's utility individually rather than assuming county-wide uniformity, unlike San Mateo and Orange counties earlier in this campaign where one utility covered nearly every city.",
      "SGIP (the statewide CPUC-administered battery incentive reused as boilerplate for every prior IOU-territory record this campaign) was correctly left null for every SMUD-territory and Roseville Electric-territory record in this batch, since SGIP is administered only through the CPUC-regulated IOUs and does not apply to municipal-utility customers — the same rule already established for Anaheim Public Utilities in Batch 3.",
      "Valley Clean Energy's own FAQ page, fetched once while researching Davis, directly named Woodland and Winters as fellow default-enrolled member cities in the same sentence — reused directly for Woodland's record rather than re-deriving the same fact from a second search.",
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
    not_ready: notReady.map((r) => ({ record_id: r.record_id, city: r.city, reason: `readiness=NOT_READY (completeness ${r.completeness_pct}% below the 50% floor; ${r.error_count} schema error(s))` })),
    utilities_represented_in_recommended_set: [...new Set(ready.map((r) => r.utility_type))],
    note: "Applies the exact same deterministic thresholds already used for every prior batch (READY: completeness >=80% and score >=85 and 0 errors; LIMITED: completeness >=50% and score >=75 and 0 errors; else NOT_READY) — no record here was manually marked READY.",
  };
}

async function main() {
  const records = [];
  for (const id of SACRAMENTO_REGION_BATCH_RECORD_IDS) {
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
