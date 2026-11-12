# California permit data page, 2026-11-12

Status: branch `claude/permit-data-v2-20261112` on production `689412d`. Not merged or deployed without explicit owner approval. Reuse terms CC BY 4.0 approved by the owner on 2026-11-12.

## What it is
`/california/solar-permit-data/` and `/california/solar-permit-data.csv`: one row per California city with a published guide, built at build time from each city's verified record (`src/lib/permit-data-study.ts`). Counts on the page, the table and the CSV come from the same rows. Linked from the homepage, the California hub, the guides index and the timeline page. Dataset JSON-LD for Google Dataset Search; the CSV is `noindex`, UTF-8 with a byte order mark, and served as `text/csv; charset=utf-8`.

## Rules (what a cell means)
- **Automated path.** First the record's pathway field, with the Permit Path checker's rule. Otherwise another sourced field with confidence of at least 0.7 that states SolarAPP+, Symbium or an automated/instant permit affirmatively: conditions, required documents (for example a SolarAPP+ approval document), inspection steps, fee names, the permit page address, or the title or address of a cited official page that backs a content field (identity fields such as the city or office name do not count). Research notes, vendor pages (gosolarapp.org, solar-app.org, nrel.gov, symbium.com), "solar application", and negative or unconfirmed statements never count. A pathway field whose only sources are the platform's own pages is shown as "per the platform's jurisdiction list" and not counted. Each row says which field the path came from; the CSV includes the exact text, that field's confidence and the pathway-field confidence.
- **Express or over-the-counter.** A pathway field or condition describing an express, over-the-counter, self-issued or no-plan-review path without naming an automated platform (for example Los Angeles, San Diego, San José, Long Beach, Anaheim). Shown, never counted as automated.
- **Fees.** Residential city permit or utility interconnection fee amounts from a fee field with confidence of at least 0.7 and a source. Platform or path fees are listed separately: SolarAPP+/Symbium charges (`isPlatformFee` in `src/lib/record-facts.ts`) and the entries in `PATH_FEE_NAMES` (Antioch, Lafayette, Hercules, La Mesa). Commercial, multifamily, sample-total, penalty and re-inspection entries and tiers for systems of 50 kW or more are left out. Entries listed in `FEE_RECHECK` are withheld until their sources are re-read (Riverside, Norco, Scotts Valley, Roseville). These rules apply to this page only; guide descriptions are unchanged during their measurement window.
- **Utility.** `canonicalUtilityName`; cities that fail the split-territory guard are labelled "Split territory".
- **Blank** means the record's structured fields do not state the fact, not that the city lacks it. The page says it is not a census and not an SB 379 compliance assessment, and links the CEC Residential Solar Permit Program Status Dashboard for self-reported status.

## Changes since the first draft (two independent reviews)
The first draft counted only the pathway field (182 cities) while at least 23 records state SolarAPP+ or Symbium elsewhere; counted platform fees as fees; showed split SCE/SDG&E cities as SCE; and contained wording and CSV issues. The second review found no blockers and six smaller issues: express/self-issued paths in the largest cities read as blank, two rows rested on page titles their records say were never read (Lake Forest, Norwalk), three rows still showed SolarAPP+ path fees as city fees, commercial-scale tiers and one outlier topped the fee column, a utility stat miscounted, and one row rested on a vendor page (San Juan Capistrano). All are addressed above. Three records state their path only in research notes (Lincoln, San Marcos, Monte Sereno) and stay blank until their records are corrected.

## Before any outreach (owner gates)
1. Reconcile the permit-path column with the CEC dashboard's data download (owner approval needed to download it: `Residential_Solar_Permitting_Program_Data_2026-11-02_ada.xlsx`, about 48 KB, energy.ca.gov) and correct records that disagree with their own sources or the CEC report. Start with the largest cities a reader will check first: Los Angeles, San Diego, San José, Long Beach, Anaheim, Fresno, Sacramento, Oakland, Bakersfield and Riverside, then every row marked "Not stated in record".
2. Re-read the official fee sources for the `FEE_RECHECK` cities.
3. Re-read the live page numbers into the outreach drafts (kept privately in the command center).

## Measurement
Leading indicators only: referring domains to the page in Search Console, a Google Dataset Search listing, `permit_data_downloaded` events, and impressions for SolarAPP+/Symbium/permit-data queries. No traffic or revenue effect is assumed.

## Rollback
Revert the PR, or delete the two route files and the four links.
