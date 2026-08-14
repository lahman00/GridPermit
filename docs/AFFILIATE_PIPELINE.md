# Affiliate Program Pipeline

A structured tracker for affiliate/partner programs relevant to GridPermit's traffic (homeowners actively researching residential solar permitting). Written 2026-08-15. This is a planning document, not a claim of status — **never mark a program "submitted" or "approved" without direct evidence**, and this file must be updated the moment real status changes, not left to drift.

## Status definitions

| Status | Meaning |
|---|---|
| `researched` | Program identified and evaluated for fit; nothing submitted |
| `blocked_needs_owner` | Application requires an action only the site owner can take (account creation, tax/payment info, legal acceptance) |
| `applied` | Application genuinely submitted, evidence exists (confirmation email, dashboard record) |
| `pending_review` | Applied and network/advertiser is reviewing |
| `approved` | Network or advertiser has confirmed acceptance, with evidence |
| `rejected` | Network or advertiser has confirmed rejection, with evidence |
| `not_pursuing` | Evaluated and deliberately not pursued, with reason |

## Current pipeline

| Program | Network | Category | Country | Commission (as published) | Cookie | Status | Evidence | Best placement | Notes |
|---|---|---|---|---|---|---|---|---|---|
| EnergySage Solar Marketplace | CJ Affiliate (Commission Junction) | Solar marketplace / lead referral | US | $9.60 per verified lead (self-serve program terms, publicly listed) | 45 days | `blocked_needs_owner` | Verified landing page: `public.cj.com/signup/publisher?advertiserId=5835771`. Requires an active CJ publisher account — creating one requires business/tax/payment info only the owner can provide. See docs/MONETIZATION_STRATEGY.md. | `InstallerCTA.astro` on every locality guide page (already live as a plain, non-affiliate link — see below) | The plain (non-affiliate) EnergySage link is already live sitewide. This CJ program is the path to converting it into a real tracked/paid affiliate link. Owner action pending: determine whether a CJ publisher account already exists, then apply. |

## Researched, not yet actioned — candidates for the next application round

None of these have been applied to. Each is evaluated here for fit only; applying to any of them is future work requiring the owner's business/tax details, exactly like EnergySage above.

| Program | Network | Category | Fit for GridPermit | Notes |
|---|---|---|---|---|
| Battery storage brands (Tesla Powerwall, Enphase, Generac) | Unclear — no single formal consumer affiliate program was found published by any of the three during this session's research | Battery/storage hardware | Moderate — GridPermit's blog already covers battery ROI/payback content (California-only), but no direct manufacturer affiliate program could be confirmed as currently live and self-serve. | Do not pursue further without confirming a real, current program exists — do not assume one exists merely because comparison-shopping sites display battery products. |
| Home-improvement marketplaces on CJ (e.g. Lowe's) | CJ Affiliate | General home improvement / hardware retail | Low — not solar/permit-specific, and a permit-guide reader is not mid-purchase for general home-improvement retail goods. | Would require the same CJ publisher account as EnergySage — no incremental account-creation cost once that exists, but a genuinely weak topical fit. Not recommended as a next step. |
| HVAC/roofing/electrician lead-gen programs (via Impact, ShareASale, Refersion — cited in competitive research) | Multiple, unconfirmed specifics | Adjacent home-service trades | Low today, but directly relevant if GridPermit ever expands its content moat beyond solar into other permit categories (see docs/competitive-intelligence.md Section 5) — premature until that content exists. | Revisit only after (if ever) GridPermit publishes non-solar permit content; applying now would have no relevant placement to put the link on. |

## What this pipeline deliberately does not do

- Does not create, log into, or apply to any account on the owner's behalf — per this session's explicit instruction and the agent's standing operating rules around account creation and financial/tax information.
- Does not claim CJ/Payoneer verification status of any kind — that state is entirely outside this session's scope and was explicitly excluded from this work.
- Does not fabricate commission rates, cookie windows, or approval odds for any program where a current, specific figure could not be found.
