# Next Batch Plan — 10 California Targets

This document explains the 10 targets in [data/next-batch-targets.json](../data/next-batch-targets.json), proposed for a future run of `scripts/collect-pilot.mjs`. **Nothing in this batch has been collected.** No locality record, source payload, or public page exists yet for any of these 10 cities — this is a target list and a naming/utility-verification pass only, exactly like `data/pilot-targets.json` was before the first pilot's collection began.

## Why these 10, and why now

The first pilot (5 records: San Jose, Fremont, Oakland, Pasadena, San Diego — see [PILOT_EVALUATION.md](PILOT_EVALUATION.md)) proved the schema, the collection pipeline, and the public locality-page template across exactly 3 utility types: one PG&E CCA pattern (Fremont/Oakland via Ava), one vertically-integrated municipal utility (Pasadena/PWP), and one SDG&E CCA pattern (San Diego/SDCP). It never touched Southern California Edison (SCE) — the state's other major investor-owned utility — at all. This batch is designed to close that gap and broaden the municipal-utility sample past a single small city (Pasadena), while staying the same size and rigor as the first pilot.

## Utility mix

| Utility | Type | Cities in this batch |
|---|---|---|
| Pacific Gas and Electric Company (PG&E) | IOU | Fresno, Stockton, Santa Rosa |
| Southern California Edison (SCE) | IOU | Irvine, Fullerton, Santa Ana |
| San Diego Gas & Electric (SDG&E) | IOU | Chula Vista, Escondido |
| Los Angeles Department of Water and Power (LADWP) | municipal | Los Angeles |
| Alameda Municipal Power (AMP) | municipal | Alameda |

This meets the requested minimums exactly (3 PG&E / 3 SCE / 2 SDG&E / 2 municipal = 10) rather than padding past them, so the batch stays the same scale as the first pilot.

## Geographic mix

Eight counties are represented, spanning the Central Valley (Fresno, San Joaquin), the North Bay (Sonoma), Orange County (three cities — Irvine, Fullerton, Santa Ana), San Diego County (two cities, alongside the already-collected city of San Diego itself), and two counties that already have a collected record from a *different* city (Los Angeles County already has Pasadena; Alameda County already has Fremont and Oakland). Reusing a county with a new city is intentional and safe — `record_id` is unique per city, not per county, and the naming-validation dry-run below confirms no collisions with the existing 5 records.

## Why each target was chosen

- **Fresno** — PG&E's largest Central Valley city not yet in the pilot; high population, straightforward IOU case, good SEO value.
- **Stockton** — PG&E, San Joaquin County; adds Central Valley geographic diversity beyond Fresno.
- **Santa Rosa** — PG&E, North Bay; adds a CCA-overlay case (Sonoma Clean Power, membership confirmed 2026-08-02 directly from the CCA's own site) distinct from the East Bay's Ava, testing whether the schema's CCA handling generalizes to a third real-world CCA.
- **Irvine** — SCE; large, well-documented Orange County city, and a clean test of the utility/CCA split now that Orange County Power Authority (OCPA) has launched — mirrors the Fremont/Oakland/San Diego pattern but for SCE territory for the first time.
- **Fullerton** — SCE; deliberately chosen despite (in fact, because of) a naming trap: its own city site has a page titled "Public Utilities Commission," which could be mistaken for a municipal electric utility the same way "Southern California Edison" was wrongly assumed for Pasadena in the original pilot. Verified directly (see evidence below) that this commission covers water/sanitation/sewer/trash, not electric, before including it.
- **Santa Ana** — SCE; a large Orange County city with no CCA membership confirmed one way or the other in this pass — included specifically to test the schema/collection process on a "plain IOU, no CCA" SCE case, as a control against Irvine/Fullerton's OCPA membership.
- **Chula Vista** — SDG&E; San Diego County's second-largest city, already documented as a San Diego Community Power (SDCP) member alongside the already-collected city of San Diego — a direct opportunity to compare two SDCP-member cities' records once collected.
- **Escondido** — SDG&E; a North County San Diego city — re-verification on 2026-08-02 found it is **not** an SDCP member (unlike Chula Vista) but is instead served by a different CCA, Clean Energy Alliance. Kept in this batch specifically as the control case proving the schema/collection process must verify each city's CCA membership individually rather than assuming a regional pattern.
- **Los Angeles (LADWP)** — the single most significant municipal utility in California by customer count; the pilot's only municipal-utility case so far (Pasadena/PWP) is a small city, so this adds a municipal-utility case at the opposite end of the size spectrum, testing whether the schema and page template hold up for the state's largest city.
- **Alameda (AMP)** — a small, vertically-integrated municipal utility, distinct from both Pasadena/PWP (different city, different administrative structure) and from Fremont/Oakland (same county, but AMP is a completely separate utility from PG&E/Ava) — chosen to add a second small-municipal case and to specifically stress-test that the naming/record_id scheme correctly disambiguates a new city from two already-collected cities in the very same county.

## Utility-verification approach (why every target here is "confirmed", not guessed)

Every target's `utility_verification.evidence` entry cites an official source — either the utility's own site or the city's own site — checked on 2026-08-02, following the same pattern `data/pilot-targets.json` established after the Pasadena/SCE correction. No target was added on the basis of general knowledge or a secondary blog/directory listing alone; where a secondary source was the first hit (e.g. news coverage for Chula Vista's SDG&E/SDCP transition), an official source was still the one actually cited as evidence. **No candidate target was excluded from this batch for failing verification** — all 10 candidates researched were confirmed — but the verification step was applied uniformly regardless, per the target-validity guard's design intent.

## Known CCA / municipal-utility considerations

- **Confirmed CCA overlay expected:** Irvine and Fullerton (Orange County Power Authority, OCPA), Chula Vista (San Diego Community Power, SDCP), and — confirmed in the 2026-08-02 re-verification pass — Santa Rosa (Sonoma Clean Power, confirmed directly from sonomacleanpower.org) and Escondido (**Clean Energy Alliance**, confirmed directly from thecleanenergyalliance.org — this corrects an earlier assumption that Escondido might share Chula Vista's SDCP membership; it does not). In every case the utility named in the target is the interconnection/distribution/billing utility (SCE, SDG&E, or PG&E), not the generation supplier — the same split already handled as a field separate from `utility` for Fremont/Oakland/San Diego.
- **No CCA overlay expected (vertically integrated):** Los Angeles (LADWP) and Alameda (AMP), like the existing Pasadena (PWP) record — municipal utilities that generate their own power rather than sitting alongside a separate CCA.
- **Santa Ana** is the one target in this batch with no CCA signal found either way — a genuine "plain IOU" control case.
- **Naming-trap risk, resolved:** Fullerton's city site has a "Public Utilities Commission" page that names look like it could indicate a municipal electric utility (the exact category of mistake — an assumed utility that turned out wrong — that the target-validity guard was built to catch after the real Pasadena/SCE incident). Verified directly that this commission's scope is water/sanitation/sewer/trash only; SCE is confirmed as Fullerton's electric utility by both the city's own utility-services breakdown and independent reporting.

## Expected research difficulty (for the actual collection pass, not this planning pass)

| Target | Expected difficulty | Why |
|---|---|---|
| Los Angeles (LADWP) | Low | Extremely well-documented; LADWP publishes extensive public solar/interconnection materials. |
| Alameda (AMP) | Low–Medium | Well-documented for a small utility; likely fewer solar-specific public pages than LADWP or PG&E. |
| Fresno, Stockton | Low | Standard, well-trodden PG&E IOU cities; PG&E's own solar/interconnection materials already used successfully for Fremont/Oakland/San Jose apply directly. |
| Santa Rosa | Low–Medium | PG&E utility side is low-difficulty; Sonoma Clean Power generation-supplier relationship is now confirmed (2026-08-02), so this is mostly a matter of recording it correctly during collection. |
| Irvine, Fullerton | Medium | SCE-side materials are new to this pipeline (first SCE collection); OCPA CCA relationship needs direct confirmation per city, not just per-utility. |
| Santa Ana | Medium | Same SCE-materials-are-new consideration as Irvine/Fullerton, without an already-known CCA angle to cross-check against. |
| Chula Vista | Medium | SDG&E utility side is already proven (San Diego pilot record); SDCP membership is already suggested by a secondary source and should be corroborated with an official one. |
| Escondido | Medium | SDG&E utility side is proven; the generation-supplier question is now resolved (Clean Energy Alliance, confirmed 2026-08-02, not SDCP) — remaining work is collecting CEA's own program/rate details, which this pipeline hasn't touched before. |

## Priority order for actual collection

1. **Los Angeles (LADWP)** — highest public-interest value (largest CA city, largest municipal utility), lowest expected difficulty.
2. **Irvine (SCE)** — first SCE record; establishes the pattern the other two SCE targets can then follow quickly.
3. **Fullerton (SCE)** — second SCE record, reusing Irvine's research path; also closes out the naming-trap verification already done here.
4. **Santa Ana (SCE)** — third SCE record; the "plain IOU" control case, useful once the SCE pattern is established.
5. **Chula Vista (SDG&E)** — reuses San Diego's already-proven SDG&E/SDCP research path most directly.
6. **Fresno (PG&E)** — low difficulty, high population, straightforward.
7. **Stockton (PG&E)** — same rationale as Fresno.
8. **Alameda (AMP)** — second municipal-utility record; small enough to move quickly once LADWP's municipal-utility research pattern exists.
9. **Santa Rosa (PG&E)** — Sonoma Clean Power relationship now confirmed; low remaining risk.
10. **Escondido (SDG&E)** — generation-supplier now resolved (Clean Energy Alliance), but this is the pipeline's first CEA-territory record; scheduled last so any process refinements from targets 1–9 are already in place.

## What this plan deliberately does not do

- It does not collect any of the 10 records — `data/localities/`, `data/source-payloads/`, `output/validation-reports/`, and `src/pages/california/` are all untouched by this plan.
- It does not create any new public page — the locality-page factory ([LOCALITY_PAGE_FACTORY.md](LOCALITY_PAGE_FACTORY.md)) only ever acts on records that already exist and are `READY`, and none of these 10 exist yet.
- It does not weaken or bypass `scripts/collect-pilot.mjs`'s target-validity guard — every target here is `status: "confirmed"`, and the guard will still run exactly as written the moment a real collection pass begins.

## Verification performed for this plan

```bash
PILOT_TARGETS_PATH=data/next-batch-targets.json node scripts/collect-pilot.mjs --dry-run
```

All 10 targets passed naming validation (`naming_valid: true`) with no `CONFIG_ERROR`s, and every target correctly reported `COLLECTION_REQUIRED` (no source payload exists yet) rather than being treated as already collected — confirming the target list is well-formed and consistent with the existing pipeline before any real collection begins.
