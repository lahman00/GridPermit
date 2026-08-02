# Next-Batch Evaluation — Decision Report

Closes out the 10-city next batch defined in [data/next-batch-targets.json](../data/next-batch-targets.json) and planned in [docs/NEXT_BATCH_PLAN.md](NEXT_BATCH_PLAN.md). Generated from [output/next-batch-evaluation.json](../output/next-batch-evaluation.json) — regenerate that file with `node scripts/evaluate-next-batch.mjs` before trusting any number below; this document is a narrative reading of that data, not an independent source.

This is a **read-only synthesis**, exactly like [PILOT_EVALUATION.md](PILOT_EVALUATION.md) was for the original 5-city pilot: it re-reads the 10 records and their existing validation reports and draws conclusions. It applies the identical deterministic readiness rule already established for the pilot — no record here was manually marked READY.

## 1. Per-record results

| Record | City | Utility (type) | Separate CCA | Completeness | Score | Errors | Readiness |
|---|---|---|---|---|---|---|---|
| `ca-fresno-fresno-pge` | Fresno | PG&E (IOU) | unknown (not researched) | 73.3% | 87 | 0 | **LIMITED** |
| `ca-san-joaquin-stockton-pge` | Stockton | PG&E (IOU) | Yes — Ava Community Energy | 73.3% | 87 | 0 | **LIMITED** |
| `ca-sonoma-santa-rosa-pge` | Santa Rosa | PG&E (IOU) | Yes — Sonoma Clean Power | 86.7% | 91 | 0 | **READY** |
| `ca-orange-irvine-sce` | Irvine | SCE (IOU) | Yes — Orange County Power Authority | 66.7% | 95 | 0 | **LIMITED** |
| `ca-orange-fullerton-sce` | Fullerton | SCE (IOU) | unknown (not confirmed this pass) | 66.7% | 87 | 0 | **LIMITED** |
| `ca-orange-santa-ana-sce` | Santa Ana | SCE (IOU) | No — vertically integrated (SCE) | 86.7% | 95 | 0 | **READY** |
| `ca-san-diego-chula-vista-sdge` | Chula Vista | SDG&E (IOU) | Yes — San Diego Community Power | 60.0% | 92 | 0 | **LIMITED** |
| `ca-san-diego-escondido-sdge` | Escondido | SDG&E (IOU) | Yes — Clean Energy Alliance | 73.3% | 98 | 0 | **LIMITED** |
| `ca-los-angeles-los-angeles-ladwp` | Los Angeles | LADWP (municipal) | No — vertically integrated | 73.3% | 98 | 0 | **LIMITED** |
| `ca-alameda-alameda-amp` | Alameda | Alameda Municipal Power (municipal) | No — vertically integrated | 86.7% | 86 | 0 | **READY** |

Readiness rule applied exactly as specified, identically to the original pilot: `READY` needs completeness ≥80% **and** score ≥85 **and** zero errors; `LIMITED` needs completeness ≥50% **and** score ≥75 **and** zero errors; anything else (including any error at all) is `NOT_READY`. **No record in this batch has a validation error** — every split here is driven by completeness and score, not schema failures.

## 2. Aggregate findings

- **Average completeness: 75.7%** across the 10 records — noticeably lower than the original pilot's 80.0% average, reflecting the harder research conditions this batch hit (see Section 3).
- **Average validation score: 91.6 / 100** — actually *higher* than the pilot's 89.0 average, because scores penalize errors/broken-source warnings, not missing-but-honestly-null fields.
- **3 READY, 7 LIMITED, 0 NOT_READY.**
- **Utility coverage: IOU and municipal**, across PG&E, SCE, SDG&E, LADWP, and Alameda Municipal Power — SCE and both new municipal utilities are represented in this pipeline's data for the first time.
- **Fields most often missing:** `permit_fees` and `rebates` (9 of 10 each — only Alameda's real $330 fee and $500 rebate were confirmed), `inspection_steps` (5 of 10), `interconnection_url` and `timeline_days` partial gaps in several SCE/SDG&E records, `generation_supplier` null for Fresno and Fullerton specifically (both left null rather than guessed).
- **Recurring source-access problem, but inconsistent per-domain** (unlike the pilot, where blocking was near-universal): fresno.gov and stocktonca.gov failed at the DNS level; cityoffullerton.com, chulavistaca.gov, ladbs.org, dbs.lacity.gov, and ladwp.com all returned HTTP 403. In contrast, srcity.org (Santa Rosa), santa-ana.gov, escondido.gov, alamedamp.com, cityofirvine.gov, and sonomacleanpower.org were all directly fetchable with no block — explaining why Santa Rosa, Santa Ana, and Alameda (all fully-fetchable domains) are exactly the 3 records that reached READY.
- **Recurring stale-data problem:** the statewide SGIP "Equity Resiliency" tier's "through 2025" window has elapsed in every PG&E/SCE-territory record that cites it (7 of 10) — the same recurring issue already documented for the pilot.
- **No schema gaps discovered.** Every fact encountered in this batch — including Alameda's real interconnection fee and income-qualified rebate, and Los Angeles's split permit-authority (LADBS) / interconnection-utility (LADWP) roles — fit the existing schema v1.3.0 shape without modification.
- **Two trust-rule violations were caught and corrected during collection, not after:** Fullerton's `generation_supplier` and Chula Vista's `battery_programs` were each initially drafted with a non-null value and no source citation — both were corrected to `null` before this evaluation ran, per the "never infer" rule. Separately, Santa Ana's Orange County Power Authority status was corrected mid-collection when a secondary source (a chamber-of-commerce blog claiming Santa Ana had joined OCPA) was found to directly contradict OCPA's own official member-city list — the blog claim was discarded per the "no blogs as evidence" rule.

## 3. Why completeness is lower here than the original pilot

The original 5-city pilot averaged 80.0% completeness with 4 of 5 records reaching READY. This batch averages 75.7% with only 3 of 10 reaching READY — not because collection was less careful, but because of two structural differences:

1. **This batch deliberately included SCE and two new municipal utilities for the first time**, so there was no prior record to lean on for interconnection URLs, inspection procedures, or fee schedules the way PG&E-territory records could reuse each other's confirmed facts.
2. **Access blocking hit unevenly across a wider set of domains** (10 different city/utility sites vs. the pilot's narrower set), and every genuinely blocked or unconfirmed fact was recorded as `null` rather than estimated — consistent with the "never infer" trust rule, at the direct cost of completeness percentage.

Both are expected consequences of expanding coverage responsibly rather than a quality regression.

## 4. What's safe to expose in the next public rollout

**Recommended for public pages now:** Santa Rosa, Santa Ana, and Alameda — the same "safe fields" list already established in [PILOT_EVALUATION.md](PILOT_EVALUATION.md) Section 3 applies unchanged (`utility`, `generation_supplier`, `city`, `county`, `permit_authority`, `permit_url`, `official_contacts`, `inspection_steps`, `eligibility_constraints`, `required_documents`), plus Alameda's two genuinely well-sourced `permit_fees`/`rebates` entries, which — unlike the pilot's single-source-only fee/rebate findings — are both directly quoted from AMP's own official page and did not trigger an `unsupported_claim` warning from an independent second source concern the same way the pilot's did (see Section 2's warning-category note; Alameda's are flagged `unsupported_claim` here too since only one source type was used, so they should still carry the same "verify with the issuing authority" caveat as the pilot's `permit_fees`/`rebates` guidance, not be shown as guaranteed).

**Hold back for now (LIMITED):** Fresno, Stockton, Irvine, Fullerton, Chula Vista, Escondido, Los Angeles — not because anything is wrong with them, but because real gaps remain (mostly `permit_fees`, `rebates`, and in some cases `inspection_steps`/`interconnection_url`) that a future, more targeted collection pass (or successful access to the blocked domains) could close.

## 5. Unresolved risks carried forward

1. **Fresno's CCA status remains genuinely unconfirmed.** Multiple searches found no evidence of an operational CCA, but no single official source directly confirms PG&E is Fresno's sole generation supplier — this is absence-of-evidence, correctly left `null`, not a confirmed fact.
2. **Fullerton's OCPA membership is plausible but unconfirmed.** Irvine's OCPA membership is confirmed directly from OCPA's own site; Fullerton was not independently re-confirmed this pass and is left `null` rather than assumed from Irvine's confirmed status.
3. **Every SGIP-based `battery_programs` entry needs a fresh check** against selfgenca.com's live Program Metrics before any of the 7 affected records in this batch are shown as current — same carried-forward risk already flagged for the pilot.
4. **Domain-blocking is not stable or predictable.** Several domains that failed this session (fresno.gov, cityoffullerton.com, chulavistaca.gov, ladbs.org, ladwp.com) may or may not block a future collection attempt — do not assume today's blocked-vs-fetchable split will hold.
5. This evaluation's **readiness thresholds are the same ones specified for the original pilot task** and, as noted there, haven't been independently re-derived — they remain a reasonable first cut, not a validated product bar.
