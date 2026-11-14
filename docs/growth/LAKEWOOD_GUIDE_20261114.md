# Lakewood guide and Colorado program eligibility, 2026-11-14

Scope: publish `/colorado/lakewood/solar-permit-guide/` and display the existing program eligibility conditions on the Aurora and Fort Collins guides. Link the existing $9 Solar Project Organizer. No pricing, checkout, attribution, partner-route or measurement-cohort changes.

## Source decisions

- The City's [2023 solar handout](https://www.lakewoodco.gov/files/assets/public/v/4/public-works/pdfs/engineering/2023-solar-panel-installations.pdf) supersedes the older research copy for this guide. It requires a Colorado professional engineer's roof analysis and installation calculations. A framing inspection is conditional on roof strengthening; an immediate review is not promised.
- The [current permit page](https://www.lakewoodco.gov/Local-Government/Departments/Public-Works/Building-and-Construction-Permits) links eTRAKiT, the homeowner instructions and the January 2021 general fee schedule. That schedule does not establish a verified total solar-permit fee. The public record deliberately leaves the fee amount and review time unknown.
- The solar handout refers to the 2020 NEC, while [Ordinance O-2024-20](https://www.lakewoodco.gov/Local-Government/Departments/City-Clerks-Office/City-Council-Ordinances-Resolutions/2024-Ordinances/O-2024-20) adopts the 2023 NEC. The guide discloses this conflict and directs readers to confirm current editions and amendments; it does not declare a complete current code stack.
- Homeowner eligibility is qualified by occupancy, property type and ownership entity. Storage, panel upgrades and removal/reinstallation require project-specific confirmation.
- Lakewood lists Xcel as a service provider. Readers must verify their own electric account and permit jurisdiction; a city name is not proof of utility territory.
- Xcel net-metering, Solar*Rewards, Battery Connect and interconnection pages were read in a browser because automated requests can return a JavaScript shell. Program eligibility and funding are conditional, not approval guarantees.
- Fort Collins' [contractor resources](https://www.fortcollins.gov/Services/Utilities/Programs-and-Rebates/Energy-Programs/Residential-Solar-and-Battery-Storage/Solar-Contractor-Resources) count existing generation and Community Solar toward system-size limits and allow justified requests to exceed them. The guide now says so.

The automated record validator reports six Lakewood source URLs as blocked (HTTP 403). The official material was opened separately with browser/web tools. This is a documented automated-access limitation, not a claim that all source-link checks passed.

## Measurement isolation

The existing measurement window closes on 2026-12-16. Lakewood joins the existing new-guide exclusion set, so it cannot enter the related-guide lists of pages under measurement. The eligibility renderer has a separate, permanent three-record opt-in; the conditions will remain visible when the measurement window ends. No cohort, baseline, title experiment, event or attribution definition changes.

Acceptance requires comparison against the production-base build: all 351 older guide files remain unchanged, with only Aurora and Fort Collins eligible for the approved corrections. The outbound manifest must retain its 86 routes and original SHA-256. Discovery pages and sitemap may include the new guide.

## Verification and rollback

Run focused and full tests, Astro check/build, SEO, partner health and release-preservation checks. Inspect the actual rendered eligibility and organizer links, then check the approved PR head, CI, preview and production deployment. HTTP availability does not establish Google indexing or traffic growth.

Production rollback target recorded before this release: Netlify deploy `6af8099e32f86674c128e2b0`, commit `63c9ad538d302118def2980805a7468da22b95a1`. Reconfirm that no intervening release has replaced the baseline before merging. The final deployment receipt belongs in the existing command center.
