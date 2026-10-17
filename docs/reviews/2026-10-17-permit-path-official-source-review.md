# Permit Path / official-source review — 2026-10-17

Related: #137 (decision-path safety), #138 (source-change verification).

## Boundaries

- Read-only comparison of five **high-relevance existing California records** on GitHub's then-current `main` to the official government/utility pages linked below.
- The earlier local `source-freshness-report.mjs --json` produced 344 READY rows and no `last_verified` older than its 180-day threshold. That is a **local file-date diagnostic only**, **not** proof that all 344 sources were rechecked, still accessible, or unchanged. The local worktree had modifications and is not the release baseline.
- The review below does **not** claim a full census, a formal regulatory audit, or verified individual project eligibility. No fee, timeline or power-limit guess was introduced. Browser/public source snapshots are as observed on Oct 17, 2026; web pages may change.

## Official-source field comparison

| Record | Official source revisited | Verified source claims | Stored record comparison | Result |
| --- | --- | --- | --- | --- |
| `ca-san-diego-chula-vista-sdge` | [Chula Vista — Residential Solar Energy Permits](https://www.chulavistaca.gov/departments/development-services/build-green/residential-solar-energy) | Expedited residential PV path uses SolarAPP+ and Citizen Access, with application ID + forms/plans; standard owner and contractor paths are separately listed; fee schedule is linked but no flat permit amount shown in page body | Matches `program_or_pathway`, required documents, and fee amount remains unknown | No verified contradiction in sampled fields. Fee schedule link can be surfaced as an enhancement rather than guessing a price |
| `ca-los-angeles-pasadena-pwp` | [PWP Solar Application Instructions](https://pwp.cityofpasadena.net/solar-application-instructions/) | Installer starts in PowerClerk; initial PWP approval comes **before** applying to City permit center; Fire/Building signoffs, then utility inspection, meter, PTO; PWP inspection described as 5–7 business days after signoffs | Matches dependency and utility-stage inspection note; City permit fee remains unknown | No verified contradiction in sampled fields |
| `ca-san-bernardino-san-bernardino-sce` | [San Bernardino — Apply for Residential Solar Permits](https://insidesb.sanbernardino.gov/1650/Apply-for-Residential-Solar-Permits) | Symbium for eligible SB379 applications, separate electrical permit for panel upgrades, processing may take approximately 1–3 business days for described applications | Matches pathway, exception and qualified timeline wording | No verified contradiction in sampled fields |
| `ca-los-angeles-torrance-sce` | [Torrance — PV Automated Permitting Requirements](https://www.torranceca.gov/Government/Departments-Offices/Departments-Offices/Community-Development/Building-and-Safety/Solar-Photovoltaic-Information/Torrance-PV-Automated-Permitting-Requirements) | Existing permitted R-3 rooftop installation, <38.4 kW AC; **no existing PV/ESS**; **no ground mounts or carports** for automated path; other projects may use standard review | These restrictions are already recorded in `eligibility_constraints.other_conditions`; old UI did **not** reliably flag ground mount/existing PV when selected | **Confirmed UI decision gap**: fixed only on isolated PR branch with regression tests. Do not claim all permits for ground mount are prohibited. The current official HTML references 2025 codes; older PDF versions should not be treated as current |
| `ca-los-angeles-lakewood-sce` | [Lakewood — Solar Permitting for Homes](https://www.lakewoodca.gov/Development-Services/Building/Solar-Permitting-for-Homes) | Licensed contractors can use SolarAPP+ for eligible rooftop solar/storage; ineligible projects follow a city checklist; separate SolarAPP+ processing fee exists but amount not specified on that page | Matches recorded pathway, license and fallback, with no numeric permit fee asserted | No verified contradiction in sampled fields |

## High-value defect and bounded resolution

- Existing `/permit-path/` offered separate scope checkboxes and project-type selections, but switching project types could leave **automatically checked flags from earlier selections** behind.
- The logic missed explicit Torrance exclusion clauses (“Ground-mounted systems ... not allowed” and “No existing PV or ESS ...”) and used generic `existing` keyword presence as if it confirmed existing-PV treatment.
- The checker displayed a generic “no SolarAPP+ pathway” for documented **Symbium** and Torrance automated alternatives.
- The isolated PR modifies only the `/permit-path/` page-level checker script and tests. All source links and underlying municipality records remain untouched, and project-stage/utility separation, homeowner and commercial gates are preserved.

## Follow-up evidence triggers — not automatic edits

1. If an official source changes, preserve URL, capture date, exact old/new statement, relevant record field, and whether an official authority has superseded the previous version.
2. A `404`, bot challenge, or unsigned secondary article is **not** enough to change local rules; mark BLOCKED/UNVERIFIABLE.
3. Revisit source priorities using **real demand / affected decision severity**, especially Torrance's automated-route exclusions, before updating all 344 records.
4. Keep `source-freshness-report.mjs` (local edit-age tracking) separate from `source-health-report.mjs` (URL reachability). Neither by itself detects substantive legal changes.

No external messages, partner clicks, synthetic leads, new APIs, or paid services were used.
