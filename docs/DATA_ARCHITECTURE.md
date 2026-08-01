# Data Architecture

How every future GridPermit tool, page, and calculator consumes the structured data produced by [agents/data-collector.md](../agents/data-collector.md), validated against [data/schema.json](../data/schema.json).

This is Phase 2 groundwork only: the schema and the agent spec. **No locality records exist yet.** `data/localities/` is empty until the Data Agent is actually run against a real city/utility pair. Nothing in this document describes anything that has shipped to the live site — [index.astro](../src/pages/index.astro) still runs on the two flat placeholder constants described in [methodology.astro](../src/pages/methodology.astro), unchanged, until a later phase wires it up to real records.

## 1. What this replaces

[docs/MASTER_PLAN.md](MASTER_PLAN.md) Section 5 originally sketched data split across separate per-domain files (`data/utilities/pge.json`, `data/incentives/sgip.json`, `data/permitting/counties/fresno.json`, ...). Phase 2 supersedes that sketch with one consolidated shape: **one record per `(city, utility)` pair**, combining utility, permitting, and incentive facts together, because that's the unit a homeowner and a calculator actually need at once — nobody looks up permitting rules and utility rates separately. `data/schema.json` is now the single authoritative contract. Treat the old sketch in MASTER_PLAN.md as superseded by this document.

## 2. Directory layout

```
data/
  schema.json              # the master schema — never hand-edit a record to violate this
  localities/
    ca-santa-clara-san-jose-pge.json
    ca-san-diego-san-diego-sdge.json
    ...                    # one file per (city, utility) pair, produced by the Data Agent
```

**Naming rule — one rule only:** `<state-code>-<county-slug>-<city-slug>-<utility-slug>.json`, lowercase kebab-case, no underscores. Filename (minus `.json`) must exactly equal the record's `record_id`, enforced by the `record_id` pattern in `data/schema.json`.

**Known limitation:** when a county or city name is itself multi-word (e.g. "Santa Clara," "San Jose"), its slug uses the same hyphen as the segment separator — `ca-santa-clara-san-jose-pge` cannot be mechanically split back into `(state, county, city, utility)` by the regex alone; segment boundaries are a documentation convention enforced by whoever names the file, not something `data/schema.json` can structurally verify beyond overall shape (2-letter state code, lowercase kebab-case, at least 3 more hyphenated segments).

## 3. The record shape, in one sentence

Every field is `{ value, confidence, source_ids }` — a value that might be `null`, a confidence score from 0 (unknown) to 1 (confirmed on a primary source within 90 days), and a list of IDs pointing into that record's own `sources[]` registry. Record-level metadata (`record_id`, `schema_version`, `last_verified`, `sources`) sits outside that envelope because it describes the record itself, not a researched fact.

`value` itself isn't always a flat scalar or a simple list — `generation_supplier` and `eligibility_constraints` are structured objects, and `required_documents` items (since 1.2.0) each carry their own nested `source_ids` independent of the field-level one. The envelope (`value`/`confidence`/`source_ids`/`notes`) is the constant; what's inside `value` varies by field, per `data/schema.json`.

## 4. The rule every consumer must follow

**No tool, page, or calculator may display a field's value unless it checks `confidence` and `value !== null` first.** This is a direct continuation of the Phase 1 rule that shipped in the homepage rewrite: [index.astro](../src/pages/index.astro) shows "Coming Soon" instead of inventing a payback figure it can't back up. Every future consumer of `data/localities/*.json` follows the same pattern:

- `value === null` → render "Not yet available" / "Coming soon," never a blank, a zero, or a guess.
- `confidence` below a consumer-defined threshold → treat as if `null` for display purposes, even if a value is technically present (a 0.2-confidence guess should not be shown next to a 0.95-confidence fact with equal visual weight, or at all, depending on the surface).
- `confidence >= threshold` and `value !== null` → safe to display, and the UI should make the `source_ids` → `sources[]` citation reachable (e.g. a footnote link), the same way the Phase 1 methodology page explains exactly what's behind each number instead of asserting it silently.

There is no fixed sitewide threshold mandated here — each consumer sets its own bar depending on how much it's asserting (a blog page citing a specific dollar figure needs a higher bar than a directory page just listing which cities have any data at all). Whatever threshold a consumer uses, it must be a real number in that tool's own code/config, not an assumption baked in silently.

## 5. How each future consumer reads this data (planned, not yet built)

| Consumer | What it reads | What it must never do |
|---|---|---|
| **Homepage calculator** ([index.astro](../src/pages/index.astro)) | Looks up the record for the user's ZIP → city/utility, once ZIP-to-locality mapping exists. Uses `permit_fees`, `timeline_days`, `rebates`, `battery_programs` if confidence clears its threshold. Reads `generation_supplier` before assuming `utility`'s rates apply to generation charges. | Fall back to the current flat placeholder rate/yield constants and present the result as if it were locality-specific — if a locality has no record yet, say so, don't blend fake and real numbers together. |
| **Permit content pages** (Phase 3, not yet built) | One page per covered `(city, utility)`, built directly from that locality's record — `permit_authority`, `permit_url`, `required_documents`, `inspection_steps`, `timeline_days`, `eligibility_constraints`, `official_contacts`. Uses `eligibility_constraints` to state the scope of any timeline/inspection claim instead of a blanket "this is how long it takes." | Publish a page for a locality with no record, or with a record whose core fields are mostly `null`/low-confidence — see Section 6. State a timeline/inspection rule without also stating the `eligibility_constraints` scope it applies to. |
| **Content Agent** (not yet built, see MASTER_PLAN.md Section 4) | Drafts prose only from fields that pass the confidence threshold; must cite `source_ids` inline or in a visible footnote. | Fill a gap in the record with plausible-sounding prose. If a fact isn't in the record, the Content Agent's job is to flag a Data Agent task, not write around it. |
| **Fact-Check Agent** (not yet built) | Diffs any drafted page against the record it claims to be based on — every number in the draft must trace to a `source_ids` entry. | Approve a page containing a number that isn't backed by the record it cites. |
| **Publishing Agent** (not yet built) | Reads `last_verified` to flag stale records (see Section 7) before a page ships or re-ships. | Publish from a record it hasn't checked the staleness of. |

## 6. Coverage is binary, not blended

A locality is either covered (a record file exists, most core fields have real confidence) or not covered (no file, or a file that's mostly `null`). Never synthesize a partial page by mixing one real locality's data with another's, or with the sitewide placeholder assumptions from Phase 1 — that recreates exactly the "fake regional data" problem Phase 1 removed. If coverage is partial, the page (or calculator section) says so explicitly, per field, the same way the current homepage says "Coming Soon" rather than guessing.

## 7. Staleness

`last_verified` is the whole record's last research date. There's no automatic expiry enforced by the schema — that's a policy decision for whatever runs the Data Agent on a schedule (Phase 4 automation, not yet built). Suggested default until a real cadence is set: treat a record older than 180 days as needing re-verification before any consumer treats its high-confidence fields as current; this is a recommendation for future automation to implement, not something enforced today.

## 8. Schema versioning

`schema_version` is pinned to `"1.2.0"` for every record right now (enforced as a `const` in `data/schema.json`), read as `<major>.<minor>.<patch>`. Explicit rule — no ambiguity between tiers:

- **Patch** (`x.y.Z`): documentation or validator fixes with **no schema-shape change** at all — e.g. clarifying a description string in `data/schema.json`, or a `scripts/validate-record.mjs` bug fix that doesn't change what a valid record looks like. No record ever needs to change.
- **Minor** (`x.Y.0`): **optional additive fields only** — a new field that is not `required`, or a new enum value that doesn't invalidate any existing value. Every existing record remains valid without modification.
- **Major** (`X.0.0`): **required fields, renamed fields, removed fields, or changed field types** — anything that can make a previously-valid record fail validation. This includes adding a new field to the top-level `required` array, even if the field itself is conceptually "new information" rather than a rename/removal — a required field an old record doesn't have is exactly what makes that record invalid, which is the operational definition of "breaking" here.

**Every major schema change requires a migration script and migration of all existing records under `data/localities/` before commit.** A mixed-version `data/localities/` directory is never allowed — every consumer would need to branch on version to read it safely, and nothing in this repo does that.

**Acknowledged historical exception — `1.2.0`:** `1.2.0` added `generation_supplier` and `eligibility_constraints` as new *required* top-level keys, and restructured `required_documents` items from plain strings to objects. Under the rule above, that's a **Major** change and should have been versioned `2.0.0`. It was shipped as `1.2.0` anyway, kept as-is rather than renumbered after the fact, specifically because both existing records (`ca-santa-clara-san-jose-pge`, `ca-alameda-fremont-pge`) were migrated atomically in the same change — no unmigrated record was ever left on disk, so the practical risk the Major-bump rule exists to prevent never materialized here. This is a one-time exception for the record, not a precedent: the **next** schema change that adds a required field, renames a field, removes a field, or changes a field's type must follow the Major rule exactly — a real migration script, every existing record migrated before commit, and a `2.0.0`-or-higher version.

Nobody should hand-edit `data/schema.json` to relax a constraint because one record doesn't fit — that's a signal the record has a real problem, not the schema.

## 11. `generation_supplier` and `eligibility_constraints` (added in 1.2.0)

Added directly in response to real facts the first two collected records couldn't represent without burying them in free-text `notes`:

- **`generation_supplier`** exists because `utility` answers "who do I interconnect/get billed through," not "who generates my electricity" — in Fremont those are two different entities (PG&E vs. Ava Community Energy, a Community Choice Aggregator). Any future rate or generation-cost content is wrong if it silently assumes `utility` also means "generation supplier." Consumers that touch rates/pricing must read `generation_supplier` before making that assumption, not just `utility`.
- **`eligibility_constraints`** exists because permit/timeline/inspection rules are frequently scoped ("this 3-day turnaround only applies to systems ≤10kW AC on single-family/duplex homes") and that scope was previously only readable as prose duplicated across `timeline_days.notes` and `inspection_steps.notes`. Populate it once per record; other fields' `notes` should cross-reference it (`"see eligibility_constraints"`) instead of repeating the same constraint as free text in multiple places.

Both fields follow the same rule as every other field: `null` when not researched, a real source-backed value otherwise — see [agents/data-collector.md](../agents/data-collector.md) for the exact value shapes and rules.

## 9. Validating a record

Any record under `data/localities/` must validate against `data/schema.json` (standard JSON Schema, draft 2020-12) before it's considered usable by any consumer. Run [scripts/validate-record.mjs](../scripts/validate-record.mjs) against a record to get a full report per [agents/data-validator.md](../agents/data-validator.md)'s rules:

```
node scripts/validate-record.mjs data/localities/<record>.json
```

It never edits the source record — it only writes a report to `output/validation-reports/<same filename>`, and exits `0` for `PASS`/`REVIEW`, `1` for `FAIL`.

## 10. URL reachability is not factual confidence

A URL cited as evidence for a field can be blocked to automated access (bot protection, rate limiting, a transient outage) without that meaning the fact it supports is wrong. `scripts/validate-record.mjs` and `agents/data-validator.md` both encode this as a hard separation:

- **Whether a fact is true** is `confidence` on the field — set once, by the Data Collector, based on what it actually read.
- **Whether a citation is currently reachable by an automated checker** is `REACHABLE` / `BLOCKED_OR_UNVERIFIABLE` / `CONFIRMED_BROKEN` in `url_checks` — checked every validation run, and can change run to run as bot-protection and outages come and go, independent of whether the underlying fact changed at all.

**Rule for every current and future consumer:** never lower, hide, or re-derive a field's `confidence` because its source URL failed a reachability check. A `BLOCKED_OR_UNVERIFIABLE` result costs the record a small, fixed 2-point score penalty (versus 5 points for an actual data problem, or 20 for an error) precisely because it's a much weaker signal — it says "a human should double-check this link," not "this fact is in doubt." Only `CONFIRMED_BROKEN` (HTTP 404/410, a malformed URL, or an unsupported protocol) is treated as a real defect.
