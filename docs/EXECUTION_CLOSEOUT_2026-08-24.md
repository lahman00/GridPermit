# GridPermit Execution Closeout — 2026-08-24

Scope: close or advance backlog items 2, 3, 4, 5, 6, 7, 9, 10 and 11 without touching SEO metadata, sitemap, canonicals, robots, locality content, or production monetization links.

## Status summary

### 2 — Awin publisher account
**BLOCKED ON OWNER ACCOUNT CREATION.** Awin's current official FAQ says publisher signup is free to start, requires an application with website/promotional-method details, and is then reviewed by compliance. The previous assumption that a small refundable deposit is necessarily required should not be treated as current fact without seeing it in the live signup flow. GridPermit already has an Awin application kit in `docs/AWIN_CLUSTER_APPLICATION_KIT.md`.

Owner-only fields/steps likely include credentials, legal/account identity, payment/tax information, and any compliance confirmation that appears in the live flow. No account was fabricated or created by an agent.

### 3 — Partner reply handling
**CLEAR AS OF THIS PASS.** Gmail was checked for replies mentioning GridPermit/mygridpermit.com. No new actionable partner reply was present beyond the already-handled FlexOffers response. That FlexOffers reply was labeled `Grid Permit` for pipeline hygiene.

Operational rule: any positive reply is handled immediately; no paid term, financial commitment, legal acceptance, tax/payment change, or binding agreement is accepted without owner review.

### 4 — First CPL / solar-lead partner
**NOT YET EXTERNALLY CLOSED; shortest paths ranked:**
1. EnergySage via CJ — strongest fit, blocked by CJ account activation.
2. EnergySage direct partner program — public partner registration flow exists and supports organization website, geographic reach, audience size, contact details, and a branded landing page/dashboard. This is a legitimate alternate relationship path but requires interactive form submission and truthful organization/contact data.
3. MatchBurst via Awin — waits on Awin publisher account.
4. Profitise — contacted; awaiting substantive terms/response.

No false claim of approval is recorded.

### 5 — First approved tracking link
**BLOCKED BY EXTERNAL APPROVAL.** No partner currently satisfies both `APPROVED` and `TRACKING_LINK_RECEIVED`. Production must remain unchanged until a real tracked URL/number is issued and compensation/traffic rules are known.

Activation gate before code change:
- approval confirmed;
- exact destination/tracking URL or phone number received;
- compensation model confirmed;
- traffic-source restrictions confirmed;
- geography/qualification rules confirmed;
- disclosure requirement known.

## 6 — Revenue placement map

GridPermit should monetize by page intent rather than by global link injection.

| Page/surface | Primary user intent | Preferred monetization | Secondary | Do not do |
|---|---|---|---|---|
| City/locality solar permit guides | Homeowner trying to execute a solar project | Solar quote / CPL marketplace | Qualified inbound call if later approved | Generic unrelated hardware ads |
| Battery/storage permit sections or battery-specific editorial pages | Storage research + project execution | Battery hardware affiliate | Solar/storage quote lead | Roofing/HVAC offers |
| High-intent "what do I need / how do I apply / cost / inspection" locality sections | Immediate project action | Installer/CPL CTA | Pay-per-call test on a contained subset | Multiple competing CTAs above the fold |
| Broad educational blog content | Research | Contextual hardware affiliate where product is genuinely relevant | Soft marketplace CTA | Aggressive lead capture |
| Homepage | Navigation + brand trust | One primary marketplace/installer CTA after approval | None or one secondary education CTA | Monetization clutter |
| About / Contact / legal / trust pages | Trust and support | None | None | Affiliate placement |

Placement principle: one dominant commercial action per page intent. Preserve editorial independence and never imply an installer/brand is endorsed by a permitting authority.

## 7 — Revenue scenario model

These are scenario assumptions, not forecasts. Current traffic is too low and GA4 access is not available in this execution environment, so conversion rates are deliberately modeled rather than claimed.

### Known/externally grounded rate anchors
- EnergySage CJ terms previously observed in the authenticated program view: $10 per approved lead.
- Digital Master Media currently publishes solar pay-per-call up to $53 per qualified call.
- Hardware affiliate economics vary by merchant; use $50 net commission per sale only as a scenario placeholder (e.g. 5% of a $1,000 order), not a verified portfolio average.

### Base portfolio model
Assumed traffic mix: 60% CPL-eligible locality traffic, 20% pay-per-call-eligible high-intent traffic, 20% hardware-relevant traffic.

Base conversion assumptions:
- CPL: 1.0% of eligible visits become approved leads at $10.
- Qualified calls: 0.25% of eligible visits become payable calls at $53.
- Hardware: 0.5% of eligible visits become sales at $50 commission.

Result per 1,000 total visits:
- CPL: 600 × 1.0% × $10 = $60.00
- Calls: 200 × 0.25% × $53 = $26.50
- Hardware: 200 × 0.5% × $50 = $50.00
- **Base modeled revenue per 1,000 visits: $136.50**

| Monthly visits | Base modeled revenue |
|---:|---:|
| 1,000 | $136.50 |
| 5,000 | $682.50 |
| 10,000 | $1,365 |
| 50,000 | $6,825 |

### Conservative scenario
Assumptions: CPL 0.5%, calls 0.10%, hardware 0.20%.
Revenue per 1,000 visits = $30 + $10.60 + $20 = **$60.60**.

| Monthly visits | Conservative modeled revenue |
|---:|---:|
| 1,000 | $60.60 |
| 5,000 | $303 |
| 10,000 | $606 |
| 50,000 | $3,030 |

### Upside scenario
Assumptions: CPL 2.0%, calls 0.50%, hardware 1.0%.
Revenue per 1,000 visits = $120 + $53 + $100 = **$273**.

| Monthly visits | Upside modeled revenue |
|---:|---:|
| 1,000 | $273 |
| 5,000 | $1,365 |
| 10,000 | $2,730 |
| 50,000 | $13,650 |

Interpretation: the largest economic lever is not adding more merchants; it is increasing qualified homeowner traffic and routing each page to the highest-value mechanism appropriate to its intent.

## 9 — Commercial-intent audit

GridPermit's repository confirms the core architecture is locality-heavy and already has an `InstallerCTA.astro` component. Commercial intent is therefore highest where a visitor has moved from information-seeking to project execution.

Priority bands for future monetization tests:

**Tier A — highest intent**
- locality pages with permit cost, submission, inspection, interconnection, battery-permit or contractor-selection intent;
- states/cities with high solar adoption and expensive projects, once actual page-level traffic confirms demand;
- pages where users are likely homeowners rather than industry researchers.

**Tier B — medium intent**
- general city solar-permit guides;
- battery-storage explainers tied to a real residential project;
- blog posts comparing project options/costs.

**Tier C — low intent / no monetization priority**
- About, Contact, methodology, policy and trust pages;
- broad informational posts with no purchase/installer action.

No page-ranking claim is made without current page-level GA4/GSC data. The next data-driven refinement should sort actual landing pages by impressions/clicks/engagement and overlay the above intent tiers.

## 10 — Installer / installation-referral research

### EnergySage direct partner program — KEEP / HIGH PRIORITY
EnergySage publicly offers organization partner programs with a custom landing page and dashboard, and supports residential solar and storage among other electrification products. This fits GridPermit's homeowner education model better than a single-installer referral because the marketplace presents multiple installer quotes.

### Palmetto referral program — REJECT FOR GRIDPERMIT PUBLISHER USE
Palmetto's public referral program is positioned as a personal referral program using a Palmetto account/personal referral link and encourages sharing with friends, family, neighbors and colleagues. This is not evidence of a commercial content-publisher affiliate agreement, so it should not be deployed on GridPermit without separate written approval.

### Sunrun public referral program — REJECT FOR GRIDPERMIT PUBLISHER USE
The current public page advertises a $1,000 referral reward, but Sunrun's referral terms are framed around participant/referee programs and historic terms explicitly exclude authorized channel partners/lead generators in some promotions. This is not a clean publisher program for GridPermit. Do not use it as an affiliate mechanism unless Sunrun provides a separate commercial publisher agreement.

Installer-referral conclusion: prioritize marketplaces/networks with explicit publisher terms over consumer refer-a-friend programs.

## 11 — Pay-per-call decision

**Preferred network for diligence: Digital Master Media first, BuyTheCalls second.**

Reasoning:
- both explicitly support solar;
- both support SEO/organic traffic according to their published materials already documented in `PAY_PER_CALL_FEASIBILITY.md`;
- DMM publishes solar payout up to $53/call;
- BuyTheCalls publishes solar ranges and qualification-duration rules;
- neither requires GridPermit to make outbound calls.

### Do not build yet
A production pay-per-call component remains gated on:
1. publisher/network approval;
2. a real campaign/tracking number;
3. exact payable-call definition (duration, geography, business hours, duplicates, caps);
4. call-recording/consent requirements;
5. final disclosure/compliance language.

Once those are available, the engineering task becomes narrowly defined: a contained click-to-call/DNI component on a small Tier-A test cohort, with analytics and a kill switch. That is the point at which Claude/code work becomes justified.

## Immediate blockers requiring owner interaction

1. Awin publisher account signup/identity/compliance flow.
2. CJ account activation/onboarding resolution for EnergySage.
3. Any application that asks for legal identity, tax/payment credentials, signature, or binding compliance acceptance.

Everything else in this closeout is research, routing, prioritization and readiness work and has been completed without changing production.