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
  ],
  "url_checks": [
    {
      "url": "",
      "status": "REACHABLE | BLOCKED_OR_UNVERIFIABLE | CONFIRMED_BROKEN",
      "http_status": null,
      "checked_at": "",
      "method": "HEAD | GET",
      "details": ""
    }
  ]
}
```

`url_checks` records the result of **every** URL check performed against the record — including `REACHABLE` ones — so the evidence trail is complete, not just the failures that made it into `errors`/`warnings`.

## Detection categories

Every entry in `errors`/`warnings` must use exactly one of these ten category values:

`missing_source`, `duplicate_source`, `confidence_inconsistency`, `impossible_value`, `outdated_information`, `broken_url`, `missing_required_field`, `schema_violation`, `unsupported_claim`, `conflicting_information`

## Checks — exact rules, so results are reproducible

### 1. `schema_violation`
Validate the whole record against [data/schema.json](../data/schema.json) (JSON Schema, draft 2020-12). Any structural failure — wrong type, missing required key, pattern mismatch, `additionalProperties` violation — is an **error**, category `schema_violation`.

### 2. `missing_required_field`
Redundant with a full schema check (all 19 top-level keys are `required`, as of schema v1.2.0 — `generation_supplier` and `eligibility_constraints` were added), but check explicitly and report separately from generic schema failures so a human can tell "a key is entirely absent" from "a key is present but malformed."

### 3. `missing_source`
For every field with `value != null`: `source_ids` must be non-empty, and every ID in it must resolve to a real entry in the record's `sources[]`. A non-null value with no resolvable source is an **error**. (The schema's `if/else` already blocks `value != null` with `source_ids: []` structurally — this check additionally catches **dangling references**: an ID listed in `source_ids` that doesn't exist in `sources[]`, which the schema's shape-only validation cannot catch.)

Since schema v1.2.0, `required_documents` items each carry their **own** `source_ids`, independent of the field-level one. Apply this same dangling-reference check, and the same "non-empty" requirement, to every item's `source_ids` individually — not just the field-level array.

### 4. `duplicate_source`
Within `sources[]`: two entries with the same `id` is an **error** (breaks referential integrity — ambiguous which one `source_ids` means). Two entries with the same `url` under different `id`s is a **warning** (inflates apparent corroboration without adding a real independent source).

### 5. `confidence_inconsistency`
- `value === null` with `confidence > 0` → **error** (contradicts the "0 = unknown, value must be null" rule).
- `value !== null` with `confidence === 0` → **error** (same rule, other direction).
- A field's own `notes` contain hedging language about the **fact itself** ("not confirmed," "not independently confirmed," "uncertain," "disputed," "uncorroborated") while `confidence >= 0.8` → **warning** — the field is asserting more certainty than its own documented caveats support. (If `notes` hedge AND `confidence` is already reduced to reflect it, that's good calibration, not a flag — only report when the two disagree.)
- `battery_programs`/`rebates` items (schema v1.2.0+): `status: "active"` while `expires_on` is a date already in the past, or `status: "expired"` while `expires_on` is still in the future → **warning**. The structured fields must agree with each other; a mismatch means one of them is stale or was set incorrectly.
- **Hard rule:** hedging language about *network/retrieval access* — "blocked," "403," "could not render," "could not fetch," "inaccessible" — must **never** trigger this check. A source being blocked to automated access is a `broken_url` finding (check 8), not evidence against the factual confidence score. Do not downgrade or flag a field's confidence solely because a valid official URL blocks automated access — that's the whole point of check 8's three-state model existing separately from this one.

### 6. `impossible_value`
Sanity bounds that indicate a data-entry or unit error, not just uncertainty:
- Any `_days` value negative, or `timeline_days.min_days > timeline_days.max_days`.
- Any `amount_usd` or `value_usd_flat`/`value_usd_per_kwh`/`value_usd_per_watt` (schema v1.3.0+) negative.
- `value_usd_per_kwh` above $5,000/kWh — **warning**, not error (flag for human sanity check; not impossible, just unusual enough to double-check).
- `accessed_date` or `last_verified` later than the validation run's own date (a source can't have been accessed in the future) → **error**.
- Empty string (`""`) where the schema allows `string | null` → **error** — should have been `null`.
- `battery_programs`/`rebates` items (schema v1.2.0+): `effective_from` later than `expires_on` (an end date before its own start date) → **error**.
- `battery_programs`/`rebates` items (schema v1.3.0+): more than one of `value_usd_per_kwh`/`value_usd_flat`/`value_usd_per_watt` populated on the *same* item, when the item's `description` doesn't contain explanatory language for a genuine multi-component program ("paired with," "plus," "combined with," "in addition to," "along with") → **warning**. This is usually a sign one of the values was put in the wrong field, or two tiers that should be separate items got merged into one — see [agents/data-collector.md](../agents/data-collector.md)'s guidance on splitting multi-tier rebates into separate items.

### 7. `outdated_information`
- `last_verified` older than 180 days relative to the validation run date → **warning**. (180-day default per [docs/DATA_ARCHITECTURE.md](../docs/DATA_ARCHITECTURE.md) Section 7 — update both places together if this changes.)
- **Prefer the structured field when present (schema v1.2.0+):** for `battery_programs`/`rebates` items, if `expires_on` is set and has already elapsed as of `last_verified` → **warning**. Only fall back to scanning `description` text for a stated year (e.g. "available through 2025") that has elapsed when `expires_on` is `null` — once `expires_on` is populated, the text heuristic would only duplicate the same finding, so skip it for that item.

### 8. `broken_url`
Actually fetch every URL in the record (`permit_url`, `interconnection_url`, every `sources[].url`, every embedded item `url`) — HEAD first, falling back to GET only if HEAD returns 405/501. Classify into exactly three states, recorded in `url_checks` for every URL (not just failures):

**`REACHABLE`** — no finding, no penalty.
- HTTP 2xx or 3xx, **and** (when a GET was performed) the body doesn't match a known bot-challenge marker ("just a moment," "checking your browser," "cf-chl," "captcha," "attention required," "verify you are human").

**`BLOCKED_OR_UNVERIFIABLE`** — **warning**, 2-point penalty, worded "blocked/unverifiable, not confirmed broken — recommend a manual check." Never upgrade this to a pass, and never treat it as equivalent to confirmed-working:
- HTTP 401, 403, 429
- timeout
- TLS/network failure
- DNS failure
- connection reset
- a bot-challenge page detected in the body (even on HTTP 200)
- any other HTTP status not explicitly listed under `CONFIRMED_BROKEN` below (e.g. 5xx) — only 404/410 are treated as a removal signal; everything else defaults to unverifiable rather than broken.

**`CONFIRMED_BROKEN`** — **error**, 20-point penalty:
- HTTP 404 or 410
- malformed URL (fails `new URL()` parsing) — checked before any network call
- unsupported protocol (anything other than `http:`/`https:`) — checked before any network call

**Hard rule:** a `BLOCKED_OR_UNVERIFIABLE` result must never reduce the confidence score of the field that cites the URL — see check 5's hard rule. The two are deliberately independent: this check penalizes the *record's score* a small, fixed amount to flag "this needs a manual look," while the field's own confidence stays exactly what the Data Collector recorded.

### 9. `unsupported_claim`
- A monetary/rate/fee field (`permit_fees`, `battery_programs`, `rebates`) whose `source_ids` resolve **only** to sources of `type: "government"` or `"other_official"` (weaker fit for a specific dollar figure than `cpuc`/`utility`/`program_administrator`) → **warning**, recommending a stronger-tier source be added.
- Any value whose supporting source's `title`/`publisher` has no plausible connection to the claim (e.g., a contact-directory page cited as the sole source for a dollar amount) → **warning**.

### 10. `conflicting_information`
Cross-check names that should agree within one record: the `utility.value` name should match (or clearly correspond to) any utility/administrator name mentioned inside `battery_programs[].administrator`, `rebates[].administrator`, and `official_contacts[].role`/`.email` domain. A mismatch → **error** (this means two parts of the same record describe different real-world utilities, which is a genuine conflict, not a confidence question).

## Scoring

Deterministic, not judgment-based. `broken_url` warnings (`BLOCKED_OR_UNVERIFIABLE`) are penalized separately and more lightly than every other warning category, because a blocked automated check is a much weaker signal than an actual data problem:

```
other_warnings = warnings not in category "broken_url"
url_warnings   = warnings in category "broken_url"   (always BLOCKED_OR_UNVERIFIABLE; CONFIRMED_BROKEN is an error, not a warning)

score = 100
        − (20 × number of errors)
        − (2  × url_warnings)
        − (5  × other_warnings)
      , floored at 0
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
4. Attempt a live reachability check (category 8) for every URL in the record — parse first (catches malformed URLs/unsupported protocols without a network call), then actually fetch. Record every result in `url_checks`, and only add an `errors`/`warnings` entry for `CONFIRMED_BROKEN`/`BLOCKED_OR_UNVERIFIABLE` results — `REACHABLE` gets no finding.
5. Compute `score` and `status` per the formulas above.
6. Populate `recommendations` with concrete, specific next actions tied to what was actually found (not generic advice).
7. Output the JSON object. Nothing else.

## Explicitly out of scope for this agent

- Editing, correcting, or re-fetching data into the record — that's a re-run of the Data Collector, a separate action a human decides to take based on this report.
- Deciding whether a `REVIEW` record is good enough to publish — that's a Publishing Agent / human decision informed by this report.
- Writing prose about the record's subject matter.
