# Commercial SEO & conversion changes

## Scope

Five existing California locality pages only. No URL, canonical, page count, route, partner, qualification, CID, redirect, disclosure, or destination changed.

## Shared before state

- Title: `{City}, CA Solar Permit Guide | GridPermit`
- Description: `{City}, CA solar permit guide: official permit portal, fees, and requirements — sourced and confidence-scored. Verified {date}.`
- Hero lead: `Your local requirements. The official sources. A clearer next step.`

The generic description stated “fees” even where the locality record had no verified fee value. It also omitted the strongest verified local distinction on each page.

## After state

| Page | New title | New evidence-led angle |
|---|---|---|
| Chula Vista | `Chula Vista Solar Permit Requirements & SolarAPP+ | GridPermit` | SolarAPP+ vs standard path; City permit vs SDG&E interconnection |
| Pomona | `Pomona Solar Permit Requirements & SolarAPP+ | GridPermit` | SolarAPP+ + Energov; 38.4 kW AC eligibility; SCE PTO |
| Menifee | `Menifee Solar Permit Requirements & Review Time | GridPermit` | Permit Portal; up-to-14-business-day City target; SCE PTO |
| Chino Hills | `Chino Hills Solar Permit Fees & Requirements | GridPermit` | SolarAPP+ or plan check; separate fire approval; sourced City fees |
| Fullerton | `Fullerton Solar Permit Timeline & SolarAPP+ | GridPermit` | SolarAPP+ + EasyDev; review timing; one-inspection rule; SCE PTO |

## Files

- `src/lib/commercial-seo-profiles.ts`: bounded profile registry containing the five reviewed title, description, and hero-lead overrides.
- `src/layouts/LocalityGuideLayout.astro`: applies a profile when the current record is one of the five; every other page keeps the existing default.
- `tests/commercial-seo-profiles.test.mjs`: locks the five-page boundary, active-route eligibility, snippet lengths, uniqueness, source-bounded fee language, and absence of guarantee/savings claims.
- `output/commercial-seo-cro-2026-10-09/`: evidence receipts, source audit, visual/accessibility receipt, health reports, and final verification.

## Commercial behavior

The generated outbound manifest remains 86 routes with SHA-256 `968cb752bf435f455884eadc7ec87a4ca09c0421a8356ce8d8565e477358c878`, byte-identical to the production baseline.
