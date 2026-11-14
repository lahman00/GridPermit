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
