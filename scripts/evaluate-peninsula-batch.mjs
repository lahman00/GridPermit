#!/usr/bin/env node
// Evaluates the 3 new locality records collected in this session's second
// research pass (San Mateo, Sierra Madre, Milpitas — a mixed Peninsula/
// South Bay/Southern California batch, not a single contiguous region):
// reads each record and its existing validation report (does not re-run
// collection or validation itself) and produces one decision report,
// per-record and aggregate, using the exact same deterministic readiness
// framework already established by every prior batch evaluator. Read-only
// on data/localities/ and output/validation-reports/ — only ever writes
// output/peninsula-batch-evaluation.json.
//
// Usage: node scripts/evaluate-peninsula-batch.mjs

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const LOCALITIES_DIR = path.join(REPO_ROOT, "data", "localities");
const REPORTS_DIR = path.join(REPO_ROOT, "output", "validation-reports");
const OUT_PATH = path.join(REPO_ROOT, "output", "peninsula-batch-evaluation.json");

// Exactly these 3 — not "every file in data/localities/" — so this report
// stays scoped to this specific batch even as more records are added later.
const PENINSULA_BATCH_RECORD_IDS = [
  "ca-san-mateo-san-mateo-pge",
  "ca-los-angeles-sierra-madre-sce",
  "ca-santa-clara-milpitas-pge",
];

// Same 15-field list as every prior batch evaluator.
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

// Identical thresholds to every prior batch evaluator.
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

  const readyCount = records.filter((r) => r.readiness === "READY").length;
  const limitedCount = records.filter((r) => r.readiness === "LIMITED").length;
  const notReadyCount = records.filter((r) => r.readiness === "NOT_READY").length;

  return {
    average_completeness_pct: avgCompleteness,
    average_validation_score: avgScore,
    ready_count: readyCount,
    limited_count: limitedCount,
    not_ready_count: notReadyCount,
    fields_missing_count: missingCounts,
    fields_most_often_missing: fieldsMostOftenMissing,
    warning_category_recurrence: warningCategoryCounts,
    utility_coverage: [...new Set(records.map((r) => r.utility_type))].sort(),
    geographic_counties_represented: [...new Set(records.map((r) => r.county))].sort(),
    recurring_source_access_problems: [
      "Several city domains blocked automated fetch entirely this batch (redwoodcity.org, sunnyvale.ca.gov, cityoffullerton.com-style blanket blocks) — Redwood City and Sunnyvale were abandoned as candidates after their primary pages returned HTTP 403 with no working alternative found.",
      "A CDN-hosting collision occurred again this batch: a PDF found while researching Mountain View, CA (via civiclive.com, a third-party CMS host shared by many cities) turned out to be City of Sierra Madre's checklist, not Mountain View's — caught by reading the letterhead before citing, and used honestly for Sierra Madre (a real, separate city) instead of discarded outright, since the content was genuinely useful once correctly attributed.",
      "One self-caught citation error: an official_contacts URL for San Mateo, built from a search-result title rather than a directly-fetched page, resolved to a live HTTP 404 on the validator's real URL check — fixed by locating and directly fetching the department's actual current contact page before re-citing.",
      "One self-caught fabrication risk: an SGIP program-administrator phone number for SCE territory was initially written from general knowledge/pattern-matching rather than a verified source; directly fetching SGIP's own contact page confirmed no phone number is listed for SCE (only email), and the invented number was removed before this batch was finalized.",
    ],
    schema_gaps_discovered: [
      "No new schema gaps were discovered while collecting this batch. Milpitas's rebates entry uses value_usd_flat for a $1,250 lump-sum rebate (distinct from battery_programs' per-kWh/per-kW SGIP figures), which the schema already supports without modification.",
    ],
    trust_rule_corrections_made_during_collection: [
      "Mountain View, CA was dropped as a candidate this batch after its only found submittal-checklist PDF turned out (on reading) to belong to a different city (Sierra Madre) via a shared third-party CDN host — no Mountain View record was created from unverified assumptions.",
      "Milpitas's eligibility caps were recorded under system_size_kw_dc_max (not kw_ac_max) because the city's own page explicitly states 'kW (DC MAX)' — preserving the AC/DC distinction rather than defaulting to the more common AC-cap pattern seen in other cities' records.",
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
  for (const id of PENINSULA_BATCH_RECORD_IDS) {
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
