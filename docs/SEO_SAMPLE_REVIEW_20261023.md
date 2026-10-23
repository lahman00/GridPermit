# SEO sample review, 2026-10-23

Scope: a three-record re-check of the permit-fee statement against the current official source, using the freshness queue and review ledger from PR #141 (`scripts/lib/freshness-queue.mjs`, `data/freshness/reviews.json`). Reviewer: claude-code (agent), pending owner acknowledgement. No locality record was edited.

## Selection logic

1. Ran `buildFreshnessQueue` over the READY records with demand taken from the private Search Console page export (window 2026-09-10 to 2026-10-08). The private file stays outside the repository and no demand figures are quoted here.
2. Kept REVIEW_NOW and REVIEW_SOON records whose open permit_fees flag is a fee-date or fiscal-year flag (`FEE_SCHEDULE_OVER_A_YEAR_OLD`, `FEE_FISCAL_YEAR_ENDED`).
3. Removed locked pages (Quick Answer pilots, commercial SEO profiles, reviewed permit-pathway pages, PTO link pilot pages, balanced-links pilot and control pages). Monte Sereno is excluded for that reason. Denver was already reviewed.
4. Took the three records with the highest demand among the unlocked ones.

| Record | Page | Flag class |
| --- | --- | --- |
| `ca-orange-mission-viejo-sce` | /california/mission-viejo/solar-permit-guide/ | fee schedule over a year old |
| `nv-clark-las-vegas-nvenergy` | /nevada/las-vegas/solar-permit-guide/ | fee schedule over a year old |
| `ca-los-angeles-baldwin-park-sce` | /california/baldwin-park/solar-permit-guide/ | fee schedule over a year old and fiscal year ended |

Next in line if the sample is widened: Rancho Santa Margarita, Newport Beach, Rohnert Park.

## Outcomes (access date 2026-10-23)

All three are CONFIRMED_CURRENT. The review entries in `data/freshness/reviews.json` carry the evidence URL, the observed excerpt, the document revision and the field fingerprint. PDFs were downloaded and read with `pdftotext`; the fetch tool alone could not decode them.

- **Mission Viejo.** The City's Building Services page (https://www.missionviejo.gov/departments/community-development/building-services) links one schedule, "Building Division Fee Schedule Effective April 1, 2023". The PDF at https://www.missionviejo.gov/sites/default/files/building-fee-schedule-4-1-23.pdf lists $450 up to 15 kW and $15 per kW above, as the record says. No newer building schedule is linked. Not reviewed: the City's energy-efficiency fee waiver.
- **Las Vegas.** https://files.lasvegasnevada.gov/building-safety/FeeTable-effective-7-2021.pdf (Table 3-D, effective July 1, 2021) shows item 3 $55, item 49 $102 plus $259, item 50 $60 plus $53, matching the record. It is byte-identical to "Building & Fee Table" (Building-Safety-Fee-Tables.pdf), the document the City lists under Fee Schedule at https://www.lasvegasnevada.gov/Government/Departments/Building-Safety/Building-Safety-Resources?tab=7. The City's 2024 industry notice covers only sewer connection and residential construction tax fees.
- **Baldwin Park.** https://www.baldwinpark.com/DocumentCenter/View/3937/City-Wide-Fee-Schedule--FY-2025-26-Fee-ALL---Effective-102025 (effective October 20, 2025) lists $447 up to 15 kW plus $15 per kW, matching the record. The City's News Flash posts this schedule and nothing newer; the Building & Safety page still links only an FY 2020-21 document. A FY 2026-27 schedule may be adopted later, so this clearance lasts 90 days at most. The record's own open caveats (separate plan-review fee not verified, Chapter 156 not readable) are unchanged and still appear in the queue.

Effect on the queue: the `permit_fees` date flags show as cleared by review for 90 days (until 2026-12-22) and wait for owner acknowledgement. Las Vegas drops to CURRENT; Mission Viejo and Baldwin Park stay REVIEW_SOON for unrelated flags (interconnection confidence, verification-gap notes).

## Bakersfield: evaluation only, nothing implemented

Observation: private Search Console evidence (not reproduced here) shows the Bakersfield guide near page one for a service-intent query pattern.

What an evidence-backed "who files the permit" block needs: an official statement of who may be the applicant (owner, owner-builder, licensed contractor, or either), how it is submitted (counter, email, portal, SolarAPP+ or similar), and whether an owner-builder declaration is required. Everything has to come from the City or its code.

What I could verify today:
- The record's expedited-solar source (PV Toolkit Document #1, file metadata dated February 2018) says "applicants" may submit in person at 1715 Chester Avenue or by email or fax, review takes 1-3 days, and the fee is $187. It does not say who the applicant must be.
- The Building Division page (https://www.bakersfieldcity.us/building-division) and the Online Permit Application and Status page contain no solar, applicant-type or SolarAPP+ text in what was retrievable. The Forms page and Municipal Code 15.56.030 were not read.

Verdict: the "who files" statement cannot be verified now, so no block should be written. Proposal: (1) read the Forms page and the code section directly for applicant eligibility and any owner-builder rule; (2) confirm with the Building Division by phone or email (661-326-4677) whether the 2018 toolkit and $187 fee are still in use, since the document is old; (3) if verified, add a block following the pattern in `src/lib/permit-pathway-answer.ts` and register Bakersfield as an observed page. The source age also suggests a fee and procedure re-check for this record regardless of the block.

## Rollback

`git revert <commit>` on branch `claude/sprint-seo-20261023` removes the three review entries and this document. Nothing else changed.
