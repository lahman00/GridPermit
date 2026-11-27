# Colorado pilot: Aurora and Fort Collins guides (2026-11-13 to 2026-11-14)

Owner-approved scope: research twelve Colorado cities, publish two guides (Aurora, Fort Collins), link them to the existing $9 organizer, and add only the discovery changes those two guides need. The other ten cities are research and content planning only.

## What was published

| Guide | Record | Readiness |
|---|---|---|
| `/colorado/aurora/solar-permit-guide/` | `data/localities/co-arapahoe-aurora-xcel.json` (new) | 14 of 15 fields, validation score 100 |
| `/colorado/fort-collins/solar-permit-guide/` | `data/localities/co-larimer-fort-collins-fcu.json` (rewritten, was LIMITED at 60%) | 14 of 15 fields, validation score 88 |

`timeline_days` is null in both: neither city publishes a review time for solar permits on the pages reviewed, so none is shown.

Fort Collins scores 88 because fortcollins.gov answers automated HEAD requests with HTTP 403 (six URLs, two points each). The pages were read in a real browser session and are unaffected for visitors.

## Evidence

Research, claims, source captures and the audit live outside the public repository, in the project command center: `01-Command-Center/research/colorado-12-cities-20261113/`.

- Every public sentence in the two records is listed in `cities/<city>/RECORD_TRACE.json` with the claim ids it rests on.
- Every claim quote was machine-checked against a raw copy of the official source (`tools/verify_quotes.py`).
- An independent auditor re-read the sources and gave a verdict per statement (`audit/<city>/AUDIT.json`). Statements that failed were removed or corrected before publication.
- Official sources only: the two cities, the Fort Collins Municipal Code, and Xcel Energy's Colorado pages.

Known conflicts are stated on the page instead of being resolved silently, for example the two revisions of Aurora's solar checklist (Form #A205, 09/2017 and 05/2023) and the different starting points Fort Collins Utilities gives for its six-month installation deadline.

## Utility and the reader's own address

- Aurora: the City says Xcel Energy serves "the majority of residences" and its Energy Action Plan says some portions of the city are served by other electric utilities. The record trips `src/lib/utility-split-guard.ts`: the guide shows "Confirm utility for your address" and the state index adds "(depends on the address)".
- Fort Collins: the City's own utility serves the city. Municipal Code Sec. 26-447 lets an annexed property keep its previous electric utility until the City elects to provide service, and no official source lists such addresses. The independent auditor rejected a "split-territory" label as stronger than the code, so the guide names Fort Collins Utilities and carries the annexation note with the Service Area Map pointer.

On both new guides the utility FAQ says the utility depends on the address and tells the reader to check their electric bill.

## Protecting the search measurement (window closes 2026-12-16)

`docs/growth/TRAFFIC_GROWTH_20261111.md` measures a description change on existing guides. No treatment, holdout or locked page may change during the window. The two new guides are a separate group.

- `src/lib/measurement-window-guides.ts` lists the two record ids. `relatedPoolFor` keeps them out of every other guide's "Related cities" list, so no existing guide changes because they were published.
- The address-level utility FAQ wording is opt-in (`buildFaqs(record, { addressLevelUtility })`) and only used for the two new guides. Existing guides keep their current FAQ until the window closes.
- `src/components/OrganizerNote.astro` (optional pointer to `/solar-project-organizer/`, same wording as the Permit Path page) renders only on the two new guides.
- The "(depends on the address)" qualifier on the state index applies only to new guides whose utility is not a city-wide determination (Aurora).

Pages that change in the build: the two new guides, `/colorado/` (two new cards), pages that list or search all guides (homepage search index, `/permits/`, Permit Path locality list), and the sitemap. A full before/after build diff confirmed that no existing guide page changed and that the paid-route manifest (86 routes) is byte-identical.

## After 2026-12-16

1. Remove the two ids from `NEW_GUIDES_DURING_MEASUREMENT` so they join other guides' related lists.
2. Decide whether the address-level utility FAQ and the organizer note should apply to all guides; if so, remove the `isNewGuide` conditions.
3. Update `tests/measurement-window-guides.test.mjs` accordingly.

## Rollback

Revert the merge commit. That removes both pages, both redirects, the records' new content and the helper module. No data migration, product, price, checkout or partner route is involved.

## Not done on purpose

No indexing request was sent to Google, no account or permission was changed, no paid tool or API was used, no outreach was sent, and no test purchase was made. Publishing these guides is not evidence of rankings, traffic or sales.

## Batch 2 (2026-11-20): Wheat Ridge, Lafayette, Grand Junction

Twelve more Colorado cities were researched from raw captures of official sources (`01-Command-Center/research/colorado-batch2-20261120/`). Three passed every gate and are published in this change:

| Guide | Record | Readiness |
|---|---|---|
| `/colorado/wheat-ridge/solar-permit-guide/` | `co-jefferson-wheat-ridge-xcel` | 13 of 15 fields, validation 86 |
| `/colorado/lafayette/solar-permit-guide/` | `co-boulder-lafayette-xcel` | 13 of 15 fields, validation 100 |
| `/colorado/grand-junction/solar-permit-guide/` | `co-mesa-grand-junction-multi` | 14 of 15 fields, validation 96 |

- Same method as the pilot: sentence-level trace to quote-checked claims, then an independent audit with a verdict per sentence. All audit edits were applied; a failed inferred county (Lafayette) was removed and two inferred "split" sentences (Grand Junction) were replaced by the auditor's wording.
- Wheat Ridge is the first Colorado guide whose pathway names SolarAPP+: the City's own "Solar APP +" page says it accepts SolarAPP+ for residential roof-mounted systems and lists the limits and exclusions. Three low-value City sources were dropped from the record so that the City's bot-blocked links (HTTP 403 to automated HEAD requests) stay within what the validator tolerates.
- Grand Junction permits are issued by the Mesa County Building Department. Which of Xcel Energy and Grand Valley Power serves an address is not stated by either source, and the guide says so.
- Measurement window: the three ids are in `NEW_GUIDES_DURING_MEASUREMENT` and in the batch 2 set of `relatedPoolFor`, so no existing guide's related list changes. `utility-hub.ts` and `county-hub.ts` now skip guides published during the window; without that, the new Xcel guides would have created an "Xcel Energy" hub and changed the hub link on existing Xcel guides.
- Not built, with reasons (research kept): Greeley, Castle Rock, Pueblo, Windsor, Northglenn (official pages captured do not give a solar document list, a solar fee, or the City site refuses automated access); Brighton (audit passed, held back by the coordinator as too thin on the City side); Englewood, Littleton, Commerce City (audited and ready, but the validation score is below 85 only because the city sites answer automated link checks with 403; they need an owner decision on that gate before publication).

## Capture attestations and Englewood, Littleton, Commerce City (2026-11-20, owner-approved gate change)

Some city sites answer every automated request with HTTP 403 although their pages open normally. The validator charged 2 points per such link, so a record whose sources were all read in a browser could fall below the READY threshold of 85 only because it cited many pages of one blocked site.

`scripts/validate-record.mjs` now reads `data/source-captures/<record_id>.json`. A URL that returns HTTP 401, 403 or 429 carries no score penalty when that file holds a capture of the exact URL: HTTP 200 in a browser session, a SHA-256 of the saved copy, taken within 30 days of the record's `last_verified`. The finding is still reported (`blocked_url_with_capture`), so a report never looks cleaner than the network check was. Timeouts, DNS failures, 5xx responses, bot-challenge pages and 404/410 are treated exactly as before. A record without an attestation file scores exactly as before, so no existing record's score changes.

Each attested hash was re-checked against the saved file on the owner's computer before commit; entries that could not be re-checked were left out and keep their penalty.

With that rule, three audited records publish: Englewood (validation 100), Littleton (96) and Commerce City (96). They follow the same embargo as the other batch 2 guides.

## Batch 3 (2026-11-24): Brighton, Erie, Superior, and the first Arizona batch (Queen Creek, Oro Valley)

Same method as batches 1 and 2: raw captures of official pages on the owner's computer, quote-checked claims, a sentence-level trace, then an independent audit with a verdict per public sentence. Research folders: `01-Command-Center/research/colorado-batch2-20261120/` (Colorado) and `01-Command-Center/research/arizona-batch1-20261121/` (Arizona).

| Guide | Record | Readiness |
|---|---|---|
| `/colorado/brighton/solar-permit-guide/` | `co-adams-brighton-multi` | 13 of 15 fields, validation 100 |
| `/colorado/erie/solar-permit-guide/` | `co-boulder-erie-multi` | 14 of 15 fields, validation 100 |
| `/colorado/superior/solar-permit-guide/` | `co-boulder-superior-xcel` | 14 of 15 fields, validation 100 (capture attestation) |
| `/arizona/queen-creek/solar-permit-guide/` | `az-maricopa-queen-creek-multi` | 13 of 15 fields, validation 100 (capture attestation) |
| `/arizona/oro-valley/solar-permit-guide/` | `az-pima-oro-valley-multi` | 13 of 15 fields, validation 100 (capture attestation) |

- Audit results: Brighton 162 pass, 4 edits; Erie 183 pass, 10 edits, 1 fail (an unsupported "split" sentence, removed); Superior 128 pass, 5 edits; Queen Creek 113 pass, 7 edits; Oro Valley 102 pass, 11 edits. All edits are applied. Two material omissions found by the auditor were added with new quoted claims and re-checked: United Power's written approval for normal operation (Erie) and Xcel's meaning of permission to operate (Superior).
- Fees as published: Queen Creek $375 flat for a single-family PV permit; Oro Valley $54 per PV permit; Erie $164.50 flat for residential solar, plus use tax; Superior lists permit fees of $300 as waived, shown as $0 with the Town's sentence; Brighton's permit fee comes from the City's valuation table (in the notes, not computed), and the listed amounts are its re-inspection and after-hours inspection fees.
- Utility: no record claims one utility for every address unless the city says so. Superior's Energy page names Xcel Energy for residents and businesses. Brighton and Erie list two utilities. Queen Creek and Oro Valley each name one utility only in passing, so both use the `-multi` id and the page asks the reader to confirm the utility for their address; Oro Valley's value is "Tucson Electric Power (TEP), if it serves your address", approved by the auditor.
- Template wording: the five new guides answer "What utility serves solar customers in ...?" with their own audited utility notes (Boulder already did), because the generic sentence "electric service can differ from one address to another" is not supported for every city. On state index cards the address-level label now reads "(confirm for your address)".
- Not built, with reasons kept in the research folders. Colorado: Loveland (City pages refused automated access in the second round; the solar checklist and 2026 fee schedule were not captured), Golden (the City's building pages moved and the captured solar page has no permit steps, documents or fees), Louisville (the fee PDF is not readable as text and no solar checklist was captured), Pueblo West (no solar document list, inspection steps, solar fee or named electric utility). Second capture round: Castle Rock and Greeley (no solar document list and no fee tied to a residential solar permit), Windsor (no solar fee), Pueblo (documents, inspections and a $400.00 PV fee are now sourced, but no official source names the electric utility, so 9 of 15 fields); Northglenn refused automated access again. Arizona: Gilbert, Surprise and Yuma (no solar requirements in the captured City pages), Avondale and Peoria (the sites refused automated access), Tempe (the fee tables refused automated access), Goodyear (documents and inspections only for SolarAPP+, fee schedule dated 2023), Glendale (10 of 15 fields; the only PV fee is on an undated sheet, and the 2019 schedule says amounts are CPI-adjusted every July 1), Buckeye (10 of 15 fields; no official source names the electric utility), Flagstaff (no solar document list or inspection steps).
- Measurement window: the five ids are in `NEW_GUIDES_DURING_MEASUREMENT` and in the batch 3 set of `relatedPoolFor`; utility and county hubs already skip window guides. The full before/after build diff shows only the five new guide pages and their Permit Path records as added; changed pages are the Colorado and Arizona state indexes, the guide directory, search, the sitemap, the release file and the Centennial guide (below). No other guide changed and the 86-route paid manifest is byte-identical.

### Quality re-check of the live Colorado guides (2026-11-24)

- All 323 source URLs cited by the 20 Colorado records (the 19 live guides and Cañon City, which is not published) were captured again: 280 with HTTP 200, 42 refused automated access (HTTP 403, two attempts each, not bypassed) and 1 no longer exists (404).
- Every dollar amount, phone number and email in the record was found again in fresh captures of that record's own sources for 17 of the 20 records (16 of the 19 live guides). Westminster, Arvada and Wheat Ridge could not be re-confirmed this round because their city sites refused automated access; nothing found suggests a change.
- The 404 was CORE Electric Cooperative's Small Generation Interconnection Procedures (07/21/2025), cited by Centennial. The same document is now at a new address (the one Parker already cites) and still gives the interconnections email and the meter-release and witness-test steps. Centennial's source link and its accessed date are updated; nothing else on the page changes. Centennial now has a capture attestation, because the City site answers automated link checks with 403.
- A network re-validation of all 20 records (with the Centennial fix) found no dead links. Several city sites now answer automated link checks with 403 (Westminster, Centennial, Arvada, Lakewood, Fort Collins). Their committed validation reports are unchanged. Before any of them is re-validated, take fresh browser captures for an attestation, or Westminster, Arvada and Lakewood would score below 85 for blocked links alone.
- After 2026-12-16, also clear the batch 3 set in `relatedPoolFor` and the batch 3 ids from `NEW_GUIDES_DURING_MEASUREMENT`. Fee amounts with cents render without a trailing zero (for example $164.5); fixing the formatter changes every guide with such an amount, so it waits for the window to close.

## Batch 4 (2026-11-27): Durango, Federal Heights, Glenwood Springs, Frederick, Sheridan, Salida, Wellington, Alamosa

Same method as batches 1 to 3: raw captures of official pages on the owner's computer, quote-checked claims, a sentence-level trace, then an independent audit with a verdict per public sentence. Research folder: `01-Command-Center/research/colorado-batch4-20261127/`. 36 Colorado candidates were researched; these eight met the gate.

| Guide | Record | Readiness |
|---|---|---|
| `/colorado/durango/solar-permit-guide/` | `co-la-plata-durango-multi` | 12 of 15 fields, validation 98 |
| `/colorado/federal-heights/solar-permit-guide/` | `co-adams-federal-heights-multi` | 14 of 15 fields, validation 100 (capture attestation) |
| `/colorado/glenwood-springs/solar-permit-guide/` | `co-garfield-glenwood-springs-multi` | 13 of 15 fields, validation 100 |
| `/colorado/frederick/solar-permit-guide/` | `co-weld-frederick-united-power` | 13 of 15 fields, validation 100 |
| `/colorado/sheridan/solar-permit-guide/` | `co-arapahoe-sheridan-xcel` | 13 of 15 fields, validation 100 |
| `/colorado/salida/solar-permit-guide/` | `co-chaffee-salida-multi` | 14 of 15 fields, validation 100 (capture attestation) |
| `/colorado/wellington/solar-permit-guide/` | `co-larimer-wellington-multi` | 15 of 15 fields, validation 100 |
| `/colorado/alamosa/solar-permit-guide/` | `co-alamosa-alamosa-multi` | 14 of 15 fields, validation 100 (capture attestation) |

- Audit results (pass / pass with edit, no fails): Durango 82/3, Federal Heights 116/6, Glenwood Springs 114/6, Frederick 119/10, Sheridan 129/9, Salida 108/9, Wellington 133/9, Alamosa 123/12. All edits are applied.
- Utility: Frederick names United Power and Sheridan names Xcel Energy on their own pages. The other six use the `-multi` id and ask the reader to confirm the utility for their address. Salida was drafted as `-xcel`; the auditor changed it to `-multi` because its only support is Xcel's 10/2015 communities list, which also lists Fort Collins, a city with its own utility.
- Salida's permit is issued by Chaffee County (electrical permit), not the City; the page says so. Salida's County fee form shows a $285.00 example that does not match its own valuation table; the page states both instead of choosing one.
- Not built, with reasons kept in the research folder: Craig (no solar fee), Delta and Sterling and Gunnison (fee schedule or city pages not readable or refused automated access), Avon, Vail and Rifle (no solar document list), Carbondale and Breckenridge (solar requirements not captured), Timnath (every Town page refused automated access), and the rest of the 36 candidates for similar reasons. Silverthorne, Johnstown and Steamboat Springs were drafted and are in audit.
- Measurement window: the eight ids are in `NEW_GUIDES_DURING_MEASUREMENT` and in the batch 4 set of `relatedPoolFor`. The full before/after build diff (live commit 581bcfb vs this branch) shows only the eight guide pages and their Permit Path records as added; changed pages are the Colorado state index, the guide directory, Permit Path, search, the sitemap and the release file. No existing guide changed and the 86-route paid manifest is byte-identical.
- After 2026-12-16, also clear the batch 4 set in `relatedPoolFor` and the batch 4 ids from `NEW_GUIDES_DURING_MEASUREMENT`.
