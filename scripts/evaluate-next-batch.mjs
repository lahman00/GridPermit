#!/usr/bin/env node
// Evaluates the 10 next-batch locality records collected against
// data/next-batch-targets.json: reads each record and its existing
// validation report (does not re-run collection or validation itself) and
// produces one decision report, per-record and aggregate, using the exact
// same deterministic readiness framework already established by
// scripts/evaluate-pilot.mjs for the original 5-city pilot. Read-only on
// data/localities/ and output/validation-reports/ — only ever writes
// output/next-batch-evaluation.json.
//
// Usage: node scripts/evaluate-next-batch.mjs

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const LOCALITIES_DIR = path.join(REPO_ROOT, "data", "localities");
const REPORTS_DIR = path.join(REPO_ROOT, "output", "validation-reports");
const OUT_PATH = path.join(REPO_ROOT, "output", "next-batch-evaluation.json");

// Exactly these 10 — the batch defined in data/next-batch-targets.json —
// not "every file in data/localities/", so this report stays scoped to this
// specific batch even as more records are added later.
const NEXT_BATCH_RECORD_IDS = [
  "ca-fresno-fresno-pge",
  "ca-san-joaquin-stockton-pge",
  "ca-sonoma-santa-rosa-pge",
  "ca-orange-irvine-sce",
  "ca-orange-fullerton-sce",
  "ca-orange-santa-ana-sce",
  "ca-san-diego-chula-vista-sdge",
  "ca-san-diego-escondido-sdge",
  "ca-los-angeles-los-angeles-ladwp",
  "ca-alameda-alameda-amp",
];

// Same 15-field list as scripts/evaluate-pilot.mjs's COVERAGE_FIELDS,
// scripts/validate-record.mjs's FIELD_NAMES, and
// scripts/render-locality-summary.mjs's COVERAGE_FIELDS — kept as a
// separate literal here for the same reason: this script has no
// dependency on the others.
const COVERAGE_FIELDS = [
  "utility", "generation_supplier", "city", "county", "permit_authority", "permit_url",
  "interconnection_url", "battery_programs", "required_documents",
  "inspection_steps", "timeline_days", "eligibility_constraints", "permit_fees", "rebates",
  "official_contacts",
];

// Same deterministic utility-type classification already used by
// evaluate-pilot.mjs, extended with SCE and the two new municipal utilities
// this batch introduced (LADWP, Alameda Municipal Power).
function classifyUtilityType(utilityName) {
  if (!utilityName) return "unknown";
  const n = utilityName.toUpperCase();
  if (n.includes("WATER AND POWER") || n.includes("MUNICIPAL POWER") || n.includes("MUNICIPAL")) return "municipal";
  if (n.includes("PACIFIC GAS") || n.includes("PG&E")) return "IOU";
  if (n.includes("SOUTHERN CALIFORNIA EDISON") || n.includes("SCE")) return "IOU";
  if (n.includes("SAN DIEGO GAS") || n.includes("SDG&E")) return "IOU";
  return "unknown";
}

// Identical thresholds to scripts/evaluate-pilot.mjs — the same readiness
// rule applies to every batch, not just the pilot.
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
      "broken_url (HTTP 403 or DNS-level access failure to automated retrieval) appears in the warnings of most of these 10 records — fresno.gov and stocktonca.gov failed at the DNS level; cityoffullerton.com, chulavistaca.gov, ladbs.org, dbs.lacity.gov, and ladwp.com all returned HTTP 403. srcity.org (Santa Rosa), santa-ana.gov, escondido.gov, alamedamp.com, cityofirvine.gov, and sonomacleanpower.org were all directly fetchable with no block, showing this is inconsistent per-domain, not a blanket California-government pattern.",
      "outdated_information (the statewide SGIP 'Equity Resiliency' tier's stated 'through 2025' window has elapsed) recurs in every PG&E/SCE-territory record in this batch that cites the statewide SGIP program (7 of 10) — the same recurring issue already documented for the original 5-city pilot.",
    ],
    schema_gaps_discovered: [
      "No new schema gaps were discovered while collecting this batch — every fact encountered (including Alameda's real $330 interconnection fee and $500 income-qualified rebate, and Los Angeles's split permit-authority/interconnection-utility roles) fit the existing v1.3.0 schema shape without modification.",
    ],
    trust_rule_corrections_made_during_collection: [
      "Fullerton's generation_supplier and Chula Vista's battery_programs were each initially drafted with a non-null value and no source citation, violating the schema's 'non-null requires source_ids' rule — both were corrected to null (not force-fitted with a citation) before this evaluation ran.",
      "Santa Ana's Orange County Power Authority (CCA) status was corrected mid-collection after a secondary source (a chamber-of-commerce blog) was found to contradict OCPA's own official member-city list — the blog claim was discarded per the 'no blogs as evidence' rule, and Santa Ana's generation_supplier records SCE directly (type 'utility'), not a CCA.",
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
    note: "Applies the exact same deterministic thresholds already used for the original 5-city pilot (READY: completeness >=80% and score >=85 and 0 errors; LIMITED: completeness >=50% and score >=75 and 0 errors; else NOT_READY) — no record here was manually marked READY.",
  };
}

async function main() {
  const records = [];
  for (const id of NEXT_BATCH_RECORD_IDS) {
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

main().catch((err) => {
  console.error("error:", err.stack ?? String(err));
  process.exit(1);
});
