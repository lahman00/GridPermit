# California permit data page, 2026-11-12

Status: branch `claude/permit-data-v2-20261112` on production `689412d`. Not merged or deployed without explicit owner approval. Reuse terms CC BY 4.0 approved by the owner on 2026-11-12.

## What it is
`/california/solar-permit-data/` and `/california/solar-permit-data.csv`: one row per California city with a published guide, built at build time from each city's verified record (`src/lib/permit-data-study.ts`). Counts on the page, the table and the CSV come from the same rows. Linked from the homepage, the California hub, the guides index and the timeline page. Dataset JSON-LD for Google Dataset Search; the CSV is `noindex`, UTF-8 with a byte order mark, and served as `text/csv; charset=utf-8`.

## Rules (what a cell means)
- **Automated path.** First the record's pathway field, with the Permit Path checker's rule. Otherwise another sourced field that states SolarAPP+, Symbium or an automated/instant permit affirmatively: conditions, required documents (for example a SolarAPP+ approval document), inspection steps, fee names, the permit page address, or the title or address of a cited city page. Research notes, vendor pages (gosolarapp.org, nrel.gov, symbium.com), "solar application", and negative or unconfirmed statements never count. Each row says which field the path came from; the CSV includes the exact text and the pathway confidence.
- **Fees.** Residential city permit or utility interconnection fee amounts from a fee field with confidence of at least 0.7 and a source. SolarAPP+/Symbium platform fees are listed separately (`isPlatformFee` in `src/lib/record-facts.ts`); commercial, multifamily and sample-total entries are left out; entries listed in `FEE_RECHECK` are withheld until their sources are re-read (Riverside, Norco, Scotts Valley).
- **Utility.** `canonicalUtilityName`; cities that fail the split-territory guard are labelled "Split territory".
- **Blank** means the record's structured fields do not state the fact, not that the city lacks it. The page says it is not a census and not an SB 379 compliance assessment, and links the CEC Residential Solar Permit Program Status Dashboard for self-reported status.

## Changes since the first draft (independent review)
The first draft counted only the pathway field (182 cities) while at least 23 records state SolarAPP+ or Symbium elsewhere; counted platform fees as fees; showed split SCE/SDG&E cities as SCE; and contained wording and CSV issues. All are addressed above. Three records the reviewer listed state their path only in research notes (Lincoln, San Marcos, Monte Sereno) and stay blank until their records are corrected.

## Before any outreach (owner gates)
1. Reconcile the automated-path column with the CEC dashboard's data download (needs the owner's approval to download it) and correct records whose pathway field disagrees with their own sources or the CEC report. Large cities matter most for credibility (for example San José shows no automated path in our record).
2. Re-read the official fee sources for the `FEE_RECHECK` cities.
3. Re-read the live page numbers into the outreach drafts (kept privately in the command center).

## Measurement
Leading indicators only: referring domains to the page in Search Console, a Google Dataset Search listing, `permit_data_downloaded` events, and impressions for SolarAPP+/Symbium/permit-data queries. No traffic or revenue effect is assumed.

## Rollback
Revert the PR, or delete the two route files and the four links.
