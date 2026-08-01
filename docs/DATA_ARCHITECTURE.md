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

## 4. The rule every consumer must follow

**No tool, page, or calculator may display a field's value unless it checks `confidence` and `value !== null` first.** This is a direct continuation of the Phase 1 rule that shipped in the homepage rewrite: [index.astro](../src/pages/index.astro) shows "Coming Soon" instead of inventing a payback figure it can't back up. Every future consumer of `data/localities/*.json` follows the same pattern:

- `value === null` → render "Not yet available" / "Coming soon," never a blank, a zero, or a guess.
- `confidence` below a consumer-defined threshold → treat as if `null` for display purposes, even if a value is technically present (a 0.2-confidence guess should not be shown next to a 0.95-confidence fact with equal visual weight, or at all, depending on the surface).
- `confidence >= threshold` and `value !== null` → safe to display, and the UI should make the `source_ids` → `sources[]` citation reachable (e.g. a footnote link), the same way the Phase 1 methodology page explains exactly what's behind each number instead of asserting it silently.

There is no fixed sitewide threshold mandated here — each consumer sets its own bar depending on how much it's asserting (a blog page citing a specific dollar figure needs a higher bar than a directory page just listing which cities have any data at all). Whatever threshold a consumer uses, it must be a real number in that tool's own code/config, not an assumption baked in silently.

## 5. How each future consumer reads this data (planned, not yet built)

| Consumer | What it reads | What it must never do |
|---|---|---|
| **Homepage calculator** ([index.astro](../src/pages/index.astro)) | Looks up the record for the user's ZIP → city/utility, once ZIP-to-locality mapping exists. Uses `permit_fees`, `timeline_days`, `rebates`, `battery_programs` if confidence clears its threshold. | Fall back to the current flat placeholder rate/yield constants and present the result as if it were locality-specific — if a locality has no record yet, say so, don't blend fake and real numbers together. |
| **Permit content pages** (Phase 3, not yet built) | One page per covered `(city, utility)`, built directly from that locality's record — `permit_authority`, `permit_url`, `required_documents`, `inspection_steps`, `timeline_days`, `official_contacts`. | Publish a page for a locality with no record, or with a record whose core fields are mostly `null`/low-confidence — see Section 6. |
| **Content Agent** (not yet built, see MASTER_PLAN.md Section 4) | Drafts prose only from fields that pass the confidence threshold; must cite `source_ids` inline or in a visible footnote. | Fill a gap in the record with plausible-sounding prose. If a fact isn't in the record, the Content Agent's job is to flag a Data Agent task, not write around it. |
| **Fact-Check Agent** (not yet built) | Diffs any drafted page against the record it claims to be based on — every number in the draft must trace to a `source_ids` entry. | Approve a page containing a number that isn't backed by the record it cites. |
| **Publishing Agent** (not yet built) | Reads `last_verified` to flag stale records (see Section 7) before a page ships or re-ships. | Publish from a record it hasn't checked the staleness of. |

## 6. Coverage is binary, not blended

A locality is either covered (a record file exists, most core fields have real confidence) or not covered (no file, or a file that's mostly `null`). Never synthesize a partial page by mixing one real locality's data with another's, or with the sitewide placeholder assumptions from Phase 1 — that recreates exactly the "fake regional data" problem Phase 1 removed. If coverage is partial, the page (or calculator section) says so explicitly, per field, the same way the current homepage says "Coming Soon" rather than guessing.

## 7. Staleness

`last_verified` is the whole record's last research date. There's no automatic expiry enforced by the schema — that's a policy decision for whatever runs the Data Agent on a schedule (Phase 4 automation, not yet built). Suggested default until a real cadence is set: treat a record older than 180 days as needing re-verification before any consumer treats its high-confidence fields as current; this is a recommendation for future automation to implement, not something enforced today.

## 8. Schema versioning

`schema_version` is pinned to `"1.1.0"` for every record right now (enforced as a `const` in `data/schema.json`). Rules for future changes:

- **Additive, backward-compatible change** (e.g. a new optional field, or a tightened validation rule that every current record already satisfies): bump to `1.x.0`, existing records remain valid without modification. `1.1.0` was this kind of change — it tightened `record_id` to lowercase kebab-case with no underscores, and the one existing record was renamed to match rather than left non-conformant.
- **Breaking change** (renaming/removing a field, changing a value's type): bump to `2.0.0`, and every existing record under `data/localities/` must be migrated before the new version is used — a mixed-version `data/localities/` directory is not allowed, since every consumer would need to branch on version to read it safely.

Nobody should hand-edit `data/schema.json` to relax a constraint because one record doesn't fit — that's a signal the record has a real problem, not the schema.

## 9. Validating a record

Any record under `data/localities/` must validate against `data/schema.json` (standard JSON Schema, draft 2020-12) before it's considered usable by any consumer. There's no repo-committed validation script yet — that's implementation work for whoever wires the Data Agent's actual output into this directory (Phase 2 continuation or Phase 4 automation), not part of this groundwork pass.
