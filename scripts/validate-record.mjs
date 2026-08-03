#!/usr/bin/env node
// Runs the mechanical checks defined in agents/data-validator.md against one
// data/localities/*.json record. Read-only on the source record: it only
// ever writes to output/validation-reports/. See docs/DATA_ARCHITECTURE.md.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const REPO_ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const SCHEMA_PATH = path.join(REPO_ROOT, "data", "schema.json");
const REPORT_DIR = path.join(REPO_ROOT, "output", "validation-reports");

// Only phrases about the FACT itself. Phrases about network/retrieval access
// ("blocked", "403", "could not render", "could not fetch") must NOT appear
// here — a source being blocked to automated access is a broken_url finding
// (see checkUrl below), never evidence against factual confidence. This is
// the deterministic form of "do not downgrade confidence solely because a
// valid official URL blocks automated access" — see docs/DATA_ARCHITECTURE.md.
const HEDGE_WORDS = [
  "not confirmed", "not independently confirmed", "uncertain",
  "disputed", "uncorroborated", "unverified claim",
];

const BOT_CHALLENGE_MARKERS = [
  "just a moment", "checking your browser", "cf-chl", "captcha",
  "attention required", "verify you are human", "enable javascript and cookies",
];
const REACHABLE = "REACHABLE";
const BLOCKED_OR_UNVERIFIABLE = "BLOCKED_OR_UNVERIFIABLE";
const CONFIRMED_BROKEN = "CONFIRMED_BROKEN";
const URL_CHECK_PENALTY = { [BLOCKED_OR_UNVERIFIABLE]: 2 };
const OTHER_WARNING_PENALTY = 5;
const ERROR_PENALTY = 20;
// Same 15-field list as scripts/evaluate-pilot.mjs's COVERAGE_FIELDS and
// scripts/render-locality-summary.mjs's COVERAGE_FIELDS — every researched
// field in data/schema.json except record-level metadata (record_id,
// schema_version, last_verified, sources). Kept as a separate literal here
// (not imported) so each of these three standalone CLIs has no dependency on
// the others; update all three together if a field is ever added/removed
// from the schema.
const FIELD_NAMES = [
  "utility", "generation_supplier", "city", "county", "permit_authority", "permit_url",
  "interconnection_url", "battery_programs", "required_documents",
  "inspection_steps", "timeline_days", "eligibility_constraints", "permit_fees", "rebates",
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

function classifyNetworkError(err) {
  // Every network-level failure (DNS, TLS, timeout, reset, generic connection
  // failure) is BLOCKED_OR_UNVERIFIABLE, never CONFIRMED_BROKEN — a network
  // failure is not proof the resource was removed. Malformed URLs and
  // unsupported protocols are checked separately, before any fetch is attempted.
  if (err.name === "AbortError") return "timeout";
  const code = err.cause?.code ?? err.code;
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return `DNS failure (${code})`;
  if (code === "ECONNRESET") return "connection reset";
  if (code === "ECONNREFUSED") return `connection refused (${code})`;
  if (typeof code === "string" && code.startsWith("CERT_")) return `TLS/certificate failure (${code})`;
  if (code === "EPROTO" || code === "ERR_TLS_CERT_ALTNAME_INVALID") return `TLS/network failure (${code})`;
  return `network failure (${err.message})`;
}

function bodyLooksLikeBotChallenge(bodySnippet) {
  const lower = bodySnippet.toLowerCase();
  return BOT_CHALLENGE_MARKERS.some((m) => lower.includes(m));
}

async function checkUrl(url) {
  const checkedAt = new Date().toISOString();
  const base = { url, checked_at: checkedAt };

  // Pre-flight: malformed URL / unsupported protocol -> CONFIRMED_BROKEN,
  // no network call attempted.
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ...base, status: CONFIRMED_BROKEN, http_status: null, method: "HEAD", details: "malformed URL" };
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { ...base, status: CONFIRMED_BROKEN, http_status: null, method: "HEAD", details: `unsupported protocol '${parsed.protocol}'` };
  }

  let method = "HEAD";
  let res;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      res = await fetch(url, { method: "HEAD", signal: controller.signal, redirect: "follow" });
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 405 || res.status === 501) {
      method = "GET";
      const controller2 = new AbortController();
      const timer2 = setTimeout(() => controller2.abort(), FETCH_TIMEOUT_MS);
      try {
        res = await fetch(url, { method: "GET", signal: controller2.signal, redirect: "follow" });
      } finally {
        clearTimeout(timer2);
      }
    }
  } catch (err) {
    return { ...base, status: BLOCKED_OR_UNVERIFIABLE, http_status: null, method, details: classifyNetworkError(err) };
  }

  if (res.status === 404 || res.status === 410) {
    return { ...base, status: CONFIRMED_BROKEN, http_status: res.status, method, details: `HTTP ${res.status}: confirmed not found/removed` };
  }
  if ([401, 403, 429].includes(res.status)) {
    return { ...base, status: BLOCKED_OR_UNVERIFIABLE, http_status: res.status, method, details: `HTTP ${res.status}: blocked/unverifiable, not confirmed broken` };
  }
  if (res.status >= 200 && res.status < 400) {
    // Reachable by status code, but sniff the body for a bot-challenge page
    // (some WAFs return HTTP 200 for a CAPTCHA/interstitial rather than 403).
    if (method === "GET") {
      try {
        const text = (await res.text()).slice(0, 4000);
        if (bodyLooksLikeBotChallenge(text)) {
          return { ...base, status: BLOCKED_OR_UNVERIFIABLE, http_status: res.status, method, details: `HTTP ${res.status} but body matches a known bot-challenge marker` };
        }
      } catch {
        // Body unreadable; fall through and trust the status code.
      }
    }
    return { ...base, status: REACHABLE, http_status: res.status, method, details: `HTTP ${res.status}` };
  }
  // Any other status (5xx, or anything not explicitly enumerated above) is
  // treated as unverifiable rather than confirmed-broken — only 404/410 are
  // treated as a removal signal; see agents/data-validator.md check 8.
  return { ...base, status: BLOCKED_OR_UNVERIFIABLE, http_status: res.status, method, details: `HTTP ${res.status}: not a removal signal, treated as unverifiable` };
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

export async function validate(filePath) {
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

    // 3. missing_source, per-item: required_documents items each carry their
    // own source_ids independent of the field-level ones (schema v1.2.0+).
    if (fn === "required_documents" && Array.isArray(value)) {
      for (const doc of value) {
        for (const sid of doc.source_ids ?? []) {
          if (!sourceIdsKnown.has(sid)) {
            addFinding(errors, fn, "missing_source", `required_documents item '${doc.name}' source_ids references '${sid}' which does not exist in sources[]`);
          }
        }
        if ((doc.source_ids ?? []).length === 0) {
          addFinding(errors, fn, "missing_source", `required_documents item '${doc.name}' has no source_ids`);
        }
      }
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
      for (const key of ["amount_usd", "value_usd_flat", "value_usd_per_kwh", "value_usd_per_watt"]) {
        const v = item?.[key];
        if (v == null) continue;
        if (v < 0) addFinding(errors, fn, "impossible_value", `${item.name}.${key} = ${v} is negative`);
        if (key === "value_usd_per_kwh" && v > 5000) {
          addFinding(warnings, fn, "impossible_value", `${item.name}.${key} = ${v} exceeds $5000/kWh sanity ceiling, recommend human check`);
        }
      }
    }
  }

  // 6. impossible_value: more than one monetary unit populated on the same
  // program item is a likely data-entry mistake (e.g. a $/kWh value and a
  // $/Watt value both set, when only one should apply to this tier) unless
  // the item's own description explains that it genuinely has multiple
  // components (e.g. "storage incentive ... paired with a solar incentive").
  const MULTI_COMPONENT_PHRASES = ["paired with", "plus", "combined with", "in addition to", "along with"];
  for (const fn of ["battery_programs", "rebates"]) {
    const arr = record[fn]?.value;
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      const populatedUnits = ["value_usd_per_kwh", "value_usd_flat", "value_usd_per_watt"].filter((k) => item?.[k] != null);
      if (populatedUnits.length > 1) {
        const desc = (item.description ?? "").toLowerCase();
        const explainsMultiple = MULTI_COMPONENT_PHRASES.some((p) => desc.includes(p));
        if (!explainsMultiple) {
          addFinding(warnings, fn, "impossible_value", `${item.name}: more than one monetary unit populated (${populatedUnits.join(", ")}) without an explanation in description — recommend human check`);
        }
      }
    }
  }

  // 6. impossible_value: battery_programs/rebates status vs effective_from/expires_on consistency.
  for (const fn of ["battery_programs", "rebates"]) {
    const arr = record[fn]?.value;
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (item.effective_from && item.expires_on && new Date(item.effective_from) > new Date(item.expires_on)) {
        addFinding(errors, fn, "impossible_value", `${item.name}: effective_from (${item.effective_from}) is after expires_on (${item.expires_on})`);
      }
      if (item.expires_on) {
        const expired = new Date(item.expires_on) < now;
        if (expired && item.status === "active") {
          addFinding(warnings, fn, "confidence_inconsistency", `${item.name}: status is 'active' but expires_on (${item.expires_on}) has already passed`);
        }
        if (!expired && item.status === "expired") {
          addFinding(warnings, fn, "confidence_inconsistency", `${item.name}: status is 'expired' but expires_on (${item.expires_on}) is still in the future`);
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
      // Prefer the structured expires_on field (schema v1.2.0+) when present
      // — it's precise, so the text heuristic below would only duplicate it.
      if (item.expires_on) {
        if (new Date(item.expires_on) < now) {
          addFinding(warnings, fn, "outdated_information", `${item.name}: expires_on (${item.expires_on}) has elapsed as of last_verified ${record.last_verified}`);
        }
        continue;
      }
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

  // 8. broken_url — live fetch of every URL in the record, three-state result.
  // REACHABLE costs nothing and is not added to errors/warnings, only to
  // url_checks (full evidence trail for every URL, not just failing ones).
  const allUrls = collectAllUrls(record);
  const seenUrls = new Set();
  const urlChecks = [];
  for (const { label, url } of allUrls) {
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    const result = await checkUrl(url);
    urlChecks.push(result);
    if (result.status === CONFIRMED_BROKEN) {
      addFinding(errors, label, "broken_url", `${url} — ${result.details}`);
    } else if (result.status === BLOCKED_OR_UNVERIFIABLE) {
      addFinding(warnings, label, "broken_url", `${url} — ${result.details} — recommend a manual check`);
    }
    // REACHABLE: no finding. Requirement 4: a blocked/broken URL never
    // touches the field's own confidence score — that stays whatever the
    // Data Collector recorded; only errors/warnings/score reflect this check.
  }

  // Recommendations: only for genuinely null/low-confidence fields, no generic filler.
  for (const fn of FIELD_NAMES) {
    const f = record[fn];
    if (f && f.value === null) {
      recommendations.push({ field: fn, message: `'${fn}' is null — no recommendation to invent one; re-run the Data Collector once a verifiable official source is found.` });
    }
  }

  const urlWarningCount = warnings.filter((w) => w.category === "broken_url").length;
  const otherWarningCount = warnings.length - urlWarningCount;
  const score = Math.max(
    0,
    100 - ERROR_PENALTY * errors.length
      - URL_CHECK_PENALTY[BLOCKED_OR_UNVERIFIABLE] * urlWarningCount
      - OTHER_WARNING_PENALTY * otherWarningCount,
  );
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
    url_checks: urlChecks,
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

// Direct-execution guard: main() only runs when this file is the process's
// entry point, never when it's imported (by a test or anything else).
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  main().catch((err) => fail(err.stack ?? String(err)));
}
