# READY quality audit CSV

Generated: 2026-10-12

Scope: 351 guides currently marked `READY`

Status effect: audit only; no guide status, route, canonical, sitemap entry, or indexation directive was changed

## Approved audit gate

- At most one missing core field.
- Every populated core field has confidence `>= 0.5`.
- A missing field is counted once and is not also treated as a low-confidence populated fact.
- Every populated core fact has at least one source ID.

Core fields: permit authority, utility, review time, permit fees, inspection steps, and required documents.

## Result

- `KEEP_INDEXED_MONITOR`: 209
- `COMPLETE_CORE_FACTS_PRIORITY`: 138
- `REVIEW_FOR_NOINDEX`: 4
- Total failing the audit gate: 142

The four `REVIEW_FOR_NOINDEX` rows are Honolulu, Lancaster, Palm Springs, and Providence. This is a recommendation for owner review only. No `noindex` was applied.

## Traffic evidence

The most recent authenticated final-state Search Console receipt covers 2026-09-11 through 2026-10-08. Its full 376-row private export was intentionally temporary and is no longer available. The CSV therefore uses only retained, dated derivatives:

- Exact metrics where the verified derivative retained them.
- Rank-only evidence where the derivative retained priority but not exact impressions.
- `UNKNOWN_FULL_PRIVATE_EXPORT_UNAVAILABLE` everywhere else.

Blank metrics mean unknown, not zero. Re-running `npm run ready-quality-audit -- --gsc-dir <private-saved-gsc-dir>` will join a complete authorized `current_page.json` without requiring the raw export to be committed.
