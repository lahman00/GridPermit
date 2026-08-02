#!/usr/bin/env node
// Closes out the controlled California pilot: reads the 5 pilot locality
// records and their existing validation reports (does not re-run collection
// or validation itself) and produces one decision report, per-record and
// aggregate, plus an MVP scope recommendation. Read-only on
// data/localities/ and output/validation-reports/ — only ever writes
// output/pilot-evaluation.json.
//
// Usage: node scripts/evaluate-pilot.mjs

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const LOCALITIES_DIR = path.join(REPO_ROOT, "data", "localities");
const REPORTS_DIR = path.join(REPO_ROOT, "output", "validation-reports");
const OUT_PATH = path.join(REPO_ROOT, "output", "pilot-evaluation.json");

// Exactly these 5 — not "every file in data/localities/" — so this report
// stays scoped to the controlled pilot even if more records are added later.
const PILOT_RECORD_IDS = [
  "ca-santa-clara-san-jose-pge",
  "ca-alameda-fremont-pge",
  "ca-alameda-oakland-pge",
  "ca-los-angeles-pasadena-pwp",
  "ca-san-diego-san-diego-sdge",
];

// Every researched field in the schema (matches scripts/render-locality-summary.mjs's
// COVERAGE_FIELDS and scripts/validate-record.mjs's FIELD_NAMES — kept as a
// separate literal here rather than imported, since this script must stay a
// read-only reporting tool with no shared mutable state).
const COVERAGE_FIELDS = [
  "utility", "generation_supplier", "city", "county", "permit_authority", "permit_url",
  "interconnection_url", "battery_programs", "required_documents",
  "inspection_steps", "timeline_days", "eligibility_constraints", "permit_fees", "rebates",
  "official_contacts",
];

// Deterministic utility-type classification from the utility's own display
// name. This is a lookup over the 3 utility families this pilot actually
// used (PG&E, SDG&E as IOUs; Pasadena Water and Power as municipal) — not a
// general classifier. A utility whose name doesn't match any pattern is
// reported as "unknown" rather than guessed.
function classifyUtilityType(utilityName) {
  if (!utilityName) return "unknown";
  const n = utilityName.toUpperCase();
  if (n.includes("WATER AND POWER") || n.includes("MUNICIPAL")) return "municipal";
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
    fields_missing_count: missingCounts,
    fields_most_often_missing: fieldsMostOftenMissing,
    warning_category_recurrence: warningCategoryCounts,
    recurring_source_access_problems: [
      "broken_url (HTTP 403 blocked-to-automation) appears in the warnings of every one of the 5 records — county-level government sites (sccgov.org, acgov.org, locator.lacounty.gov, sandiegocounty.gov) were blocked in all 5; the major IOU domains (pge.com, sdge.com) were blocked in 4 of 5 (every record except Pasadena, whose utility is its own official site with no bot-blocking encountered).",
      "outdated_information (the statewide SGIP 'Equity Resiliency' tier's stated 'through 2025' window has elapsed) recurs in 4 of 5 records — every record that relies on statewide SGIP figures (all except Pasadena, which has its own local battery rebate program instead).",
    ],
    schema_gaps_discovered: [
      "generation_supplier and eligibility_constraints (added in schema v1.2.0) and programItem.value_usd_per_watt (added in v1.3.0) were all discovered and fixed during this pilot, driven by real facts the schema couldn't represent yet (Fremont/Oakland's CCA, Fremont's system-size caps, Pasadena's per-Watt rebate tiers).",
      "No further schema gaps surfaced while collecting Oakland, Pasadena, or San Diego beyond those three, already-addressed gaps.",
    ],
  };
}

function buildMvpRecommendation(records) {
  const ready = records.filter((r) => r.readiness === "READY");
  const limited = records.filter((r) => r.readiness === "LIMITED");

  return {
    recommended_launch_record_ids: ready.map((r) => r.record_id),
    excluded_for_now: limited.map((r) => ({ record_id: r.record_id, reason: `readiness=${r.readiness} (completeness ${r.completeness_pct}%)` })),
    utilities_represented_in_recommended_set: [...new Set(ready.map((r) => r.utility_type))],
    fields_safe_to_expose: [
      "utility", "generation_supplier", "city", "county", "permit_authority",
      "permit_url", "official_contacts", "inspection_steps", "eligibility_constraints",
      "required_documents",
    ],
    fields_to_hide_or_mark_unverified: [
      "rebates (populated in only 1 of 5 records — too sparse to present as a reliable feature across localities yet)",
      "permit_fees (populated in only 2 of 5 records, and both instances carry an 'unsupported_claim' warning for single-source-type sourcing — show only with an explicit verify-with-issuing-authority caveat, never as a confirmed final cost)",
      "timeline_days (populated in only 2 of 5 records — must render as 'Not yet verified' everywhere else, never blended with a sitewide average)",
      "battery_programs items with status 'expired' (the SGIP Equity Resiliency tier in 4 of 5 records) — must not be displayed as a current/active offer; either omit or label explicitly as lapsed",
      "interconnection_url — safe to link, but must not be presented as directly verified content, since the underlying page could not be rendered in 4 of 5 records (HTTP 403)",
    ],
    calculator_should_consume_data_yet: false,
    calculator_recommendation_notes: "Per docs/DATA_ARCHITECTURE.md Section 6 ('coverage is binary, not blended'), the flat homepage calculator should not yet read from these records — permit_fees and timeline_days are populated in fewer than half the pilot localities, so wiring the calculator in now would force exactly the mixed real/placeholder blending that document prohibits. Build locality-specific informational pages for the READY set first (the Phase 3 'Permit content pages' consumer already planned in docs/DATA_ARCHITECTURE.md Section 5); revisit calculator integration once permit_fees/timeline_days coverage is much higher and/or a larger city sample exists.",
  };
}

async function main() {
  const records = [];
  for (const id of PILOT_RECORD_IDS) {
    records.push(await evaluateRecord(id));
  }

  const evaluation = {
    evaluated_at: new Date().toISOString(),
    record_count: records.length,
    records,
    aggregate: buildAggregate(records),
    mvp_recommendation: buildMvpRecommendation(records),
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
