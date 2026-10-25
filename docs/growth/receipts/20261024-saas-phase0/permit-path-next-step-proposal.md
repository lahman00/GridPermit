# Permit Path: one monetized next step (proposal only, nothing edited)

## What `/permit-path/` does today
A client-side checker that shows a record's permit authority, utility, pathway and sources. It ends with a "Still ambiguous?" box that links to `/project-help/` (send the jurisdiction, utility, scope and the exact delay). It has no partner CTA and fires no commercial event.

## Proposed next step
After the result for a jurisdiction, add at most one action chosen by the existing routing, not a new one:
1. If the selected record is a California city on the paid CompareSolarPrices list, with a verified single utility, reuse `CompareSolarPricesCTA.astro` unchanged (its `cpl_cta_viewed`, `cpl_cta_exposed` and `cpl_cta_clicked` events and the CID redirect stay as they are).
2. Otherwise show the existing "Still ambiguous?" help link, and for installers a link to `/pro/` that fires the existing `pro_interest_clicked` event.
3. Never show a generic quote link when no eligible partner exists.

## Why not more
Only 85 of 351 guide pages are eligible for the paid route today, so most visitors would see option 2. The checker's result also depends on client-side JavaScript, so the paid CTA must be rendered only after a record is selected and must reuse the same eligibility function as the guides.

## Risks and approvals
It touches a monetization surface and a page with search traffic. Needs the owner's approval before any edit; implement on a branch with a preview, and re-run the partner-health, release-preservation and analytics tests. Measure only clicks (UNKNOWN for leads and commission until partner reports exist).
