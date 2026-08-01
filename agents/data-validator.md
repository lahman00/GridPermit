# Data Validator Agent

## Goal

Review every JSON record produced by the Data Collector Agent ([agents/data-collector.md](data-collector.md)) and report every problem found. **The validator never edits data — it only reports.** Fixing a flagged record is a separate, human (or Data Collector re-run) action.

This is the second agent in the pipeline described in [docs/MASTER_PLAN.md](../docs/MASTER_PLAN.md) Section 4 — Data Agent, then this one, before any Content or Publishing agent is allowed to touch a record.

## Output contract

Output exactly one JSON object per record reviewed. No prose, no markdown, no commentary before or after it.

```json
{
  "record_id": "<record_id of the file reviewed>",
  "file": "<path to the file reviewed>",
  "validated_at": "<date this validation run was performed>",
  "status": "PASS | REVIEW | FAIL",
  "score": 0,
  "errors": [
    { "field": "<field name, or null for record-level>", "category": "<see categories below>", "message": "<specific, checkable description>" }
  ],
  "warnings": [
    { "field": "<field name, or null for record-level>", "category": "<see categories below>", "message": "<specific, checkable description>" }
  ],
  "recommendations": [
    { "field": "<field name, or null for record-level>", "message": "<non-blocking suggestion>" }
  ]
}
```

## Detection categories

Every entry in `errors`/`warnings` must use exactly one of these ten category values:

`missing_source`, `duplicate_source`, `confidence_inconsistency`, `impossible_value`, `outdated_information`, `broken_url`, `missing_required_field`, `schema_violation`, `unsupported_claim`, `conflicting_information`

## Checks — exact rules, so results are reproducible

### 1. `schema_violation`
Validate the whole record against [data/schema.json](../data/schema.json) (JSON Schema, draft 2020-12). Any structural failure — wrong type, missing required key, pattern mismatch, `additionalProperties` violation — is an **error**, category `schema_violation`.

### 2. `missing_required_field`
Redundant with a full schema check (all 17 top-level keys are `required`), but check explicitly and report separately from generic schema failures so a human can tell "a key is entirely absent" from "a key is present but malformed."

### 3. `missing_source`
For every field with `value != null`: `source_ids` must be non-empty, and every ID in it must resolve to a real entry in the record's `sources[]`. A non-null value with no resolvable source is an **error**. (The schema's `if/else` already blocks `value != null` with `source_ids: []` structurally — this check additionally catches **dangling references**: an ID listed in `source_ids` that doesn't exist in `sources[]`, which the schema's shape-only validation cannot catch.)

### 4. `duplicate_source`
Within `sources[]`: two entries with the same `id` is an **error** (breaks referential integrity — ambiguous which one `source_ids` means). Two entries with the same `url` under different `id`s is a **warning** (inflates apparent corroboration without adding a real independent source).

### 5. `confidence_inconsistency`
- `value === null` with `confidence > 0` → **error** (contradicts the "0 = unknown, value must be null" rule).
- `value !== null` with `confidence === 0` → **error** (same rule, other direction).
- A field's own `notes` contain hedging language ("could not," "not confirmed," "not independently verified," "unable to") while `confidence >= 0.8` → **warning** — the field is asserting more certainty than its own documented caveats support. (If `notes` hedge AND `confidence` is already reduced to reflect it, that's good calibration, not a flag — only report when the two disagree.)

### 6. `impossible_value`
Sanity bounds that indicate a data-entry or unit error, not just uncertainty:
- Any `_days` value negative, or `timeline_days.min_days > timeline_days.max_days`.
- Any `amount_usd` or `value_usd_flat`/`value_usd_per_kwh` negative.
- `value_usd_per_kwh` above $5,000/kWh — **warning**, not error (flag for human sanity check; not impossible, just unusual enough to double-check).
- `accessed_date` or `last_verified` later than the validation run's own date (a source can't have been accessed in the future) → **error**.
- Empty string (`""`) where the schema allows `string | null` → **error** — should have been `null`.

### 7. `outdated_information`
- `last_verified` older than 180 days relative to the validation run date → **warning**. (180-day default per [docs/DATA_ARCHITECTURE.md](../docs/DATA_ARCHITECTURE.md) Section 7 — update both places together if this changes.)
- Any field's `description`/`notes` text names a specific past year as an expiration/eligibility window (e.g. "available through 2025") that has already elapsed as of `last_verified` → **warning**, even if `last_verified` itself is recent — a fresh check that surfaced stale program data is still stale program data.

### 8. `broken_url`
Attempt to actually fetch every URL in the record (`permit_url`, `interconnection_url`, every `sources[].url`, every embedded item `url`). Distinguish:
- **Confirmed broken** (DNS failure, TLS error, HTTP 404/410/500) → **error**.
- **Blocked/unverifiable** (HTTP 403/503 consistent with bot-protection, not a content-not-found signal) → **warning**, worded as "inaccessible to automated verification, not confirmed broken — recommend a manual check." Do not silently upgrade this to a pass, and do not treat it as equivalent to "confirmed working."
- Reachable and returns 2xx → no finding.

### 9. `unsupported_claim`
- A monetary/rate/fee field (`permit_fees`, `battery_programs`, `rebates`) whose `source_ids` resolve **only** to sources of `type: "government"` or `"other_official"` (weaker fit for a specific dollar figure than `cpuc`/`utility`/`program_administrator`) → **warning**, recommending a stronger-tier source be added.
- Any value whose supporting source's `title`/`publisher` has no plausible connection to the claim (e.g., a contact-directory page cited as the sole source for a dollar amount) → **warning**.

### 10. `conflicting_information`
Cross-check names that should agree within one record: the `utility.value` name should match (or clearly correspond to) any utility/administrator name mentioned inside `battery_programs[].administrator`, `rebates[].administrator`, and `official_contacts[].role`/`.email` domain. A mismatch → **error** (this means two parts of the same record describe different real-world utilities, which is a genuine conflict, not a confidence question).

## Scoring

Deterministic, not judgment-based:

```
score = 100 − (20 × number of errors) − (5 × number of warnings), floored at 0
```

```
status = "FAIL"   if errors is non-empty
status = "REVIEW" if errors is empty AND warnings is non-empty
status = "PASS"   if errors is empty AND warnings is empty
```

`recommendations` never affect `score` or `status` — they're advisory follow-up work (e.g. "re-fetch X once the block clears," "call the Permit Center to fill the null fields"), not findings against the record as it stands.

## Process

1. Load the target record and `data/schema.json`.
2. Run check 1 (schema validation) first — if it fails structurally, still run checks 2–10 where possible, but expect cascading findings.
3. Run checks 2–10 in order, appending each finding to `errors` or `warnings` per the rules above.
4. Attempt a live reachability check (category 8) for every URL in the record — this requires actually fetching, not just checking the string looks like a URL.
5. Compute `score` and `status` per the formulas above.
6. Populate `recommendations` with concrete, specific next actions tied to what was actually found (not generic advice).
7. Output the JSON object. Nothing else.

## Explicitly out of scope for this agent

- Editing, correcting, or re-fetching data into the record — that's a re-run of the Data Collector, a separate action a human decides to take based on this report.
- Deciding whether a `REVIEW` record is good enough to publish — that's a Publishing Agent / human decision informed by this report.
- Writing prose about the record's subject matter.
