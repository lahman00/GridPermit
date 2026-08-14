# Permit Checklist — the overnight "hidden opportunity" MVP

Written 2026-08-15 as part of an overnight product audit. This documents the third-pass "find one hidden opportunity" exercise and the reasoning behind building this specific, small version of it rather than something larger.

## The opportunity

Every locality guide page already contains everything a real permit checklist needs: required documents, inspection steps, permit fees, timeline, eligibility constraints, official contacts — all source-linked and confidence-scored. But the only way to take that information away from the page was the existing "Print" button, which printed the entire article (narrative prose, FAQ, related articles, full source citations) rather than anything a homeowner or contractor could actually use as a task list at a permit office or a job site.

Notably, `src/pages/pro.astro` (the GridPermit Pro interest-validation page, shipped in the prior session) already names "a downloadable permit checklist per city" as a hypothesized *paid* feature. That's the right instinct, but it skipped past a smaller, free, already-buildable version of the same idea using data that already exists.

## What was built

A purpose-built print stylesheet on `LocalityGuideLayout.astro` — the shared template for all 328 locality pages — activated only in `@media print`:

- **Required Documents** renders as a checkbox list (☐ before each item).
- **Inspection Steps** renders as a numbered list.
- **Overview, FAQ, Related cities, and Related articles** — the narrative/discovery sections, not the actionable ones — are hidden from print so the output stays short enough to actually use.
- **Permit fees, rebates, utility/interconnection details, eligibility constraints, and official contacts** all still print — the facts, not just the two checklist-shaped sections.
- A print-only masthead identifies the source URL, the last-verified date, and the applicable permit authority/utility, plus a reminder to verify current requirements before relying on the printout — reinforcing the same trust rule that governs the rest of the site rather than letting a printed page float free of its provenance.
- External source links get their URL appended in parentheses when printed, since a printed page can't be clicked.
- The "Print" button was relabeled "Print Checklist" to set the right expectation.

## Why this scope, not a bigger one

This session's audit brief explicitly asked for one hidden opportunity to be researched and, if the confidence/safety bar is met, built as an MVP — otherwise documented as a proposal rather than built. Three sizes were considered:

1. **What was built tonight**: a print-stylesheet enhancement to the existing template. Zero new data, zero new pages/routes, zero new build-time cost, fully reversible (it's CSS + a masthead block), and directly testable by comparing before/after build output. This clears the "safe, reversible, evidence-based, testable" bar cleanly.
2. **A dedicated `/checklist` page per locality** (a second Astro route per city, ~328 additional generated pages): more polished (e.g. could omit the print-media constraint entirely, be styled for screen too, become a real downloadable artifact independent of the browser's print-to-PDF), but meaningfully larger in surface area to test and maintain, and duplicative of content already on the main page. **Not built tonight** — worth doing once there's a real signal (e.g. from GridPermit Pro's interest-page clicks) that checklist-format demand is real, rather than building it speculatively.
3. **A true downloadable PDF/export artifact** (server-generated, not just browser print-to-PDF): explicitly what GridPermit Pro's own copy hypothesizes as a *paid* feature. Building this for free tonight would undercut the very signal Pro's interest page is trying to measure. **Deliberately not built** — this is the right feature to keep behind the Pro validation, not give away for free the same night the Pro page shipped.

## How to verify it

Open any locality guide page (e.g. `/texas/austin/solar-permit-guide/`) and use the browser's print preview (Cmd/Ctrl+P) or "Print Checklist" button. The narrative sections disappear, Required Documents shows checkboxes, Inspection Steps is numbered, and the masthead identifies the source and verification date.
