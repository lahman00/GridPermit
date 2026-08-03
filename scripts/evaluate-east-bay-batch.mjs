#!/usr/bin/env node
// Evaluates the 6 East Bay (Alameda/Contra Costa County) locality records
// collected in this session: reads each record and its existing validation
// report (does not re-run collection or validation itself) and produces one
// decision report, per-record and aggregate, using the exact same
// deterministic readiness framework already established by
// scripts/evaluate-pilot.mjs and scripts/evaluate-next-batch.mjs. Read-only
// on data/localities/ and output/validation-reports/ — only ever writes
// output/east-bay-batch-evaluation.json.
//
// Usage: node scripts/evaluate-east-bay-batch.mjs

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const LOCALITIES_DIR = path.join(REPO_ROOT, "data", "localities");
const REPORTS_DIR = path.join(REPO_ROOT, "output", "validation-reports");
const OUT_PATH = path.join(REPO_ROOT, "output", "east-bay-batch-evaluation.json");

// Exactly these 6 — not "every file in data/localities/" — so this report
// stays scoped to this specific batch even as more records are added later.
const EAST_BAY_BATCH_RECORD_IDS = [
  "ca-alameda-berkeley-pge",
  "ca-alameda-san-leandro-pge",
  "ca-alameda-hayward-pge",
  "ca-alameda-pleasanton-pge",
  "ca-contra-costa-richmond-pge",
  "ca-contra-costa-concord-pge",
];

// Same 15-field list as scripts/evaluate-pilot.mjs's COVERAGE_FIELDS,
// scripts/evaluate-next-batch.mjs's COVERAGE_FIELDS, and
// scripts/validate-record.mjs's FIELD_NAMES — kept as a separate literal
// here for the same reason: this script has no dependency on the others.
const COVERAGE_FIELDS = [
  "utility", "generation_supplier", "city", "county", "permit_authority", "permit_url",
  "interconnection_url", "battery_programs", "required_documents",
  "inspection_steps", "timeline_days", "eligibility_constraints", "permit_fees", "rebates",
  "official_contacts",
];

// Same deterministic utility-type classification already used by the prior
// batches — every city in this batch is PG&E territory (an IOU).
function classifyUtilityType(utilityName) {
  if (!utilityName) return "unknown";
  const n = utilityName.toUpperCase();
  if (n.includes("WATER AND POWER") || n.includes("MUNICIPAL POWER") || n.includes("MUNICIPAL")) return "municipal";
  if (n.includes("PACIFIC GAS") || n.includes("PG&E")) return "IOU";
  if (n.includes("SOUTHERN CALIFORNIA EDISON") || n.includes("SCE")) return "IOU";
  if (n.includes("SAN DIEGO GAS") || n.includes("SDG&E")) return "IOU";
  return "unknown";
}

// Identical thresholds to every prior batch evaluator — the same readiness
// rule applies everywhere, not just the pilot.
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
      "pge.com returns HTTP 403 to automated fetch for every record citing the PG&E NEM interconnection page (all 6 records in this batch) — consistent with every prior PG&E-territory batch this session; the URL's existence is instead confirmed via search-engine indexing.",
      "Several municipal-code hosting platforms blocked automated fetch entirely this batch: library.municode.com (Richmond's Chapter 6.47 solar ordinance) and berkeley.municipal.codes (Berkeley's BMC 1.04.010 definitions section) both returned HTTP 403. A third-party ordinance mirror (mcclibraryfunctions.azurewebsites.us) returned an ordinance for the wrong jurisdiction entirely (Orange County's, not Livermore's) under a colliding document ID — this was caught by reading the fetched content itself before use and the source was discarded, not cited. Livermore and Palo Alto were abandoned as candidates this session after their primary sources (codepublishing.com, paloalto.gov) also blocked automated fetch with no working alternative found in a reasonable number of attempts.",
      "By contrast, PDF handouts hosted directly on a city's own domain (berkeleyca.gov, sanleandro.org, hayward-ca.gov, cityofpleasantonca.gov) were fetchable every time via a two-step process: the fetch tool's HTML-conversion step reported binary/unreadable content, but it separately saved the raw PDF locally, which could then be read directly as a PDF and yielded full, quotable text. This two-step pattern is the most reliable path to primary-source ordinance/handout text found this session and is worth using first for future batches before attempting a code-hosting platform.",
    ],
    schema_gaps_discovered: [
      "No new schema gaps were discovered while collecting this batch. Two feeItem entries in the Hayward and San Leandro records intentionally have amount_usd: null with only a notes-level fact (fee timing, or a flat fee for one path but no hourly rate for another) — the schema's optional amount_usd field already supports this without any change.",
    ],
    trust_rule_corrections_made_during_collection: [
      "A candidate source for Livermore's solar ordinance, found via search and initially treated as promising, was read in full before citing and turned out to be Orange County's ordinance (matching AB 2188 language and even the same ordinance number, 15-012, by coincidence of the third-party host's internal document ID) — discarded entirely rather than cited, and Livermore was dropped as a candidate this session rather than substituting a lower-confidence guess.",
      "Richmond and Concord were both deliberately left at LIMITED rather than forced to READY: their cities' own pages did not state a specific review timeline or system-size eligibility cap, and the municipal code chapters that likely contain this detail (Richmond Municipal Code Ch. 6.47) returned HTTP 403 on every fetch attempt. Both records leave timeline_days and/or eligibility_constraints null with a note explaining exactly what was tried, rather than assuming the common 10kW-AC/single-family pattern seen in other cities without direct confirmation for these two cities specifically.",
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
  for (const id of EAST_BAY_BATCH_RECORD_IDS) {
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

// Direct-execution guard: main() only runs when this file is the process's
// entry point, never when it's imported (by a test or anything else).
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  main().catch((err) => {
    console.error("error:", err.stack ?? String(err));
    process.exit(1);
  });
}
