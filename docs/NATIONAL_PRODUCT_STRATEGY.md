# GridPermit National Product Strategy

Written 2026-08-15. This is the operational constraint for the GridPermit 2.0 build and every future session until it's deliberately revised. When a build decision is ambiguous, this document resolves it.

## What GridPermit is

A national U.S. information product that helps people navigate **residential solar (and directly related battery/storage) permitting** — what permit authority handles it, what documents and inspections are required, which utility governs interconnection, and where the official source for each fact lives. The core asset is 404 individually-researched, source-linked locality records covering all 50 states, with California as by far the deepest single area (324 of those 404 records, 288 of them published).

## What GridPermit is not

Not a general building-permit platform. Not an electrical, HVAC, roofing, plumbing, or general-construction permit resource. Not a contractor marketplace, a permit-filing tool, an AI assistant, or an accounts/SaaS product. These may become real future verticals — see `docs/FUTURE_EXPANSION.md` — but building any of them now would dilute a wedge GridPermit hasn't yet fully won.

## Primary user

A homeowner actively researching what solar permitting looks like for their specific city — usually early-to-mid in deciding whether to go solar, wanting to understand the real process (not marketing copy) before talking to an installer.

## Secondary user

A solar installer or permit specialist who needs to quickly confirm AHJ/utility requirements for a city they're about to work in, rather than re-researching it from scratch. (This is the `/pro` interest-validation audience — not yet a built product, see Phase 11 below.)

## Core user job

*"Tell me, for my city, who handles solar permitting, what I'll need, and where the real source is — and be honest if you don't have that yet."*

## Core data asset

`data/localities/*.json` — one verified record per city/utility pair, each fact tagged with a confidence score, a source link, and a last-verified date. Classified `READY` (published) or `LIMITED` (real but incomplete — never faked to look complete). This dataset, not any single page, is the actual product.

## Core search experience

Location-first. A visitor should be able to type a city, county, utility, or state name and land on the most specific real guide available — or an honest "we don't have that yet, here's the closest thing we do have" outcome. Search is the primary navigation method for a 50-state, uneven-depth dataset; browsing a rigid state→city tree is secondary.

## Core monetization path

Narrow, already defined in `docs/MONETIZATION_STRATEGY.md`: a plain, honestly-disclosed referral into EnergySage's installer marketplace (`InstallerCTA.astro`), placed after a reader has absorbed the real permit facts for their city — answer first, monetize second. `GridPermit Pro` (`/pro`) is a free interest-validation page only; no paid product exists yet. Neither CJ Affiliate account creation nor Payoneer verification is something this product build touches.

## Current coverage limitations (state honestly, not apologetically)

- **33 of 50 states** have at least one published (`READY`) locality guide.
- **17 states** (DE, IN, KS, LA, MA, ME, MI, MO, MS, MT, ND, NJ, OH, RI, SD, VT, WY) have research on file but no guide has yet cleared the bar to publish — real information exists, but it's incomplete by GridPermit's own standard.
- **California is the deep-coverage state**: 288 published guides vs. 1–3 in most other states. This is a strength to make visible, not something to hide behind a generic "national" veneer.
- No locality has ever had a fact invented to make coverage look more complete than it is. `LIMITED` is a legitimate, permanent outcome for a record until real verified information justifies publishing it — never a placeholder to be quietly upgraded without evidence.

## Future expansion gates

GridPermit expands beyond solar/battery, or into an entirely new product surface (accounts, APIs, paid tools), only when real evidence justifies it — not because an idea seems attractive mid-build. See `docs/FUTURE_EXPANSION.md` for the specific ideas parked and the evidence each one needs before reconsideration.

## How this document is used

Every phase of the GridPermit 2.0 build is checked against this file. If a proposed page, feature, or piece of copy doesn't map to "what GridPermit is" above, it doesn't ship in this phase — it goes to `docs/FUTURE_EXPANSION.md` instead.
