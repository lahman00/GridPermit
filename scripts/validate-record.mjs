#!/usr/bin/env node
// Runs the mechanical checks defined in agents/data-validator.md against one
// data/localities/*.json record. Read-only on the source record: it only
// ever writes to output/validation-reports/. See docs/DATA_ARCHITECTURE.md.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const REPO_ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const SCHEMA_PATH = path.join(REPO_ROOT, "data", "schema.json");
const REPORT_DIR = path.join(REPO_ROOT, "output", "validation-reports");

const HEDGE_WORDS = [
  "could not", "not confirmed", "not independently", "unable to",
  "not directly rendered", "could not be verified", "blocked",
];
const FIELD_NAMES = [
  "utility", "city", "county", "permit_authority", "permit_url",
  "interconnection_url", "battery_programs", "required_documents",
  "inspection_steps", "timeline_days", "permit_fees", "rebates",
  "official_contacts",
];
const MONETARY_FIELDS = ["permit_fees", "battery_programs", "rebates"];
const WEAK_SOURCE_TYPES = new Set(["government", "other_official"]);
const KNOWN_UTILITIES = [
  ["PG&E", "PACIFIC GAS"],
  ["SCE", "SOUTHERN CALIFORNIA EDISON"],
  ["SDG&E", "SAN DIEGO GAS"],
];
const STALE_DAYS_THRESHOLD = 180;
const FETCH_TIMEOUT_MS = 10_000;

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function addFinding(list, field, category, message) {
  list.push({ field, category, message });
}

function utilityFamiliesIn(text) {
  if (!text) return [];
  const upper = text.toUpperCase();
  const found = [];
  for (const family of KNOWN_UTILITIES) {
    if (family.some((alias) => upper.includes(alias))) found.push(family);
  }
  return found;
}

function conflictsWithRecordUtility(text, recordUtility) {
  const families = utilityFamiliesIn(text);
  if (families.length === 0) return false;
  const recordUpper = (recordUtility || "").toUpperCase();
  return !families.some((family) => family.some((alias) => recordUpper.includes(alias)));
}

async function checkUrl(url) {
  // Returns { ok, status, error, blocked }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let res = await fetch(url, { method: "HEAD", signal: controller.signal, redirect: "follow" });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { method: "GET", signal: controller.signal, redirect: "follow" });
    }
    clearTimeout(timer);
    if (res.status >= 200 && res.status < 300) return { ok: true, status: res.status };
    if (res.status === 404 || res.status === 410) return { ok: false, status: res.status, blocked: false };
    // 401/403/429/503/other non-2xx: treat as blocked/unverifiable, not confirmed-broken
    return { ok: false, status: res.status, blocked: true };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, status: null, blocked: true, error: err.message };
  }
}

function collectAllUrls(record) {
  // { label, url } pairs for every URL embedded anywhere in the record.
  const urls = [];
  const pv = record.permit_url?.value;
  if (pv) urls.push({ label: "permit_url", url: pv });
  const iv = record.interconnection_url?.value;
  if (iv) urls.push({ label: "interconnection_url", url: iv });

  for (const fn of ["battery_programs", "rebates", "permit_fees", "official_contacts"]) {
    const arr = record[fn]?.value;
    if (Array.isArray(arr)) {
      arr.forEach((item, i) => {
        if (item?.url) urls.push({ label: `${fn}[${i}].url`, url: item.url });
      });
    }
  }
  for (const s of record.sources ?? []) {
    if (s?.url) urls.push({ label: `sources[${s.id}].url`, url: s.url });
  }
  return urls;
}

async function validate(filePath) {
  const errors = [];
  const warnings = [];
  const recommendations = [];

  const [schemaRaw, recordRaw] = await Promise.all([
    readFile(SCHEMA_PATH, "utf8"),
    readFile(filePath, "utf8"),
  ]);
  const schema = JSON.parse(schemaRaw);
  const record = JSON.parse(recordRaw);

  // 1. schema_violation
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validateFn = ajv.compile(schema);
  const schemaValid = validateFn(record);
  if (!schemaValid) {
    for (const e of validateFn.errors ?? []) {
      addFinding(errors, e.instancePath || null, "schema_violation", `${e.instancePath || "(root)"} ${e.message}`);
    }
  }

  // 2. missing_required_field (explicit, in addition to schema check)
  for (const key of schema.required ?? []) {
    if (!(key in record)) {
      addFinding(errors, key, "missing_required_field", `top-level key '${key}' is absent`);
    }
  }

  const sourceIdsKnown = new Set((record.sources ?? []).map((s) => s.id));

  for (const fn of FIELD_NAMES) {
    const f = record[fn];
    if (!f || typeof f !== "object") continue;
    const { value, confidence, source_ids: sourceIds = [], notes } = f;

    // 3. missing_source (dangling references)
    for (const sid of sourceIds) {
      if (!sourceIdsKnown.has(sid)) {
        addFinding(errors, fn, "missing_source", `source_ids references '${sid}' which does not exist in sources[]`);
      }
    }

    // 5. confidence_inconsistency
    if (value === null && confidence > 0) {
      addFinding(errors, fn, "confidence_inconsistency", `value is null but confidence=${confidence} (must be 0)`);
    }
    if (value !== null && confidence === 0) {
      addFinding(errors, fn, "confidence_inconsistency", `value is non-null but confidence=0`);
    }
    if (value !== null && confidence >= 0.8 && notes && HEDGE_WORDS.some((h) => notes.toLowerCase().includes(h))) {
      addFinding(warnings, fn, "confidence_inconsistency", `confidence=${confidence} but notes hedge: '${notes}'`);
    }

    // 6. impossible_value: empty string where null was the honest option
    if (typeof value === "string" && value.trim() === "") {
      addFinding(errors, fn, "impossible_value", "value is an empty string; should be null if unknown");
    }
  }

  // 6. impossible_value: dates in the future
  const now = new Date();
  for (const s of record.sources ?? []) {
    if (s.accessed_date && new Date(s.accessed_date) > now) {
      addFinding(errors, null, "impossible_value", `source ${s.id} accessed_date ${s.accessed_date} is in the future`);
    }
  }
  if (record.last_verified && new Date(record.last_verified) > now) {
    addFinding(errors, "last_verified", "impossible_value", `last_verified ${record.last_verified} is in the future`);
  }

  // 6. impossible_value: timeline_days min/max, negative numbers
  const td = record.timeline_days?.value;
  if (td) {
    if (td.min_days != null && td.min_days < 0) addFinding(errors, "timeline_days", "impossible_value", "min_days is negative");
    if (td.max_days != null && td.max_days < 0) addFinding(errors, "timeline_days", "impossible_value", "max_days is negative");
    if (td.min_days != null && td.max_days != null && td.min_days > td.max_days) {
      addFinding(errors, "timeline_days", "impossible_value", `min_days (${td.min_days}) > max_days (${td.max_days})`);
    }
  }
  for (const fn of ["battery_programs", "rebates", "permit_fees"]) {
    const arr = record[fn]?.value;
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      for (const key of ["amount_usd", "value_usd_flat", "value_usd_per_kwh"]) {
        const v = item?.[key];
        if (v == null) continue;
        if (v < 0) addFinding(errors, fn, "impossible_value", `${item.name}.${key} = ${v} is negative`);
        if (key === "value_usd_per_kwh" && v > 5000) {
          addFinding(warnings, fn, "impossible_value", `${item.name}.${key} = ${v} exceeds $5000/kWh sanity ceiling, recommend human check`);
        }
      }
    }
  }

  // 4. duplicate_source
  const byId = new Map();
  const byUrl = new Map();
  for (const s of record.sources ?? []) {
    byId.set(s.id, (byId.get(s.id) ?? []).concat(s));
    const norm = (s.url ?? "").replace(/\/$/, "");
    byUrl.set(norm, (byUrl.get(norm) ?? []).concat(s));
  }
  for (const [id, entries] of byId) {
    if (entries.length > 1) addFinding(errors, null, "duplicate_source", `duplicate source id '${id}' used ${entries.length} times`);
  }
  for (const [url, entries] of byUrl) {
    if (entries.length > 1) {
      addFinding(warnings, null, "duplicate_source", `duplicate source url '${url}' under different ids: ${entries.map((e) => e.id).join(", ")}`);
    }
  }

  // 7. outdated_information
  if (record.last_verified) {
    const ageDays = Math.floor((now - new Date(record.last_verified)) / 86_400_000);
    if (ageDays > STALE_DAYS_THRESHOLD) {
      addFinding(warnings, "last_verified", "outdated_information", `last_verified is ${ageDays} days old (>${STALE_DAYS_THRESHOLD} day policy)`);
    }
  }
  const lvYear = record.last_verified ? new Date(record.last_verified).getFullYear() : null;
  for (const fn of ["battery_programs", "rebates"]) {
    const arr = record[fn]?.value;
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      const desc = item.description ?? "";
      const yearMatches = [...desc.matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]));
      for (const y of yearMatches) {
        if (/through/i.test(desc) && lvYear != null && y < lvYear) {
          addFinding(warnings, fn, "outdated_information", `${item.name} description states availability 'through ${y}', which has elapsed as of last_verified ${record.last_verified}`);
        }
      }
    }
  }

  // 9. unsupported_claim: monetary fields sourced only by weak-tier types
  const sourcesById = new Map((record.sources ?? []).map((s) => [s.id, s]));
  for (const fn of MONETARY_FIELDS) {
    const f = record[fn];
    if (f?.value == null) continue;
    const types = new Set(f.source_ids.map((sid) => sourcesById.get(sid)?.type).filter(Boolean));
    if (types.size > 0 && [...types].every((t) => WEAK_SOURCE_TYPES.has(t))) {
      addFinding(warnings, fn, "unsupported_claim", `monetary field sourced only by weak-tier types [${[...types].join(", ")}]; recommend a cpuc/utility/program_administrator source`);
    }
  }

  // 10. conflicting_information: utility name cross-check
  const recordUtility = record.utility?.value;
  for (const fn of ["battery_programs", "rebates"]) {
    const arr = record[fn]?.value;
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (conflictsWithRecordUtility(item.administrator, recordUtility)) {
        addFinding(errors, fn, "conflicting_information", `administrator '${item.administrator}' does not match record utility '${recordUtility}'`);
      }
    }
  }
  const contacts = record.official_contacts?.value;
  if (Array.isArray(contacts)) {
    for (const c of contacts) {
      const text = `${c.role ?? ""} ${c.email ?? ""}`;
      if (conflictsWithRecordUtility(text, recordUtility)) {
        addFinding(errors, "official_contacts", "conflicting_information", `contact '${JSON.stringify(c)}' references a different utility than record utility '${recordUtility}'`);
      }
    }
  }

  // 8. broken_url — live fetch of every URL in the record
  const allUrls = collectAllUrls(record);
  const seenUrls = new Set();
  for (const { label, url } of allUrls) {
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    const result = await checkUrl(url);
    if (!result.ok) {
      if (result.blocked) {
        addFinding(warnings, label, "broken_url", `${url} — HTTP ${result.status ?? "n/a"}${result.error ? ` (${result.error})` : ""}: blocked/unverifiable, not confirmed broken — recommend a manual check`);
      } else {
        addFinding(errors, label, "broken_url", `${url} — HTTP ${result.status}: confirmed not found/removed`);
      }
    }
  }

  // Recommendations: only for genuinely null/low-confidence fields, no generic filler.
  for (const fn of FIELD_NAMES) {
    const f = record[fn];
    if (f && f.value === null) {
      recommendations.push({ field: fn, message: `'${fn}' is null — no recommendation to invent one; re-run the Data Collector once a verifiable official source is found.` });
    }
  }

  const score = Math.max(0, 100 - 20 * errors.length - 5 * warnings.length);
  const status = errors.length > 0 ? "FAIL" : warnings.length > 0 ? "REVIEW" : "PASS";

  return {
    record_id: record.record_id ?? null,
    file: path.relative(REPO_ROOT, filePath),
    validated_at: now.toISOString().slice(0, 10),
    status,
    score,
    errors,
    warnings,
    recommendations,
  };
}

async function main() {
  const inputArg = process.argv[2];
  if (!inputArg) fail("usage: node scripts/validate-record.mjs <path-to-record.json>");
  const filePath = path.resolve(inputArg);
  if (!existsSync(filePath)) fail(`file not found: ${filePath}`);

  const report = await validate(filePath);

  await mkdir(REPORT_DIR, { recursive: true });
  const reportPath = path.join(REPORT_DIR, path.basename(filePath));
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log(JSON.stringify(report, null, 2));
  console.error(`\nReport written to ${path.relative(REPO_ROOT, reportPath)}`);

  process.exit(report.status === "FAIL" ? 1 : 0);
}

main().catch((err) => fail(err.stack ?? String(err)));
