# Measurement export guide (owner steps)

Purpose: supply the three missing sources (GA4, outbound, partner report) to the Growth Command Center so that more funnel stages move from UNKNOWN to OBSERVED. Nothing here adds tracking, calls an API, or changes a money path. Every export stays outside the repository.

Status words: OBSERVED (a source was supplied), UNKNOWN (instrumented, no export supplied; never zero), NOT_MEASURED (no instrumentation can attribute it).

## What each source unlocks
| Source | Unlocks (stage) | Still missing without it |
|---|---|---|
| GSC export (already supplied) | SEARCH_VISIBILITY | - |
| GA4 landing page x source/medium report | ORGANIC_ENTRANCE, ENGAGEMENT, channel session split | all session stages UNKNOWN |
| GA4 events report (optional second report) | INTERNAL_NAVIGATION, CTA_ENGAGEMENT | those stages UNKNOWN per event |
| Outbound export (`scripts/outbound-export.mjs`) | OUTBOUND_RECORDED per paid page | recorded outbounds UNKNOWN |
| Partner report + outbound export (both) | PARTNER_REPORTED (referral, qualified, funded, commission stages) per page | partner stage UNKNOWN |

Even with all four, `revenue_by_acquisition_channel` stays NOT_MEASURED by design: outbound records carry page, partner, intent and CID but no source/medium, and a GA4 session shares no identifier with a CID. See `docs/proposals/CHANNEL_ATTRIBUTION_PROPOSAL.md` (a proposal only).

## Step 1: GA4 reports
Assumption (not confirmed against the GA4 UI by this repo): the report builder in the GA4 property can produce the two tables below and export them as CSV. Verify the property is the GridPermit one, and note its numeric property id.

Report 1, sessions (required). Dimensions: landing page (path only, not "plus query string") and session source / medium (one combined column, or session source and session medium as two columns). Metrics: sessions, and optionally engaged sessions. Date range: choose it once and reuse it for report 2 and the GSC window if possible.

Report 2, events (optional). Same dimensions plus event name; metric: event count. Filter event name to the GridPermit custom events you want (`internal_resource_clicked`, `permit_guide_clicked`, `cpl_cta_viewed`, `cpl_cta_exposed`, `cpl_cta_clicked`, and so on from `src/lib/analytics-events.ts`). Use the same date range and the same filters as report 1.

Do not add any other column (date, city, user, device, ids). The converter rejects unmapped columns.

Google's documented Data API names (checked on 2026-10-23, developers.google.com/analytics/devguides/reporting/data/v1/api-schema): dimensions `landingPage` (UI "Landing page"), `landingPagePlusQueryString`, `sessionSource`, `sessionMedium`, `sessionSourceMedium` (UI "Session source / medium"), `eventName` (UI "Event name"); metrics `sessions`, `engagedSessions` (UI "Engaged sessions"), `eventCount` (UI "Event count"). Not confirmed: the exact column headers a CSV downloaded from the GA4 UI will contain, whether the file starts with `#` metadata lines (the converter tolerates them and cross-checks "Start date" / "End date" if present, assumed to be `# Start date: YYYYMMDD`), and whether the property combines these dimensions with event-scoped counts without a compatibility error. If a report fails to build, change the dimensions rather than the converter.

## Step 2: mapping file
Create a JSON file outside the repo that binds your CSV's actual header names to the converter's fixed fields (headers below are the assumed UI names; edit them to match your file):
```json
{
  "sessions_report": { "landing_page": "Landing page", "source_medium": "Session source / medium", "sessions": "Sessions", "engaged_sessions": "Engaged sessions" },
  "events_report":   { "landing_page": "Landing page", "source_medium": "Session source / medium", "event_name": "Event name", "event_count": "Event count" }
}
```
Use `source` and `medium` instead of `source_medium` if the file has two columns. Omit `engaged_sessions` if the report does not have it (ENGAGEMENT then stays UNKNOWN). Omit `events_report` and `--events` if you have no events report.

## Step 3: convert
```
node --experimental-strip-types scripts/ga4-report-to-export.mjs \
  --sessions <sessions.csv> [--events <events.csv>] --mapping <mapping.json> \
  --property-id <numeric id> --start YYYY-MM-DD --end YYYY-MM-DD \
  --out <new file outside the repo, e.g. ~/Documents/gridpermit-intelligence/private/ga4-export.json>
```
Behaviour: refuses an `--out` inside the repo and refuses to overwrite a file; rejects unmapped or personal-looking columns, landing pages with query strings, non-integer or negative counts, engaged sessions above sessions, and conflicting duplicates (exact duplicates are dropped). `(not set)` landing pages are excluded and counted in the printed summary. Event names outside the closed analytics list (GA4 automatic events such as page_view) are dropped and named in the summary. `events_included` lists only events that appear in the events report: an event that never appears is UNKNOWN downstream, not zero. An event row with no matching sessions row aborts the conversion. Assumption: GA4 omits rows whose count is zero, so a page with no row for an included event is read as zero for that event.

## Step 4: outbound export (owner, needs the Netlify token already in the owner's control)
`node scripts/outbound-export.mjs --out <new file outside the repo>` (reads the private store `gridpermit-outbound-v1`; refuses to overwrite). Rows are recorded server-side redirects, not proven human clicks. The store keeps 37 days, so export regularly if you want a longer history.

## Step 5: partner report
The funnel reads rows `{stage, cid, partner_id, timestamp (UTC Z), evidence_ref, amount_cents, currency, payment_evidence_ref}` with stages from `REVENUE_STAGES` in `scripts/lib/live-revenue-ops.mjs`; commission stages need integer USD cents and PAID needs payment evidence. Gap, stated plainly: the partner-report adapter in `scripts/lib/commercial-reconciliation.mjs` (`normalized-v1`) uses different field names (`reported_at`, `channel`), and no tool in this repo is verified to convert one into the other, so the owner (or a later reviewed change) must produce these rows from the partner's own report. Do not guess stages: only what the partner reported. Add `--partner-report-complete` only if the report truly covers the whole window; otherwise a page with no rows stays UNKNOWN.

## Step 6: run the Command Center
```
node scripts/organic-engine-qa.mjs snapshot dist <head.json>        # after npm run build
node --experimental-strip-types scripts/build-growth-command-center.mjs \
  --gsc <private gsc export> --snapshot <head.json> --ga4 <ga4-export.json> \
  [--outbound <outbound-export.json>] [--partner-report <rows.json> [--partner-report-complete]] \
  --out <dir outside the repo>
```
Check `growth-funnel.json` -> `source_status` first: each source must read SUPPLIED. A paid page needs the route manifest (`netlify/generated/outbound-routes.json`, produced by `npm run build`); without it paid-route status is UNKNOWN.

## Reading the result
A recorded outbound is not a click, a click is not a lead, a lead is not a commission, a commission is not cash. GA4 CTA clicks and recorded outbounds are separate columns and are never converted into each other. Aggregates for GA4 reflect GA4's own sampling/thresholding and consent state, which this repo cannot see.
