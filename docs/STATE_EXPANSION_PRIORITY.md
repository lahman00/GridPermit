# State Expansion Priority Map

Ranks the 46 U.S. states not yet covered by GridPermit (CA, RI, DE, VT already have at least one record) by expected ease of reaching genuine, honestly-sourced READY coverage. See `data/state-expansion-priority.json` for the full structured scoring — this file is the narrative summary.

No locality-level research was performed for any of these 46 states. This is a prioritization map only.

## Sourcing note

Two tiers of fact are mixed here, and each state entry in the JSON labels which applies:

1. **Directly sourced this session**: DSIRE's "Solar/Wind Permitting Standards" program list (programs.dsireusa.org, 57 entries reviewed), and the SolarAPP+ Foundation's own jurisdiction table (gosolarapp.org). This surfaced a standout finding: **Colorado's Department of Regulatory Agencies (DORA) issues a single statewide electrical permit for residential solar**, confirmed directly on `dpo.colorado.gov` and covering 200+ Colorado jurisdictions per SolarAPP+'s own announcement.
2. **General structural/civics knowledge, not re-verified this session**: county/municipality counts and which utility commonly dominates a state. These are treated as low-risk public-record facts, not case-by-case regulatory claims, but were not individually re-confirmed against a primary source for every state the way the DSIRE/SolarAPP+ facts were.

## Top 10 easiest states

| Rank | State | Score | Why |
|---|---|---|---|
| 1 | Colorado | 96 | DORA issues one statewide electrical permit covering 200+ CO jurisdictions — the single biggest reusable fact found this session |
| 2 | Arizona | 88 | Confirmed statewide solar-permitting standard (DSIRE) + only 15 counties/~91 municipalities + 3 dominant utilities |
| 3 | Hawaii | 85 | Only 4 counties, zero municipal layer at all — the lowest possible AHJ count of any state (small ceiling, near-instant full coverage) |
| 4 | Oregon | 82 | Confirmed statewide solar-permitting law (DSIRE) + a corroborating Portland streamlined-permit policy + 2 dominant utilities |
| 5 | New Mexico | 80 | Confirmed statewide solar-permitting standard (DSIRE) + PNM utility dominance |
| 6 | Nevada | 78 | No confirmed statewide law, but only 17 counties/~19 cities and a near-monopoly utility (NV Energy) |
| 7 | Illinois | 74 | Confirmed statewide law, offset by ~1,300 municipalities |
| 8 | New Jersey | 72 | Confirmed statewide law, offset by ~565 municipalities and the strongest home-rule tradition in the country |
| 9 | Utah | 68 | No confirmed statewide law; driven by Rocky Mountain Power's dominance |
| 10 | Maryland | 66 | County-centric local government (23 counties + Baltimore City) keeps the AHJ count low for the region |

## Chosen top 5 for tonight's marathon

**Colorado, Arizona, Hawaii, Oregon, New Mexico** — the 5 highest-scoring states, each backed by a directly-sourced structural finding (a confirmed statewide rule/portal, or an unusually low AHJ count), not just favorable general assumptions.

## Method

For each state: permitting model (centralized/county/municipal/mixed), approximate meaningful AHJ count, presence of a statewide solar-specific permitting rule, presence of a statewide permit portal, utility concentration, expected utility-data accessibility, expected municipal-code coverage strength, likely need for city-by-city research, and known source-access blockers. See `data/state-expansion-priority.json` for the full per-state breakdown, including the next-tier states considered but not chosen (WA, VA, MA, NC, CT) and a lower-confidence rough score for the remaining 31 states.
