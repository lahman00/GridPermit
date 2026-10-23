# PROPOSAL ONLY: first-party acquisition channel on outbound records

Status: NOT IMPLEMENTED. No code, data, route manifest, tracking file or partner link was changed for this document. It needs explicit owner approval before any implementation starts (section 6).
Date: 2026-10-23. Baseline: production `52c6fd1`, outbound manifest SHA-256 `968cb752bf435f455884eadc7ec87a4ca09c0421a8356ce8d8565e477358c878`.

## 1. Problem
`revenue_by_acquisition_channel` is NOT_MEASURED. An outbound record (`netlify/functions/outbound.mjs` -> `src/lib/commercial/outbound-service.mjs`) holds stage, cid, partner_id, page_path, city, intent, cta_id and timestamp, with no source or medium. GA4 sessions share no identifier with a CID. So a partner-confirmed commission can be placed on a page (through the CID) but never on the channel (organic search, LinkedIn, X, direct) that brought the visitor. The owner cannot tell which distribution channel produces money, only which pages do.

## 2. Proposed design (smallest version)
Add one optional closed-enum field, `acq`, to the outbound event with the values the funnel already uses: `organic_search`, `linkedin_organic_social`, `x_organic_social`, `direct`, `other`, plus `unknown` when the browser cannot tell.
1. Classification happens in the browser on landing from `document.referrer` and UTM parameters we ourselves put on distribution links, and is held in memory/session scope for that tab only. It is never a free-text source, never a URL, never a user or device identifier.
2. The CTA passes the single enum value to `/go/:partner` as a short parameter. The server validates it against the closed list (anything else becomes `unknown`), stores it in the event, and does NOT forward it to the partner destination.
3. `aggregateOutbound` and `scripts/outbound-export.mjs` accept events with or without `acq` (versioned contract); the funnel then joins commission to `acq` through the CID and reports revenue by channel with an explicit coverage figure (events with `acq: unknown` or missing are shown, never dropped).
Reference for reading it: the channel logic is `channelFor` in `scripts/lib/growth-funnel.mjs`; the proposal reuses it so GA4 and first-party channel names align.

## 3. What this still cannot do
- Organic Google traffic has a referrer of google.com at best: organic vs paid search cannot be separated without UTM/gclid handling, which this proposal does not add.
- Many social apps strip referrers; those visits fall into `direct` or `unknown`. The share of `unknown` must be reported next to any revenue-by-channel number.
- Channel numbers will not reconcile exactly with GA4 (different definition and consent behaviour). Both are shown, neither overrides the other.
- Revenue is still only what partners report. A channel share built from a handful of commissions is anecdote; the report must print counts, not just shares.

## 4. Risks to the protected money path
| Risk | Why it matters | Mitigation |
|---|---|---|
| CTA link change breaks a partner redirect or CID | CTAs and `/go/` are the revenue path; commission is matched by CID | Change only by appending a validated optional parameter; CID generation untouched; run `tests/outbound-telemetry.test.mjs` and `release-preservation` unchanged and add cases for missing/invalid `acq` |
| Event contract is exact-field (`validateClick` requires exactly the 8 fields; `MAX_EVENT_BYTES` 512; idempotency compares fixed fields) | A new field could make existing exports fail or make duplicate detection wrong | Versioned event schema, `acq` excluded from `sameClick`, fail-open to `unknown`, size check re-run |
| Extra data sent to partners | Partner terms may restrict extra parameters | `acq` stays server-side; destination URLs byte-identical |
| Privacy | A referrer or UTM can carry personal data | Only a closed enum leaves the browser; free text never stored; privacy policy review before launch |
| Route manifest drift | The approved manifest SHA is a release gate | The manifest is not edited; verify the SHA is still `968cb752...` after the change |
| Stored-data mix | Old events have no `acq` | Report coverage; never back-fill from GA4 |

## 5. Rollback
Ship behind a build-time flag that is OFF by default. Roll back by (a) turning the flag off (the CTA stops appending the parameter; the server already tolerates its absence), then (b) reverting the PR. Events already stored with `acq` stay valid under the versioned reader; no deletion is needed. Success check before enabling for everyone: on a preview, 100 percent of test CTA clicks still reach the same partner destination with the same CID and no extra parameter, and event size stays under 512 bytes.

## 6. Owner approvals required before any implementation
1. Permission to modify the protected money path files (CTA components, `netlify/functions/outbound.mjs`, `outbound-service.mjs`, `analytics-events.ts`/Analytics component if used) in a separate reviewed PR.
2. Approval of the closed channel list and the decision to store `acq` in the private outbound store (retention stays 37 days).
3. Confirmation that no partner agreement is affected (parameter is not forwarded) and that the privacy policy covers a coarse first-party channel label.
4. Approval of the test plan (existing outbound/release tests unchanged, new `acq` tests) and of the preview verification before merge.
5. Separate approval to merge and deploy; deployment must follow the production release-integrity checks in `CLAUDE.md` (live release JSON and deployment verified first).

## 7. Interim value without any code change
Page-level revenue already works (CID -> page). For channel questions use GA4 sessions by channel per landing page next to page-level partner results, and keep tagging owner-run distribution links with UTM parameters, clearly labelled as GA4-only evidence.
