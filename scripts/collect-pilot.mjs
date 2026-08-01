#!/usr/bin/env node
// Batch collection pipeline for the controlled California pilot.
// See docs/PILOT_RUNBOOK.md for the full operating procedure.
//
// This script never researches anything itself — it delegates to
// scripts/lib/collection-adapter.mjs (today: reads a pre-supplied payload
// from data/source-payloads/), writes the result to data/localities/ (never
// overwriting an existing file unless --force <record_id> targets it
// specifically), and chains scripts/validate-record.mjs against every
// record it writes.
//
// Importing this file (e.g. from a test) never runs anything — see the
// direct-execution guard at the bottom. TARGETS_PATH and RUNS_DIR can be
// overridden via PILOT_TARGETS_PATH / PILOT_RUNS_DIR env vars for test
// isolation; real usage never needs to set either.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { collect } from "./lib/collection-adapter.mjs";

const execFile = promisify(execFileCb);

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const TARGETS_PATH = process.env.PILOT_TARGETS_PATH
  ? path.resolve(process.env.PILOT_TARGETS_PATH)
  : path.join(REPO_ROOT, "data", "pilot-targets.json");
const VALIDATOR_PATH = path.join(REPO_ROOT, "scripts", "validate-record.mjs");
const RUNS_DIR = process.env.PILOT_RUNS_DIR
  ? path.resolve(process.env.PILOT_RUNS_DIR)
  : path.join(REPO_ROOT, "output", "pilot-runs");

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function isKebabCase(str) {
  return typeof str === "string" && KEBAB_CASE.test(str);
}

function stripDiacritics(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function slugify(str) {
  return stripDiacritics(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Recomputes county_slug/city_slug/record_id/file paths from a target's
 * display fields and compares against what's stored in
 * data/pilot-targets.json. utility_slug is taken as given, not derived —
 * only checked for presence and kebab-case shape (see docs/DATA_ARCHITECTURE.md
 * on why the filename's segment boundaries can't be mechanically re-derived
 * from a display name in general). This is check #1 of --dry-run:
 * "validates target naming."
 */
function validateTargetNaming(target) {
  const problems = [];

  for (const field of ["utility", "city", "county", "state"]) {
    if (typeof target[field] !== "string" || target[field].trim() === "") {
      problems.push(`'${field}' is missing or empty`);
    }
  }

  if (!/^[a-z]{2}$/.test(target.state_code || "")) {
    problems.push(`state_code '${target.state_code}' is not a 2-letter lowercase code`);
  }

  if (!isKebabCase(target.utility_slug)) {
    problems.push(`utility_slug '${target.utility_slug}' is not lowercase kebab-case`);
  }
  if (!isKebabCase(target.county_slug)) {
    problems.push(`county_slug '${target.county_slug}' is not lowercase kebab-case`);
  }
  if (!isKebabCase(target.city_slug)) {
    problems.push(`city_slug '${target.city_slug}' is not lowercase kebab-case`);
  }

  const countySlug = slugify((target.county || "").replace(/\s+county$/i, ""));
  const citySlug = slugify(target.city || "");

  if (countySlug !== target.county_slug) {
    problems.push(`county_slug '${target.county_slug}' does not match derived '${countySlug}' from county '${target.county}'`);
  }
  if (citySlug !== target.city_slug) {
    problems.push(`city_slug '${target.city_slug}' does not match derived '${citySlug}' from city '${target.city}'`);
  }

  const expectedRecordId = [
    target.state_code,
    ...(target.county_slug || "").split("-"),
    ...(target.city_slug || "").split("-"),
    target.utility_slug,
  ].join("-");

  if (expectedRecordId !== target.record_id) {
    problems.push(`record_id '${target.record_id}' does not match derived '${expectedRecordId}'`);
  }

  // Real targets always use the standard repo-relative paths, checked in
  // full. Test fixtures use absolute paths (for isolation from real repo
  // data) and are only checked for a matching basename — see
  // tests/collect-pilot.test.mjs.
  const expectedBasename = `${target.record_id}.json`;
  if (path.isAbsolute(target.locality_file || "")) {
    if (path.basename(target.locality_file) !== expectedBasename) {
      problems.push(`locality_file '${target.locality_file}' basename does not match expected '${expectedBasename}'`);
    }
  } else {
    const expectedLocalityFile = `data/localities/${expectedBasename}`;
    if (target.locality_file !== expectedLocalityFile) {
      problems.push(`locality_file '${target.locality_file}' does not match expected '${expectedLocalityFile}'`);
    }
  }
  if (path.isAbsolute(target.source_payload_file || "")) {
    if (path.basename(target.source_payload_file) !== expectedBasename) {
      problems.push(`source_payload_file '${target.source_payload_file}' basename does not match expected '${expectedBasename}'`);
    }
  } else {
    const expectedPayloadFile = `data/source-payloads/${expectedBasename}`;
    if (target.source_payload_file !== expectedPayloadFile) {
      problems.push(`source_payload_file '${target.source_payload_file}' does not match expected '${expectedPayloadFile}'`);
    }
  }

  return { valid: problems.length === 0, problems };
}

/**
 * Guard against a target whose recorded utility has been found, by prior
 * research, to NOT actually serve the named city — this exists because of
 * a real incident: a target named "Southern California Edison" for
 * Pasadena, which turned out to be served by its own municipal utility
 * (Pasadena Water and Power), not SCE. Collecting for that target would
 * have produced a factually wrong record.
 *
 * This is not a live check — scripts/lib/collection-adapter.mjs's own rule
 * ("no live research inside this script") applies here too. It only
 * enforces pre-recorded verification evidence a human (or a future
 * automated agent) attached to the target in data/pilot-targets.json, as
 * `target.utility_verification`:
 *
 *   { status: "confirmed" | "contradicted",
 *     evidence: [{ claim, source_url, source_title, publisher }],
 *     checked_at, notes }
 *
 * Absent, or status "confirmed" -> valid, collection proceeds as normal
 * (this is the case for every target that hasn't hit a problem — it is
 * NOT "invalid until proven correct"). Any other status (e.g.
 * "contradicted") -> invalid: CONFIG_ERROR, with the evidence surfaced.
 */
function validateUtilityAssignment(target) {
  const v = target.utility_verification;
  if (!v || v.status === "confirmed") {
    return { valid: true };
  }
  return { valid: false, evidence: v.evidence ?? [], notes: v.notes ?? null };
}

async function runValidator(localityPath) {
  try {
    const { stdout } = await execFile("node", [VALIDATOR_PATH, localityPath], { cwd: REPO_ROOT });
    return JSON.parse(stdout);
  } catch (err) {
    if (err.stdout) {
      try {
        return JSON.parse(err.stdout);
      } catch {
        // fall through to rethrow the original error
      }
    }
    throw err;
  }
}

async function processTarget(target, { dryRun, force }) {
  const localityPath = path.resolve(REPO_ROOT, target.locality_file);
  const payloadPath = path.resolve(REPO_ROOT, target.source_payload_file);

  const naming = validateTargetNaming(target);
  if (!naming.valid) {
    return {
      record_id: target.record_id,
      target,
      status: "CONFIG_ERROR",
      locality_file: target.locality_file,
      validation_report: null,
      score: null,
      message: `target naming does not validate: ${naming.problems.join("; ")}`,
    };
  }

  const utilityCheck = validateUtilityAssignment(target);
  if (!utilityCheck.valid) {
    return {
      record_id: target.record_id,
      target,
      status: "CONFIG_ERROR",
      locality_file: target.locality_file,
      validation_report: null,
      score: null,
      message: `utility assignment contradicted by official evidence${utilityCheck.notes ? `: ${utilityCheck.notes}` : ""}`,
      evidence: utilityCheck.evidence,
    };
  }

  const localityExists = existsSync(localityPath);
  const payloadExists = existsSync(payloadPath);

  if (dryRun) {
    return {
      record_id: target.record_id,
      target,
      status: "PLANNED",
      locality_file: target.locality_file,
      validation_report: `output/validation-reports/${target.record_id}.json`,
      score: null,
      message: localityExists
        ? force
          ? `would be FORCE-OVERWRITTEN (--force targeted this record)`
          : `would be SKIPPED_EXISTS (locality file already present; use --force ${target.record_id} to overwrite)`
        : payloadExists
          ? `would be COLLECTED from ${target.source_payload_file}, then validated`
          : `would be COLLECTION_REQUIRED (no source payload at ${target.source_payload_file})`,
      naming_valid: true,
      locality_exists: localityExists,
      payload_exists: payloadExists,
    };
  }

  if (localityExists && !force) {
    return {
      record_id: target.record_id,
      target,
      status: "SKIPPED_EXISTS",
      locality_file: target.locality_file,
      validation_report: null,
      score: null,
      message: `${target.locality_file} already exists; not overwritten (use --force ${target.record_id} to overwrite this specific record)`,
    };
  }

  const { payload, reason } = await collect(target);
  if (!payload) {
    return {
      record_id: target.record_id,
      target,
      status: "COLLECTION_REQUIRED",
      locality_file: target.locality_file,
      validation_report: null,
      score: null,
      message: reason,
    };
  }

  if (payload.record_id !== target.record_id) {
    return {
      record_id: target.record_id,
      target,
      status: "FAIL",
      locality_file: target.locality_file,
      validation_report: null,
      score: null,
      message: `source payload record_id '${payload.record_id}' does not match target record_id '${target.record_id}' — refusing to write`,
    };
  }

  await mkdir(path.dirname(localityPath), { recursive: true });
  await writeFile(localityPath, JSON.stringify(payload, null, 2) + "\n", "utf8");

  const report = await runValidator(localityPath);
  return {
    record_id: target.record_id,
    target,
    status: report.status,
    locality_file: target.locality_file,
    validation_report: `output/validation-reports/${target.record_id}.json`,
    score: report.score,
    message: `validated: ${report.status}, score ${report.score} (${report.errors.length} errors, ${report.warnings.length} warnings)`,
  };
}

function printPlan(results, forceRecordId, forceMatchedSomething) {
  console.log("=== DRY RUN — no records were created or modified ===\n");
  if (forceRecordId && !forceMatchedSomething) {
    console.log(`WARNING: --force ${forceRecordId} does not match any target's record_id. A real run would exit 1 (CONFIG_ERROR).\n`);
  }
  for (const r of results) {
    console.log(`${r.record_id}`);
    if (!r.target) {
      // Synthetic result (e.g. an unmatched --force record_id) — no real target to describe.
      console.log(`  planned outcome: ${r.status} — ${r.message}\n`);
      continue;
    }
    console.log(`  locality_file:   ${r.locality_file} (exists: ${r.locality_exists ?? "n/a"})`);
    console.log(`  payload_file:    ${r.target.source_payload_file} (exists: ${r.payload_exists ?? "n/a"})`);
    console.log(`  validation_out:  ${r.validation_report}`);
    console.log(`  naming_valid:    ${r.status === "CONFIG_ERROR" && !r.evidence ? false : true}`);
    console.log(`  planned outcome: ${r.status} — ${r.message}`);
    if (r.evidence && r.evidence.length) {
      console.log(`  evidence:`);
      for (const e of r.evidence) {
        console.log(`    - ${e.claim} (${e.source_title ?? e.source_url}, ${e.source_url})`);
      }
    }
    console.log("");
  }
}

function parseArgs(argv) {
  const dryRun = argv.includes("--dry-run");
  const forceIndex = argv.indexOf("--force");
  let forceRecordId = null;
  let usageError = null;

  if (forceIndex !== -1) {
    const val = argv[forceIndex + 1];
    if (!val || val.startsWith("--")) {
      usageError = "--force requires a record_id argument, e.g. --force ca-alameda-fremont-pge (force-all is not supported)";
    } else {
      forceRecordId = val;
    }
  }

  return { dryRun, forceRecordId, usageError };
}

export async function main(argv = process.argv.slice(2)) {
  const { dryRun, forceRecordId, usageError } = parseArgs(argv);
  if (usageError) {
    console.error(`error: ${usageError}`);
    return 1;
  }

  const targetsRaw = await readFile(TARGETS_PATH, "utf8");
  const { targets } = JSON.parse(targetsRaw);

  const forceMatchedSomething = forceRecordId ? targets.some((t) => t.record_id === forceRecordId) : true;

  const results = [];
  for (const target of targets) {
    const force = forceRecordId != null && target.record_id === forceRecordId;
    try {
      const result = await processTarget(target, { dryRun, force });
      results.push(result);
    } catch (err) {
      results.push({
        record_id: target.record_id,
        target,
        status: "FAIL",
        locality_file: target.locality_file,
        validation_report: null,
        score: null,
        message: `unexpected error: ${err.message}`,
      });
    }
  }

  if (forceRecordId && !forceMatchedSomething) {
    results.push({
      record_id: forceRecordId,
      target: null,
      status: "CONFIG_ERROR",
      locality_file: null,
      validation_report: null,
      score: null,
      message: `--force ${forceRecordId} does not match any target's record_id in ${path.relative(REPO_ROOT, TARGETS_PATH)}`,
    });
  }

  if (dryRun) {
    printPlan(results, forceRecordId, forceMatchedSomething);
    return 0;
  }

  const summary = { pass: 0, review: 0, fail: 0, collection_required: 0, skipped_exists: 0, config_error: 0 };
  for (const r of results) {
    const key = r.status.toLowerCase();
    if (key in summary) summary[key] += 1;
  }

  const runAt = new Date();
  const report = {
    run_at: runAt.toISOString(),
    dry_run: false,
    force: forceRecordId,
    targets_total: targets.length,
    results,
    summary,
  };

  await mkdir(RUNS_DIR, { recursive: true });
  const runFile = path.join(RUNS_DIR, `${runAt.toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(runFile, JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log(JSON.stringify(report, null, 2));
  console.error(`\nRun summary written to ${path.relative(REPO_ROOT, runFile)}`);

  const shouldFail = results.some((r) => r.status === "FAIL" || r.status === "CONFIG_ERROR");
  return shouldFail ? 1 : 0;
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
