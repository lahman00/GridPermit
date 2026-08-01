# Pilot Evaluation — Decision Report

Closes out the controlled 5-record California pilot. Generated from [output/pilot-evaluation.json](../output/pilot-evaluation.json) — regenerate that file with `node scripts/evaluate-pilot.mjs` before trusting any number below; this document is a narrative reading of that data, not an independent source.

This is a **read-only synthesis**: it re-reads the 5 records and their existing validation reports and draws conclusions. It collected nothing new, changed no record, and did not touch the website.

## 1. Per-record results

| Record | Utility (type) | Separate CCA | Completeness | Score | Errors | Warning categories | Permit fees | Timeline | Readiness |
|---|---|---|---|---|---|---|---|---|---|
| `ca-santa-clara-san-jose-pge` | PG&E (IOU) | unknown (not researched) | 53.3% | 85 | 0 | broken_url, outdated_information | Not available | Not available | **LIMITED** |
| `ca-alameda-fremont-pge` | PG&E (IOU) | Yes — Ava Community Energy | 80.0% | 85 | 0 | broken_url, outdated_information | Not available | Available | **READY** |
| `ca-alameda-oakland-pge` | PG&E (IOU) | Yes — Ava Community Energy | 86.7% | 91 | 0 | broken_url, outdated_information | Not available | Available | **READY** |
| `ca-los-angeles-pasadena-pwp` | Pasadena Water and Power (municipal) | No — vertically integrated | 93.3% | 98 | 0 | broken_url | Available | Not available | **READY** |
| `ca-san-diego-san-diego-sdge` | SDG&E (IOU) | Yes — San Diego Community Power | 86.7% | 86 | 0 | broken_url, outdated_information, unsupported_claim | Available | Not available | **READY** |

Readiness rule applied exactly as specified: `READY` needs completeness ≥80% **and** score ≥85 **and** zero errors; `LIMITED` needs completeness ≥50% **and** score ≥75 **and** zero errors; anything else (including any error at all) is `NOT_READY`. No record in this pilot has a validation error, so the split here is driven entirely by completeness and score.

**San Jose is the outlier** — it's the only record from the *original* pilot session (before `generation_supplier`, `eligibility_constraints`, `required_documents` restructuring, and the target-validity guard all existed), and it was never re-collected afterward. Its lower completeness isn't a data-quality problem so much as it simply predates most of what this pipeline now knows how to ask for.

## 2. Aggregate findings

- **Average completeness: 80.0%** across the 5 records.
- **Average validation score: 89.0 / 100.**
- **Fields most often missing**, ranked: `rebates` (4/5 records), `permit_fees` and `timeline_days` (3/5 each), `required_documents` (2/5), `generation_supplier`/`inspection_steps`/`eligibility_constraints` (1/5 each — San Jose only). `utility`, `city`, `county`, `permit_authority`, `permit_url`, `interconnection_url`, `battery_programs`, and `official_contacts` are populated in **all 5** records.
- **Recurring source-access problem:** `broken_url` appears in every single record's warnings. County-level government sites (Santa Clara, Alameda, LA, San Diego county pages) were blocked (HTTP 403) in all 5 records — this is the single most consistent failure mode in the whole pilot, not a one-off. The major IOU domains (pge.com, sdge.com) were blocked in 4 of 5 records (every one except Pasadena, whose utility's own site never blocked automated access once).
- **Recurring stale-data problem:** the statewide SGIP "Equity Resiliency" tier's "through 2025" window has elapsed in 4 of 5 records (every record relying on statewide SGIP figures — Pasadena is the exception, since it has its own local battery rebate program instead of SGIP).
- **Schema gaps discovered and fixed during this pilot:** `generation_supplier`, `eligibility_constraints` (v1.2.0), and `programItem.value_usd_per_watt` (v1.3.0) — each added in direct response to a real fact a record couldn't otherwise represent. No further schema gap surfaced while collecting Oakland, Pasadena, or San Diego.

## 3. What's safe to expose in a public MVP, and what isn't

**Safe to show now:** `utility`, `generation_supplier`, `city`, `county`, `permit_authority`, `permit_url`, `official_contacts`, `inspection_steps`, `eligibility_constraints`, `required_documents` — all either universally populated or, where populated, backed by directly-rendered official content with no active warning against them.

**Must stay hidden or explicitly marked "Not yet verified":**
- `rebates` — populated in only 1 of 5 records. Too sparse to present as a reliable cross-city feature yet.
- `permit_fees` — populated in only 2 of 5, and *both* instances carry an `unsupported_claim` warning (sourced only from a single government page, not corroborated by a second independent source type). Show only with an explicit "verify with the issuing authority" caveat — never as a confirmed final cost.
- `timeline_days` — populated in only 2 of 5. Must never be blended into a single sitewide "typical" number; render "Not yet verified" everywhere it's null.
- **Any `battery_programs` item with `status: "expired"`** (the SGIP Equity Resiliency tier, present in 4 of 5 records) — must not display as a current offer. Omit it or label it explicitly as lapsed; showing an expired incentive as active is a real user-facing accuracy risk, not just a data-completeness gap.
- `interconnection_url` — safe to link to, but must not be framed as verified content, since the linked page itself returned HTTP 403 in 4 of 5 records and was never actually rendered.

## 4. Recommended first public product scope

**Cities:** the 4 `READY` records only — **Fremont, Oakland, Pasadena, San Diego.** Hold San Jose back from public launch until it's re-collected against the current schema (it is the only record missing `generation_supplier`, `eligibility_constraints`, `required_documents`, `inspection_steps`, and `timeline_days` entirely).

**Utilities represented:** PG&E (Fremont, Oakland), Pasadena Water and Power, SDG&E — two IOUs plus one municipal utility, demonstrating the schema handles both cleanly. **SCE is not represented at all** — the only pilot target that named SCE (for Pasadena) was found invalid and replaced; no valid SCE-served city has been collected yet. Anyone extending this pilot should not assume SCE coverage exists just because the schema supports it.

**Fields shown:** `utility`, `generation_supplier` (explicitly surfacing the CCA-vs-utility distinction — this is genuinely differentiated information competitors' generic calculators don't have), `city`, `county`, `permit_authority`, `permit_url`, `official_contacts`, `inspection_steps`, `eligibility_constraints`, `required_documents` where populated.

**Fields withheld or caveated:** `rebates`, `permit_fees`, `timeline_days` (per Section 3 above), and any `battery_programs` item flagged `expired`.

**Should the current calculator consume this data yet? No.** Per [docs/DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md) Section 6 ("coverage is binary, not blended"), `permit_fees` and `timeline_days` are populated in fewer than half the pilot localities — wiring the flat homepage calculator into this data now would force exactly the mixed real/placeholder blending that document prohibits. The right next consumer is the **locality-specific informational page** already planned as the Phase 3 consumer in DATA_ARCHITECTURE.md Section 5 — one page per `READY` city, built directly from its record, with every gap rendered honestly rather than papered over. Revisit calculator integration once `permit_fees`/`timeline_days` coverage is much higher and/or the sample of collected cities is larger than 5.

## 5. Unresolved risks carried forward

1. **San Jose was never re-collected** against the schema's current shape. It sits at `LIMITED`, not `NOT_READY`, only because its original session avoided obvious errors — not because its data is actually current or complete.
2. **County-level source blocking (403) is universal, not incidental** — every one of the 5 records has at least one county-association fact resting on domain-level confirmation rather than rendered content. If a stronger source ever becomes accessible, all 5 county fields deserve re-verification, not just the next new record.
3. **Every SGIP-based `battery_programs` entry needs a fresh check** against `selfgenca.com`'s live Program Metrics before any of the 4 affected records' battery figures are shown as current — the "through 2025" language was always a snapshot, not a guarantee.
4. This evaluation's **readiness thresholds are exactly the ones specified for this task** and haven't been independently re-derived or sanity-checked against, say, what would actually make a page trustworthy to a homeowner — they're a reasonable first cut, not a validated product bar.
