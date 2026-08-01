# Pilot Runbook — Controlled California Batch Collection

Operating procedure for [scripts/collect-pilot.mjs](../scripts/collect-pilot.mjs) against the 5 targets in [data/pilot-targets.json](../data/pilot-targets.json). Read [docs/DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md) first if you haven't — this runbook assumes you know what a locality record and `data/schema.json` are.

## What this pipeline does, and doesn't, do

It **orchestrates**: reads targets, checks for existing records, calls a collection adapter, writes a record if one comes back, chains [scripts/validate-record.mjs](../scripts/validate-record.mjs), and writes a run summary.

It does **not** research anything itself. As of this writing, the adapter ([scripts/lib/collection-adapter.mjs](../scripts/lib/collection-adapter.mjs)) is a placeholder that only reads a pre-supplied file from `data/source-payloads/`. If that file doesn't exist, the target's status is `COLLECTION_REQUIRED` — this is the expected, normal outcome for any target nobody has collected yet, not an error.

Every entry in `data/pilot-targets.json` must include `utility`, `utility_slug`, `city`, `city_slug`, `county`, `county_slug`, `state`, and `state_code`. **`utility_slug` is taken as given, never auto-derived** from the `utility` display name — there is no reliable, general way to mechanically turn "Southern California Edison" into `sce` (short of a heuristic that breaks the moment a utility's name doesn't fit the pattern it was tuned on, which is exactly what the previous version of this pipeline did). `county_slug`/`city_slug` are still cross-checked against `county`/`city` because geographic name → slug is unambiguous enough to verify mechanically; `utility_slug` is not, so it's only checked for being present and in lowercase kebab-case, not derived-and-compared.

## 1. How to prepare a source payload

1. Find the target's `record_id` in `data/pilot-targets.json` (e.g. `ca-alameda-fremont-pge`).
2. Produce a **complete record matching `data/schema.json`** for that locality — follow [agents/data-collector.md](../agents/data-collector.md) exactly (official sources only, `null` for anything unverified, every non-null field sourced and confidence-scored). See `data/localities/ca-santa-clara-san-jose-pge.json` for a real worked example.
3. Set the record's `record_id` field to exactly match the target's `record_id`. The pipeline refuses to write a record whose `record_id` doesn't match the target it was collected for (status `FAIL`, not silently corrected).
4. Save it as `data/source-payloads/<record_id>.json`.

Nothing reads this file automatically — it just sits there until you run the pipeline (see Section 3).

## 2. How to run a dry run

```bash
node scripts/collect-pilot.mjs --dry-run
```

`scripts/collect-pilot.mjs` has a direct-execution guard: `main()` only runs when this file is the process's actual entry point, never when it's `import()`-ed from another script (a test, a future orchestrator, anything). Importing it is always side-effect-free regardless of `process.argv` — see Section 7.

This does three things, for every target, and **writes nothing to disk**:
- Recomputes `record_id`/`county_slug`/`city_slug`/`utility_slug`/file paths from the target's display fields and compares them to what's stored in `data/pilot-targets.json` — a mismatch is a `CONFIG_ERROR` for that target.
- Reports whether `data/localities/<record_id>.json` and `data/source-payloads/<record_id>.json` currently exist.
- Prints the outcome a real run would produce (`SKIPPED_EXISTS`, `COLLECTION_REQUIRED`, or "would be collected and validated") — without ever writing a locality file, a validation report, or a pilot-run summary.

## 3. How to run collection for real

```bash
node scripts/collect-pilot.mjs
```

For each target, in order (one at a time, not in parallel):
1. If naming doesn't validate → `CONFIG_ERROR`, move on.
2. **If the target's utility assignment has been recorded as contradicted by official evidence → `CONFIG_ERROR`, move on.** See "The target-validity guard" below — this happens *before* any file is touched, in both a real run and `--dry-run`.
3. If `data/localities/<record_id>.json` already exists and `--force` was **not** passed → `SKIPPED_EXISTS`, move on. Nothing is overwritten by default, ever.
4. Otherwise, ask the collection adapter for a payload. No payload file → `COLLECTION_REQUIRED`, move on.
5. Payload found but its `record_id` doesn't match the target → `FAIL`, move on (this is a real defect, not a missing-data situation).
6. Otherwise, write the payload to `data/localities/<record_id>.json` and run `scripts/validate-record.mjs` against it.

### The target-validity guard

This exists because of a real incident: an earlier target named the utility "Southern California Edison (SCE)" for Pasadena. Before any collection was attempted, research turned up that Pasadena is served by its own municipal utility, **Pasadena Water and Power (PWP)**, not SCE — confirmed directly on PWP's own site and via Pasadena's membership in the Southern California Public Power Authority (a joint powers authority exclusively for cities with their own municipal utilities). Collecting for that target would have produced a factually wrong record. The target was corrected to `ca-los-angeles-pasadena-pwp` (utility: Pasadena Water and Power) instead of ever being collected.

The guard that resulted: each entry in `data/pilot-targets.json` may carry an optional `utility_verification` block:

```json
"utility_verification": {
  "status": "confirmed",
  "evidence": [
    { "claim": "...", "source_url": "...", "source_title": "...", "publisher": "..." }
  ],
  "checked_at": "2026-08-01",
  "notes": "..."
}
```

**This is not a live check** — `scripts/collect-pilot.mjs` doesn't research anything itself, same rule as the collection adapter. It only enforces evidence a human (or a future automated agent) already recorded:

- **Absent, or `status: "confirmed"`** → valid. Collection proceeds exactly as it always has. This is the default for every target that hasn't hit a problem — the guard is "invalid only if contradicted," not "invalid until proven correct," so it never blocks a target nobody has had a reason to doubt yet.
- **Any other `status`** (in practice, `"contradicted"`) → invalid. The target's result is `CONFIG_ERROR`, the `evidence` array is included in that result (and therefore in the run summary and in `--dry-run` output), and **no payload, locality, validation, or rendered file is ever created or touched** for that target.

If you discover a target's utility assignment is wrong, don't delete the entry — correct `utility`/`utility_slug`/`record_id`/the file paths to the right utility (as was done for Pasadena), the same way you'd fix any other config mistake. Only add a `"contradicted"` block on a target you're intentionally leaving in place as a documented "known-wrong, don't collect" record (which is not the normal case — normally you just fix it and move on, as happened here).

To intentionally overwrite one existing record (re-collecting a locality with newer data), name it explicitly:

```bash
node scripts/collect-pilot.mjs --force ca-alameda-fremont-pge
```

`--force` always takes a `record_id` argument — **force-all is not supported.** Only the named record may be overwritten; every other existing record in the batch still comes back `SKIPPED_EXISTS`, exactly as if `--force` hadn't been passed at all. If the given `record_id` doesn't match anything in `data/pilot-targets.json`, the run adds a synthetic `CONFIG_ERROR` result for it and exits `1` — it does not silently fall back to "no force" or force-all.

## 4. How validation is chained

Every record the pipeline writes is immediately validated by spawning `scripts/validate-record.mjs` as a subprocess against the file just written. The target's final status **is** whatever that validator returned — `PASS`, `REVIEW`, or `FAIL` — not a separate pipeline-level judgment. The validator's own report is written to `output/validation-reports/<record_id>.json` exactly as it would be if you'd run the validator by hand; the pipeline doesn't duplicate or reinterpret that file, just points at it.

## 5. How failures are handled

One target's failure never stops the batch — every target is wrapped so an unexpected error becomes that target's `FAIL` result and the loop continues to the next one.

Possible per-target statuses:

| Status | Meaning | Counts toward exit code 1? |
|---|---|---|
| `PASS` | Written and validated clean | No |
| `REVIEW` | Written, validator found warnings only | No |
| `FAIL` | Validator found errors, or payload `record_id` mismatch, or an unexpected exception | **Yes** |
| `COLLECTION_REQUIRED` | No source payload exists yet — expected, not an error | No |
| `SKIPPED_EXISTS` | Record already exists and `--force` didn't target it | No |
| `CONFIG_ERROR` | The target's own entry in `pilot-targets.json` doesn't validate, **or** its `utility_verification.status` is not `"confirmed"`/absent, **or** `--force <record_id>` didn't match any target | **Yes** |

The whole run's exit code is `1` if **any** target is `FAIL` or `CONFIG_ERROR` — every other status (`PASS`, `REVIEW`, `SKIPPED_EXISTS`, `COLLECTION_REQUIRED`) is a normal, expected outcome of a partially-collected pilot and does not fail the run.

## 6. How to rerun safely

Reruns are safe and idempotent by default: without `--force`, a target that already succeeded (`data/localities/<record_id>.json` exists) is simply skipped every time, no matter how many times you run the pipeline. To retry only the targets still stuck on `COLLECTION_REQUIRED`, just add the missing payload file(s) and rerun — targets that already have a locality file are left untouched.

Every real run (not `--dry-run`) writes a full summary to `output/pilot-runs/<ISO-timestamp>.json`, so you can always look back at exactly what happened on a given run without re-deriving it from `git log` or the validation reports alone.

## 7. Automated tests

```bash
npm test
```

Runs [tests/collect-pilot.test.mjs](../tests/collect-pilot.test.mjs) via Node's built-in test runner (`node:test` — no test framework dependency). It covers, against isolated fixtures (never the real `data/pilot-targets.json` or `data/localities/`, except where a test is specifically checking real-repo safety):

- `--dry-run` creates no files.
- Importing the module (`import("../scripts/collect-pilot.mjs")`) runs nothing — the direct-execution guard holds.
- An invalid target entry (bad naming) produces `CONFIG_ERROR` and exit code `1`.
- A target whose `utility_verification.status` is `"contradicted"` produces `CONFIG_ERROR` and exit code `1`, and creates no payload/locality/validation/rendered file.
- `--force <unknown-record-id>` exits `1` without disturbing any real target.
- `--force <record_id>` overwrites only that target; every other existing record is untouched.
- A run with no payloads and no existing records is all `COLLECTION_REQUIRED` and exits `0`.
- The real `data/pilot-targets.json` entry for Pasadena (`ca-los-angeles-pasadena-pwp`) passes naming validation and shows up correctly in `--dry-run`.

Two things to know if you're adding a test: `PILOT_TARGETS_PATH` and `PILOT_RUNS_DIR` env vars override where the pipeline reads targets from and writes its run summary — every fixture-based test sets both to a throwaway temp directory (`node:os.tmpdir()`), never the real `data/`/`output/` trees. `scripts/validate-record.mjs` itself has no such override yet, so any test that lets a target reach the write-and-validate step will cause a real file to appear under `output/validation-reports/` using the fixture's `record_id` as the filename — that test is responsible for deleting it afterward (see the `--force` test for the pattern).
