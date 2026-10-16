# Claude growth sprint 2026-10-16: changes

Scope: two existing CSP-active California guides that the 2026-10-11 review held for a later window. No new pages, no routing, partner, CID, Pomona or production change.

| Page | Before (live title) | After |
|---|---|---|
| /california/torrance/solar-permit-guide/ | Torrance, CA Solar Permit Guide \| GridPermit | Torrance Solar Permit Requirements & Automated Path \| GridPermit |
| /california/lakewood/solar-permit-guide/ | Lakewood, CA Solar Permit Guide \| GridPermit | Lakewood Solar Permit Requirements & SolarAPP+ \| GridPermit |

Descriptions and leads come from `src/lib/commercial-seo-profiles.ts`. One internal link was added from `/blog/solarapp-eligibility-2026/` to the Torrance guide (it had no editorial inbound link; Lakewood already had one).

## Source verification (Permit Truth Guardian, 2026-10-16)

- Torrance S7 (City "Torrance PV Automated Permitting Requirements"): live read confirms "System size is rated less than 38.4kW AC nameplate", "New PV System installed on an existing, permitted R-3 occupancy", and roof layout, line diagram and data sheets required. No timing or fee stated, so the copy claims neither.
- Lakewood S1 (City "Solar Permitting for Homes"): live read confirms "eligible to use the automated SolarAPP+ portal for instant permitting", ineligible systems "follow the guidelines in the Submittal Checklist", and the inspection request line. No dollar fees stated, so the copy claims none.
- Cypress S1: HTTP 403 to automated reads on 2026-10-16. Status UNKNOWN (not broken). Cypress was not changed.

## Gates (local, exact working tree)

- `npm test`: 909 tests, 905 pass, 0 fail, 4 skipped.
- `astro check`: 0 errors, 0 warnings, 16 hints.
- `npm run build`: 463 pages; outbound manifest 86 placements; release preservation ok (86 routes, 21 required cities, 3 functions).
- `netlify/generated/outbound-routes.json` SHA-256 `968cb752bf435f455884eadc7ec87a4ca09c0421a8356ce8d8565e477358c878` (unchanged).
- `npm run seo-check`: no hard defects.
- `partner-health` (local build, refreshed build health, no CID sent): 462 pages, 86 paid, 0 failures.
- `npm audit --omit=dev`: 0 vulnerabilities.
