#!/usr/bin/env node
// Locality-page generator. Turns each READY locality JSON record in
// data/localities/ into a thin Astro page wrapper around
// src/layouts/LocalityGuideLayout.astro — never writing a locality fact into
// the generated file itself. See docs/LOCALITY_PAGE_FACTORY.md for the full
// operating procedure and docs/PILOT_EVALUATION.md for what "READY" means.
//
// Usage:
//   node scripts/generate-locality-pages.mjs                 (same as --dry-run)
//   node scripts/generate-locality-pages.mjs --dry-run
//   node scripts/generate-locality-pages.mjs --write
//   node scripts/generate-locality-pages.mjs --write --force <record_id>
//
// Only --write performs real file writes. An existing page is never
// overwritten unless --force names that exact record_id — every other
// existing page is always left untouched, even in the same run. A record
// whose readiness isn't READY (per output/pilot-evaluation.json) is never
// generated, force or not — --force controls overwrite permission, not the
// readiness gate.
//
// Importing this file (e.g. from a test) never runs anything — see the
// direct-execution guard at the bottom. LOCALITY_PAGES_LOCALITIES_DIR /
// LOCALITY_PAGES_EVALUATION_PATH / LOCALITY_PAGES_OUTPUT_ROOT /
// LOCALITY_PAGES_LAYOUT_PATH can be overridden via env vars for test
// isolation; real usage never needs to set any of them.

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

const LOCALITIES_DIR = process.env.LOCALITY_PAGES_LOCALITIES_DIR
  ? path.resolve(process.env.LOCALITY_PAGES_LOCALITIES_DIR)
  : path.join(REPO_ROOT, "data", "localities");
const EVALUATION_PATH = process.env.LOCALITY_PAGES_EVALUATION_PATH
  ? path.resolve(process.env.LOCALITY_PAGES_EVALUATION_PATH)
  : path.join(REPO_ROOT, "output", "pilot-evaluation.json");
// Overriding LOCALITY_PAGES_OUTPUT_ROOT pins every record to that one root
// regardless of its own `state` (used by tests for a single-state fixture
// tree). Real usage never sets this — PAGES_ROOT is instead computed
// per-record from record.state below, via STATE_SLUGS.
const PAGES_ROOT_OVERRIDE = process.env.LOCALITY_PAGES_OUTPUT_ROOT
  ? path.resolve(process.env.LOCALITY_PAGES_OUTPUT_ROOT)
  : null;
const LAYOUT_PATH = process.env.LOCALITY_PAGES_LAYOUT_PATH
  ? path.resolve(process.env.LOCALITY_PAGES_LAYOUT_PATH)
  : path.join(REPO_ROOT, "src", "layouts", "LocalityGuideLayout.astro");

// Mirrors src/lib/state-meta.ts's STATE_META — kept as a separate literal
// here (not imported) so this script, like its slugify() below, has no
// dependency on the TS rendering-side lib. Keep both in sync when a new
// state is registered.
const STATE_SLUGS = {
  CA: "california",
  RI: "rhode-island",
  DE: "delaware",
  VT: "vermont",
  CO: "colorado",
  AZ: "arizona",
  HI: "hawaii",
  OR: "oregon",
  NM: "new-mexico",
};

function pagesRootFor(record) {
  if (PAGES_ROOT_OVERRIDE) return PAGES_ROOT_OVERRIDE;
  const slug = STATE_SLUGS[record.state];
  if (!slug) {
    throw new Error(
      `generate-locality-pages: record_id "${record.record_id}" has unrecognized state "${record.state}" — register it in STATE_SLUGS (and src/lib/state-meta.ts) before generating its page`,
    );
  }
  return path.join(REPO_ROOT, "src", "pages", slug);
}

function stripDiacritics(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Same algorithm as scripts/collect-pilot.mjs's slugify — kept as a separate
// literal here (not imported) so this generator has no dependency on the
// pilot-collection pipeline, only on the two inputs named above.
function slugify(str) {
  return stripDiacritics(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// A relative import path computed from actual file locations (via
// path.relative), never assumed from a fixed directory-depth constant — so
// this keeps working if PAGES_ROOT/LOCALITIES_DIR/LAYOUT_PATH are ever
// overridden (as tests do) or the page nesting depth ever changes.
function toImportPath(fromFile, toFile) {
  const rel = path.relative(path.dirname(fromFile), toFile).split(path.sep).join("/");
  return rel.startsWith(".") ? rel : `./${rel}`;
}

async function loadReadyRecordIds() {
  const raw = await readFile(EVALUATION_PATH, "utf8");
  const evaluation = JSON.parse(raw);
  return new Set(evaluation.records.filter((r) => r.readiness === "READY").map((r) => r.record_id));
}

async function loadLocalityRecords() {
  const files = (await readdir(LOCALITIES_DIR)).filter((f) => f.endsWith(".json"));
  const records = [];
  for (const file of files.sort()) {
    const filePath = path.join(LOCALITIES_DIR, file);
    const raw = await readFile(filePath, "utf8");
    const record = JSON.parse(raw);
    const recordId = record.record_id ?? path.basename(file, ".json");
    records.push({ recordId, filePath, record });
  }
  return records;
}

function planFor({ recordId, filePath, record }, { readyIds, force }) {
  const citySlug = slugify(record.city?.value ?? recordId);
  const stateSlug = PAGES_ROOT_OVERRIDE ? null : STATE_SLUGS[record.state];
  const pagesRoot = pagesRootFor(record);
  const cityDir = path.join(pagesRoot, citySlug);
  const pageFile = path.join(cityDir, "solar-permit-guide.astro");
  // stateSlug is null only under PAGES_ROOT_OVERRIDE (test fixtures), which
  // always model a single already-known state — "california" there matches
  // every existing fixture's expectations.
  const urlStateSlug = stateSlug ?? "california";
  const pagePath = `/${urlStateSlug}/${citySlug}/solar-permit-guide/`;
  const cityPath = `/${urlStateSlug}/${citySlug}/`;

  const isReady = readyIds.has(recordId);
  const pageExists = existsSync(pageFile);
  const isForced = force === recordId;

  let status;
  let message;
  if (!isReady) {
    status = "SKIPPED_NOT_READY";
    message = `readiness is not READY in ${path.relative(REPO_ROOT, EVALUATION_PATH)} — not generating a public page yet`;
  } else if (pageExists && !isForced) {
    status = "SKIPPED_EXISTS";
    message = `${path.relative(REPO_ROOT, pageFile)} already exists; not overwritten (use --write --force ${recordId} to regenerate this specific page)`;
  } else if (pageExists && isForced) {
    status = "PLANNED_FORCE_OVERWRITE";
    message = `would be FORCE-OVERWRITTEN (--force targeted this record)`;
  } else {
    status = "PLANNED";
    message = `would be created`;
  }

  return { recordId, citySlug, filePath, pageFile, pagePath, cityPath, isReady, pageExists, status, message };
}

function renderWrapper({ recordId, filePath, pageFile, pagePath, cityPath }) {
  const layoutImportPath = toImportPath(pageFile, LAYOUT_PATH);
  const jsonImportPath = toImportPath(pageFile, filePath);
  return `---
// This page consumes ${path.relative(REPO_ROOT, filePath)} directly at build
// time via LocalityGuideLayout — no locality fact is hardcoded here. All
// reusable rendering/trust logic lives in
// src/layouts/LocalityGuideLayout.astro and src/lib/locality-guide.ts.
// Generated by scripts/generate-locality-pages.mjs for record_id
// "${recordId}" — see docs/LOCALITY_PAGE_FACTORY.md. Do not hand-edit
// locality facts here; edit the JSON record and regenerate instead.
import LocalityGuideLayout from "${layoutImportPath}";
import record from "${jsonImportPath}";

const PAGE_PATH = "${pagePath}";
const CITY_PATH = "${cityPath}";
---

<LocalityGuideLayout record={record} pagePath={PAGE_PATH} cityPath={CITY_PATH} />
`;
}

function parseArgs(argv) {
  const write = argv.includes("--write");
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

  return { write, forceRecordId, usageError };
}

function printPlan(plans, forceRecordId, forceMatchedSomething) {
  console.log("=== DRY RUN — no pages were created or modified ===\n");
  if (forceRecordId && !forceMatchedSomething) {
    console.log(`WARNING: --force ${forceRecordId} does not match any locality record_id under ${path.relative(REPO_ROOT, LOCALITIES_DIR)}. A real --write run would exit 1.\n`);
  }
  for (const p of plans) {
    console.log(`${p.recordId}`);
    console.log(`  page_file:       ${path.relative(REPO_ROOT, p.pageFile)} (exists: ${p.pageExists})`);
    console.log(`  ready:           ${p.isReady}`);
    console.log(`  planned outcome: ${p.status} — ${p.message}`);
    console.log("");
  }
}

export async function main(argv = process.argv.slice(2)) {
  const { write, forceRecordId, usageError } = parseArgs(argv);
  if (usageError) {
    console.error(`error: ${usageError}`);
    return 1;
  }

  const readyIds = await loadReadyRecordIds();
  const localityRecords = await loadLocalityRecords();
  const forceMatchedSomething = forceRecordId
    ? localityRecords.some((r) => r.recordId === forceRecordId)
    : true;

  const plans = localityRecords.map((r) => planFor(r, { readyIds, force: forceRecordId }));

  if (!write) {
    printPlan(plans, forceRecordId, forceMatchedSomething);
    return 0;
  }

  if (forceRecordId && !forceMatchedSomething) {
    console.error(
      `error: --force ${forceRecordId} does not match any locality record_id under ${path.relative(REPO_ROOT, LOCALITIES_DIR)}`,
    );
    return 1;
  }

  const results = [];
  for (const p of plans) {
    if (p.status === "SKIPPED_NOT_READY" || p.status === "SKIPPED_EXISTS") {
      results.push(p);
      continue;
    }
    await mkdir(path.dirname(p.pageFile), { recursive: true });
    await writeFile(p.pageFile, renderWrapper(p), "utf8");
    results.push({ ...p, status: p.pageExists ? "FORCE_REGENERATED" : "CREATED" });
  }

  const report = {
    write: true,
    force: forceRecordId,
    results: results.map(({ recordId, pageFile, status, message }) => ({
      record_id: recordId,
      page_file: path.relative(REPO_ROOT, pageFile),
      status,
      message,
    })),
  };
  console.log(JSON.stringify(report, null, 2));

  return 0;
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
