# Growth Command Center and Revenue and Authority Engine 3.0

Status: first slice, local branch, pending owner approval. Nothing here is pushed, merged or deployed.
Baseline: production `52c6fd1` (Organic Growth Engine 2.0 merged), 86 approved paid routes, outbound manifest SHA `968cb752…`.

## What already existed (reused, not rebuilt)
- Commercial lifecycle ledger and reconciliation: `scripts/lib/live-revenue-ops.mjs`, `commercial-reconciliation.mjs`, `partner-measurement.mjs`, `outbound-export.mjs` (CID, append-only stages, money only from partner evidence).
- GSC CSV ingest and money-query classifier: `scripts/gsc-ingest.mjs`, `scripts/lib/money-query-classifier.mjs`; first-revenue opportunities over saved GSC artifacts.
- Autopilot status reports, partner health, release preservation, source freshness (age only), indexation ledger.
- Organic Growth Engine 2.0: registry-driven PTO links, the `internal_resource_clicked` event, the distribution queue and the organic report.

## What this adds
| Piece | File | Purpose |
|---|---|---|
| Search Opportunity Engine | `scripts/lib/search-opportunities.mjs` | Reads the authenticated GSC API export. Compares a page with this site's own pooled CTR at the same position bucket (exact binomial probability), clusters query templates across cities, flags service-intent mismatches as hypotheses, finds guides with search demand and few internal links, and never recommends a locked page. |
| Funnel by page, topic, channel | `scripts/lib/growth-funnel.mjs` | Joins GSC, a GA4 landing-page export, the private outbound export and a partner report. Every stage is OBSERVED, UNKNOWN or NOT_MEASURED. |
| Freshness and regulatory queue | `scripts/lib/freshness-queue.mjs` | Read-only. Ranks records for manual re-check by real demand. Dated reviews (`data/freshness/reviews.json`) can clear a fee-date flag for 90 days, only if the evidence host is one of the record's own source hosts and the reviewed field is unchanged (content fingerprint); agent reviews stay listed as awaiting owner acknowledgement; a review that found a change escalates. Nothing edits a record. |
| Distribution controls | `scripts/lib/distribution-controls.mjs`, `data/distribution/publishing-gate.json` | Fully disabled gate, validated publication and reply ledgers, reply suggestions only for discussions that were actually read, duplicate checks against recorded replies, and a rolling 7-day per-channel cap that counts recorded replies. A reply is engagement and carries the engagement gate. |
| Balanced related cities | `src/lib/related-balance.ts` | Same relevance classes, least-linked-first tie-break, only for counties listed in the registry. |
| QA | `scripts/organic-engine-qa.mjs compare-balanced` | Baseline-vs-candidate policy for the balanced change. |
| Report | `scripts/build-growth-command-center.mjs` | One Hebrew report plus JSON, written outside the repo. |

## Baseline evidence
Private Search Console numbers are deliberately not recorded in this repository (they live in the private report written outside it, and in the owner's command center). What is safe to state here comes from the public build:
- Link graph (build of production `52c6fd1`): locality-to-locality inbound links correlate with alphabetical rank at -0.6 to -0.9 in every county of nine or more cities, and 181 of 351 guides receive no link from any sibling guide. In Los Angeles County, 38 of 45 guides receive none.
- The Search Opportunity Engine's method: a page is compared with this site's own pooled CTR at the same position bucket using an exact binomial probability. With 28-day volumes this small, most zero-click pages are within noise and the report says so rather than flagging them.
- A recurring "solar permit services {city}" query template across several guides is reported as a service-intent hypothesis, not a finding.

## Balanced related cities (first rollout: Santa Clara County)
`buildRelatedLocalities` keeps the first six candidates after ranking by relation and then city name, which is a fixed alphabetical cut. The balanced selector keeps the ranking classes and the limit of six and changes only the tie-break inside a class. Result in Santa Clara County (13 guides, built and compared against the production baseline): the five unlocked guides that received no sibling link now receive 6 each, the other unlocked guides sit at 5 to 7, and the two locked guides (Mountain View at 0, Los Gatos at 12) keep exactly the donors they had. Across the site, guides with no sibling link go from 181 to 176.
Scope: `data/content-links/registry.json` → `balanced_related` (explicit page list, cap, control pages). Pages inside an experiment or observation window (Mountain View and Los Gatos, the PTO link pilot) keep their existing list, and the links that point to them stay exactly as they were: the balance is computed only among the unlocked pages. Every other county is byte-identical.

Pre-registered measurement (decide before looking at "after"):
- Slice: the 13 Santa Clara County guides. Control: 12 unlocked Riverside County guides (registry `control_pages`).
- Data: two authenticated final GSC exports with equal 28-day windows, "before" ending before the deploy date and "after" starting on or after it.
- Command: `node scripts/build-organic-report.mjs --base <base.json> --head <head.json> --slice balanced_related --gsc-before <f> --gsc-after <f> --change-date <deploy date> --out <dir outside repo>`.
- At least 100 impressions per group per window or the verdict is INSUFFICIENT_DATA. A comparable result is still not causal.

## Run
```
npm run build
node scripts/organic-engine-qa.mjs snapshot dist <head.json>          # and on the base commit's dist -> <base.json>
node scripts/organic-engine-qa.mjs compare-balanced <base.json> <head.json>
node --experimental-strip-types scripts/build-growth-command-center.mjs --gsc <private gsc export> --snapshot <head.json> --out <dir outside the repo> [--ga4 f] [--outbound f] [--partner-report f [--partner-report-complete]] [--now <ISO>]
```
The command center refuses an `--out` that resolves inside the repository (symlinks followed): its outputs contain private search and revenue metrics. `build-organic-report.mjs` applies the same guard whenever it is given private exports. Without `--partner-report-complete`, a paid page with no partner rows is UNKNOWN, not zero.

### Input contracts
- GSC: authenticated Search Analytics API JSON with `evidence_type: authenticated_google_search_analytics_api`, `data_state: final`, `search_type: web`, page / query_page / country_page rows. Anything else is rejected.
- GA4 (not yet supplied): `{evidence_type: "ga4_report_export", property_id, window_start, window_end, events_included: [names from the closed analytics list], rows: [{landing_page, source, medium, sessions, engaged_sessions?, events?}]}`. An event not in `events_included` is UNKNOWN, never zero. Recommended report: landing page x session source/medium with `internal_resource_clicked`, `permit_guide_clicked`, `cpl_cta_viewed`, `cpl_cta_exposed`, `cpl_cta_clicked`.
- Outbound export: the existing private operator export. Partner rows: the existing normalized contract (`REVENUE_STAGES`).

## Stage vocabulary
OBSERVED (a source was supplied), UNKNOWN (instrumented, no export supplied), NOT_MEASURED (no instrumentation can attribute it), NOT_APPLICABLE. A recorded outbound is not a human click; a click is not a lead; a lead is not a commission; a commission is not cash.

## Known blockers (precise)
1. GA4, outbound and partner exports have not been supplied, so entrances, engagement, internal navigation, CTA engagement, recorded outbounds and partner results are UNKNOWN. Nothing was estimated.
2. Revenue by acquisition channel is NOT_MEASURED: outbound events carry page, partner, intent and CID but no source or medium, and a GA4 session shares no identifier with a CID. Closing this needs new instrumentation on a protected money path and the owner's approval.
3. No LinkedIn or X discussion could be read without a signed-in session, so no reply is suggested and `discussions.json` is empty.
4. Publishing and engagement stay disabled until the owner verifies account identity, access and permission in the live account.
5. Only one export window with query text exists, and query rows are privacy-thresholded; a trend cannot be inferred.

## Rollback
Everything is additive except the balanced related list. To turn it off, delete the `balanced_related` block from the registry (the layout then returns the existing function's output and its tests skip), or revert the PR. All other pieces are offline scripts and data files.
