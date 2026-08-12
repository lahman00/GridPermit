#!/usr/bin/env node
// One-time, deterministic migration: stamps "state": "CA" onto every
// existing data/localities/*.json record (schema v1.4.0 made `state` a
// required top-level field) and bumps schema_version to "1.4.0". This is a
// mechanical, factual stamp — every existing record's record_id already
// starts with "ca-", so no re-research is needed or performed. Idempotent:
// a record that already has a `state` field is left untouched. See
// data/schema.json's schema_version description and docs/DATA_ARCHITECTURE.md.
//
// Usage: node scripts/migrate-add-state-field.mjs

import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const LOCALITIES_DIR = path.join(REPO_ROOT, "data", "localities");

async function main() {
  const files = (await readdir(LOCALITIES_DIR)).filter((f) => f.endsWith(".json"));
  let migrated = 0;
  let skipped = 0;
  const problems = [];

  for (const file of files.sort()) {
    const filePath = path.join(LOCALITIES_DIR, file);
    const raw = await readFile(filePath, "utf8");
    const record = JSON.parse(raw);

    if (record.state) {
      skipped++;
      continue;
    }

    const recordId = record.record_id ?? path.basename(file, ".json");
    if (!recordId.startsWith("ca-")) {
      problems.push(`${file}: record_id "${recordId}" does not start with "ca-" — refusing to guess state, skipped`);
      continue;
    }

    // Rebuild the object with `state` inserted right after `schema_version`
    // (matching data/schema.json's required-key ordering) rather than just
    // appended, so the on-disk JSON key order stays predictable/reviewable.
    const { record_id, schema_version, ...rest } = record;
    const migratedRecord = {
      record_id,
      schema_version: "1.4.0",
      state: "CA",
      ...rest,
    };

    await writeFile(filePath, JSON.stringify(migratedRecord, null, 2) + "\n", "utf8");
    migrated++;
  }

  console.log(JSON.stringify({ total_files: files.length, migrated, already_had_state: skipped, problems }, null, 2));
  if (problems.length > 0) process.exit(1);
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
