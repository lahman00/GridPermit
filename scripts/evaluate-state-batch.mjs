#!/usr/bin/env node
// Generic, reusable evaluator for a multi-state batch — one script instead
// of a new evaluate-<batch>.mjs literal per batch (the pattern used for
// every California wave). Reads each named record and its existing
// validation report (does not re-run collection or validation itself) and
// produces one decision report, per-record and aggregate, using the exact
// same deterministic readiness framework as scripts/evaluate-pilot.mjs.
// Read-only on data/localities/ and output/validation-reports/ — only ever
// writes output/<state-slug>-batch-evaluation.json.
//
// Usage:
//   node scripts/evaluate-state-batch.mjs RI ri-providence-providence-ngrid ri-kent-warwick-ngrid ...
//   node scripts/evaluate-state-batch.mjs RI --all-in-state
//     (evaluates every data/localities/ri-*.json record currently on disk)

import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const LOCALITIES_DIR = path.join(REPO_ROOT, "data", "localities");
const REPORTS_DIR = path.join(REPO_ROOT, "output", "validation-reports");

// Same 15-field list as scripts/evaluate-pilot.mjs's COVERAGE_FIELDS,
// scripts/validate-record.mjs's FIELD_NAMES — kept as a separate literal
// here for the same isolation reason those scripts document.
const COVERAGE_FIELDS = [
  "utility", "generation_supplier", "city", "county", "permit_authority", "permit_url",
  "interconnection_url", "battery_programs", "required_documents",
  "inspection_steps", "timeline_days", "eligibility_constraints", "permit_fees", "rebates",
  "official_contacts",
];

const STATE_SLUGS = {
  CA: "california", RI: "rhode-island", DE: "delaware", VT: "vermont",
  CO: "colorado", AZ: "arizona", HI: "hawaii", OR: "oregon", NM: "new-mexico",
  NV: "nevada", IL: "illinois", NJ: "new-jersey", UT: "utah", MD: "maryland",
  VA: "virginia",
  NC: "north-carolina",
  SC: "south-carolina",
  GA: "georgia",
};

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
  const readiness = classifyReadiness({
    completenessPct,
    score: report.score,
    errorCount: report.errors.length,
  });

  return {
    record_id: recordId,
    state: record.state ?? null,
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
    readiness,
  };
}

function buildAggregate(records) {
  const n = records.length;
  if (n === 0) return { average_completeness_pct: 0, average_validation_score: 0, fields_most_often_missing: [] };
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
  return { average_completeness_pct: avgCompleteness, average_validation_score: avgScore, fields_most_often_missing: fieldsMostOftenMissing };
}

async function resolveRecordIds(stateCode, args) {
  if (args.includes("--all-in-state")) {
    const prefix = `${stateCode.toLowerCase()}-`;
    const files = (await readdir(LOCALITIES_DIR)).filter((f) => f.startsWith(prefix) && f.endsWith(".json"));
    return files.map((f) => path.basename(f, ".json")).sort();
  }
  return args.filter((a) => !a.startsWith("--"));
}

async function main() {
  const [stateCode, ...rest] = process.argv.slice(2);
  if (!stateCode || !STATE_SLUGS[stateCode]) {
    console.error(`usage: node scripts/evaluate-state-batch.mjs <STATE_CODE> <record_id...> | --all-in-state`);
    console.error(`  known state codes: ${Object.keys(STATE_SLUGS).join(", ")}`);
    process.exit(1);
  }
  const recordIds = await resolveRecordIds(stateCode, rest);
  if (recordIds.length === 0) {
    console.error(`error: no record ids given/found for state ${stateCode}`);
    process.exit(1);
  }

  const records = [];
  for (const id of recordIds) records.push(await evaluateRecord(id));

  const ready = records.filter((r) => r.readiness === "READY");
  const limited = records.filter((r) => r.readiness === "LIMITED");
  const notReady = records.filter((r) => r.readiness === "NOT_READY");

  const report = {
    state: stateCode,
    generated_at: new Date().toISOString(),
    records,
    aggregate: buildAggregate(records),
    batch_recommendation: {
      recommended_publish_record_ids: ready.map((r) => r.record_id),
      limited_for_now: limited.map((r) => ({ record_id: r.record_id, city: r.city, reason: `readiness=LIMITED (completeness ${r.completeness_pct}%, score ${r.validation_score})` })),
      not_ready: notReady.map((r) => ({ record_id: r.record_id, city: r.city, reason: `readiness=NOT_READY (error_count=${r.error_count})` })),
    },
  };

  const outPath = path.join(REPO_ROOT, "output", `${STATE_SLUGS[stateCode]}-batch-evaluation.json`);
  await writeFile(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report, null, 2));
  console.error(`\nEvaluation written to ${path.relative(REPO_ROOT, outPath)}`);
}

// Direct-execution guard: main() only runs when this file is the process's
// entry point, never when it's imported (by a test or anything else).
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  main().catch((err) => {
    console.error(err.stack ?? String(err));
    process.exit(1);
  });
}
