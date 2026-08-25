# GridPermit Monetization — Canonical Current State

Last reconciled: 2026-08-25

## Purpose

This is the single current-state source of truth for every monetization partner and route. It supersedes the "current state" sections of every other monetization doc in this repo. Older docs (`docs/AFFILIATE_PARTNER_PIPELINE.md`, `docs/MONETIZATION_CONTROL_PLANE_2026-08-25.md`, `docs/FIRST_REVENUE_SPRINT_2026-08-25.md`, `docs/MONETIZATION_RESEARCH_2026-08-25.md`, `docs/HARDWARE_AFFILIATE_EXPANSION_2026-08-25.md`, `docs/PAY_PER_CALL_DECISION_2026-08-24.md`, `docs/CJ_ACTIVATION_ESCALATION.md`, `docs/AWIN_CLUSTER_APPLICATION_KIT.md`, `docs/PARTNER_OUTREACH_QUEUE.md`, `docs/MONETIZATION_EVIDENCE_ADDENDUM_2026-08-25.md`) remain as historical narrative and evidence trail, not deleted, but if any of them conflicts with this file on current status, this file wins.

The machine-readable mirror of this table lives in `src/lib/partners.ts`. If this document and that file ever disagree, treat it as a bug and reconcile both in the same commit.

## Non-negotiable gates

- No production affiliate/CPL link without real program approval + a real tracking URL.
- No production pay-per-call CTA without real campaign approval + a real tracking number + final compliance terms.
- No SEO title/meta/H1/canonical/robots/sitemap/locality-architecture change for monetization rollout.
- No fabricated traffic, audience, company, tax, payment, social, or revenue figures.
- No contract, exclusivity, deposit, paid subscription, or tax/bank change without explicit owner approval.

## Canonical partner ledger

| Partner | Channel | Status | Approved | Tracking | Payout (as published/directly confirmed) | Cookie | Geo | Blocker | Next executable action |
|---|---|---|---|---|---|---|---|---|---|
| **EnergySage** | CPL (solar) | `OWNER_ACTION_REQUIRED` | No | No (plain untracked root link is the live CTA) | Reported ~$10/approved lead on CJ program page; current live terms must be re-read before applying | Reported 45-day referral window; current live terms must be re-read | US | **CJ publisher account is now activated.** Remaining blocker is advertiser-level EnergySage application/approval + real tracking link | Owner logs into CJ, opens EnergySage advertiser 5835771, reviews current terms, submits Apply/Join, records result; see GitHub issue #3 |
| **EnergySage (FlexOffers alt.)** | CPL (solar) | `APPLICATION_STARTED` | No (publisher account, not the advertiser program) | No | Unknown (FlexOffers-level publisher terms; EnergySage advertiser-specific terms not yet reachable) | Unknown | US (owner is outside the U.S.; FlexOffers confirmed non-U.S. publishers are accepted) | FlexOffers publisher registration fully submitted 2026-08-25 (site ownership verified via `fo-verify` meta tag on the homepage); FlexOffers itself said review takes up to 5 business days. EnergySage is confirmed to currently be in the FlexOffers network, but its advertiser-specific program has not yet been opened or applied to, since that requires the publisher account to be approved first | Wait for FlexOffers publisher approval (up to 5 business days), then locate EnergySage Solar Marketplace inside the dashboard, capture its advertiser-specific terms, and bring them to the owner before accepting anything |
| **EnergySage (direct partner form)** | CPL (solar) | `DISCOVERED` | No | No | Unknown | Unknown | US | Requires owner-supplied identity/contact info at energysage.com/partner/register/ | Keep as fallback if CJ advertiser route stalls |
| **Digital Master Media (DMM)** | Pay-per-call (solar) | `AWAITING_RESPONSE` | Fit confirmed by direct email, not final campaign approval | No tracking number | Public site advertises up to $53/call; **GridPermit-specific rate not received** | N/A; direct email confirms 120s post-IVR qualification threshold | US, nationwide | Missing GridPermit-specific payout, tracking number/setup, ZIP guidance, IVR logic, disclosure wording, final agreement/compliance | Standalone follow-up successfully sent 2026-08-25 to Abid Ali requesting all launch items; wait for response |
| **BigBattery** | Hardware affiliate (battery) | `PENDING_APPROVAL` | No | No | Published 5% | Unknown | US | Submitted application awaiting review | Wait for BigBattery decision; do not resubmit |
| **Profitise** | CPL (solar) | `AWAITING_RESPONSE` | No | No | Unknown | Unknown | US | Inquiry/follow-up sent; Gmail sweep 2026-08-25 found no substantive reply | Wait; do not duplicate outreach |
| **Renogy** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | Direct fit confirmation only; no platform approval | No | **6% direct-confirmed U.S. rate** | **27 days direct-confirmed** | U.S.-focused audience; international publishers accepted | Renogy confirmed GridPermit is a great fit, organic/editorial accepted, contextual solar/battery guides welcomed, no brand-term paid search. Waiting preferred Impact application/invitation route and media assets | Wait for Yuna/Renogy reply; then apply via the confirmed Impact route. Do not send another follow-up yet |
| **BougeRV** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | Direct fit confirmation only; no platform approval | No | **7% direct-confirmed standard rate** | Unknown | US | Independent publishers, organic/editorial and contextual solar/battery/home-energy links directly accepted; Impact or Awin available. Waiting preferred Impact application/invitation link | Wait for Vivia/BougeRV reply; use Impact, not Awin |
| **ALLPOWERS** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | No | No | Published 5% base, up to 10% tiers | 30 days | US | Non-Awin routes exist; direct outreach sent | Wait for reply; use GoAffPro/direct or another confirmed route |
| **BLUETTI** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | No | No | Published up to 10% | 30 days | US | Impact alternate exists; direct outreach sent | Wait for reply; use Impact if accepted |
| **EcoFlow** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | No | No | **U.S.-specific rate not confirmed** | **U.S.-specific cookie not confirmed** | US | Impact alternate exists; regional affiliate pages show differing economics, so those terms must not be imported into U.S. state | Wait for direct U.S. confirmation; do not record regional commission/cookie as U.S. terms |
| **Power Queen** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | No | No | Published 5.5% base | 30 days | US | GoAffPro route confirmed; direct outreach sent | Wait for reply; then use confirmed GoAffPro route |
| **Redodo** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | No | No | Unknown | Unknown | US | GoAffPro route exists; direct inquiry sent 2026-08-25 to service@redodopower.com | Wait for reply before account creation |
| **EASUNPOWER** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | No | No | Published 5% on confirmed orders | Unknown | US-focused traffic | Direct email program; outreach sent | Wait for reply |
| **Vatrer Power** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | No | No | Unknown | Unknown | US-focused traffic | UpPromote program; outreach sent | Wait for reply |
| **LiTime** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | No | No | Published up to 5% | Unknown | US-focused traffic | GoAffPro and Impact non-Awin routes exist; direct inquiry sent 2026-08-25 to service@litime.com | Wait for route/terms confirmation before account creation |
| **RICH SOLAR** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | No | No | Unknown | Unknown | US | Case #8058 auto-ack received; no substantive affiliate response yet | Wait for human affiliate response |
| **Anker SOLIX** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | No | No | Published 5% | 30 days | US | Impact/LinkShare route exists; outreach sent 2026-08-24 to affiliate@anker.com | Wait for reply; no duplicate follow-up yet |
| **Goal Zero** | Hardware affiliate (battery) | `VERIFIED` | No | No | Published dynamic up to 10% | 30 days | US | Partnerize-managed program; requires application/account action | Owner applies through Partnerize business route when ready |
| **Signature Solar** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | No | No | Published up to 9% | 7 days | US and international referrals accepted | Direct in-house program; outreach already sent 2026-08-24 to support@signaturesolar.com | Wait for response or owner submits direct application |
| **Nature's Generator** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | No | No | Published 5% | Unknown | US | Official page references ShareASale and Awin; route ambiguity remains. Inquiry sent 2026-08-25 | Wait for current preferred route + terms confirmation |
| **SunGoldPower** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | No | No | Published 6% | Unknown | US | ShareASale route exists; outreach sent 2026-08-24 to sales@sungoldpower.com | Wait for reply; no duplicate follow-up yet |
| **Zendure** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | No | No | Official page inconsistent: up to 5% vs up to 10%; unconfirmed | 30 days | US | Impact route exists; outreach sent 2026-08-24 | Wait for reply or Impact terms; do not guess rate |
| **Growatt** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | No | No | Published 15%-20% on qualifying sales; GridPermit-specific rate not approved | Unknown | US | PartnerBoost/direct route exists; outreach sent 2026-08-25 to marketing.pps@growatt.com | Wait for direct fit/terms reply |
| **ECO-WORTHY** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | No | No | Published 5% | 30 days | US | Official U.S. page lists Impact/Awin; direct inquiry sent 2026-08-25 | Wait for GridPermit eligibility and Impact-route confirmation |
| **Powerness** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | No | No | Published 5% | **Unresolved: official page says both 45 and 30 days** | US-focused traffic | ShareASale; media publishers explicitly welcomed; PPC prohibited. Inquiry sent | Wait for attribution-window clarification and fit confirmation |
| **ACOPOWER** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | No | No | **Unresolved: official pages conflict between 6% and 8%** | Unresolved | US | Official pages conflict on platform (AvantLink/ShareASale/direct), rate and payout form; clarification inquiry sent | Do not apply or record commercial terms until ACOPOWER resolves conflicts |
| **WattCycle** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | No | No | Unknown | Unknown | US | Official U.S. affiliate page exists but terms are not exposed in crawl; inquiry sent 2026-08-25 to official marketing contact | Wait for platform/commission/cookie/fit confirmation |
| **SOK Battery** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | No | No | Unknown | Unknown | US | U.S. site exposes Affiliate Programme navigation but terms not surfaced; inquiry sent 2026-08-25 to sales@sokbattery.com | Wait for program terms and publisher eligibility confirmation |
| **ShopSolar** | Hardware affiliate / solar kits | `AWAITING_RESPONSE` | No | No | Unknown | Unknown | US | Official Affiliate Program redirects to ShopSolar-branded GoAffPro signup; direct inquiry sent 2026-08-25 | Wait for publisher eligibility + current commission/cookie/restrictions; then use GoAffPro if confirmed |
| **Jackery** | Hardware affiliate (battery) | `DISCOVERED` | No | No | Unknown; automated fetch did not render terms | Unknown | US | Program exists but primary terms remain unverifiable in current tool environment | Do not contact until terms are independently verified |
| **Modernize** | CPL (solar, multi-trade) | `DISCOVERED` | No | No | Unconfirmed | Unconfirmed | US | Primary program page bot-blocked; third-party terms are not sufficient | Do not contact until primary terms verified |
| **Segway (portable power)** | Hardware affiliate (battery) | `DISCOVERED` | No | No | Unknown | Unknown | US | Program URL exists but portable-power commissionability unverified | Verify product scope before outreach |
| **Oukitel Power** | Hardware affiliate (battery) | `REJECTED` | No | No | N/A | N/A | N/A | Awin-only; no alternate found | Closed unless non-Awin route surfaces |
| **Battle Born Batteries** | Hardware affiliate (battery) | `REJECTED` | No | No | N/A | N/A | N/A | No live affiliate page confirmed | Closed unless live program surfaces |
| **Mighty Max Battery** | Hardware affiliate (battery) | `REJECTED` | No | No | N/A | N/A | N/A | Program page 404/unverifiable | Closed unless live program surfaces |
| **ADT Solar** | General referral | `REJECTED` | No | No | N/A | N/A | N/A | Consumer refer-a-friend structure, not a publisher channel | Closed |
| **MatchBurst** | CPL (solar) | `BLOCKED` | No | No | Unknown | Unknown | Unknown | Awin blocked; no verified alternate found | Park until a genuine alternate surfaces |
| **Bark.com** | General home services referral | `BLOCKED` | No | No | Unknown | Unknown | Unknown | Awin-dependent; no verified non-Awin publisher route | Park |
| **Angi** | General home services referral | `REJECTED` | No | No | N/A | N/A | N/A | Angi Affiliate Team directly confirmed it does not accept solar leads from affiliate partners | Closed |
| **Current Connected** | Hardware affiliate (battery) | `REJECTED` | No | No | Published 8% average | Unknown | US/Canada residents only | Applicant residency requirement does not fit | Closed unless eligibility changes |
| **SUNcheck** | CPL (solar) | `REJECTED` | No | No | N/A | N/A | N/A | No evidence of a real affiliate program; old $1,000/365-day claim invalidated | Closed |
| **Awin (network)** | Network | `BLOCKED` | N/A | N/A | N/A | N/A | N/A | Israel unavailable in Awin Tax Residency dropdown | Do not force Awin; use per-program alternates |

## Production-ready status: none

Zero partners are `APPROVED` + tracking-received + launch-enabled. The one live production CTA (EnergySage, `src/components/InstallerCTA.astro` + `src/pages/index.astro`) remains a **plain, untracked referral link**. It is not an earning link and must not be described as one.

## Status vocabulary

`DISCOVERED` · `VERIFIED` · `CONTACTED` · `AWAITING_RESPONSE` · `APPLICATION_STARTED` · `OWNER_ACTION_REQUIRED` · `PENDING_APPROVAL` · `APPROVED` · `TRACKING_RECEIVED` · `READY_FOR_PRODUCTION` · `PRODUCTION_ACTIVE` · `REJECTED` · `BLOCKED`

No other status values should be introduced without updating this table and `src/lib/partners.ts` together.

## First-revenue priority engine

Scoring weights: revenue potential 30% · probability of approval 20% · time to activation 20% · traffic/content fit 15% · implementation effort 10% · compliance risk 5%. Scores are qualitative because no real conversion data exists yet. This ranks distance-to-first-dollar, not expected revenue.

| Route | Revenue potential | Approval odds | Time to activation | Content fit | Impl. effort | Compliance risk | Weighted rank |
|---|---|---|---|---|---|---|---|
| A. EnergySage CPL | Medium-high | Medium-high network readiness; advertiser still must approve | **High now that CJ account activation is complete** | High | Very low | Low | **1** |
| B. DMM pay-per-call | High | Medium; fit already confirmed | Medium; waiting 7 launch-grade items | High | Low | Medium | **2** |
| C. Hardware affiliate cluster | Low-medium per sale, broad parallel portfolio | Medium-high across many candidates; Renogy and BougeRV already fit-confirmed directly | Medium | Medium | Low | Low | **3** |
| D. FlexOffers EnergySage alternate | Same ceiling as A if resolved first | Unknown | Unknown | High | Very low | Low | **4** |
| E. BigBattery | Low-medium per sale | Unknown; application pending | Unknown | Medium | Low | Low | **5** |

### Top 5 immediate monetization routes

**1. EnergySage CPL (solar)**
- Why #1 now: the CJ publisher account is officially active, removing the network-level blocker. The existing homepage/locality CTA and CPL state architecture are already in place.
- Missing blocker: EnergySage advertiser approval plus a real CJ tracking URL.
- Immediate executable action: owner opens EnergySage advertiser 5835771 in CJ, reviews current live terms and submits Apply/Join. GitHub issue #3 contains the exact sequence.
- Target pages: locality guides + homepage, using existing placement.
- Trigger to monetize: advertiser approval + verified tracking link.
- Until then: keep the plain untracked EnergySage root link and `trackingEnabled=false`, `launchEnabled=false`.

**2. DMM pay-per-call (solar)**
- Why #2: high likely per-conversion value and direct fit confirmation already exists.
- Missing blocker: GridPermit-specific payout, tracking number/setup, ZIP guidance, IVR logic, disclosure wording, final agreement/compliance.
- Action already taken: standalone follow-up successfully sent 2026-08-25 after threaded Gmail replies repeatedly failed technically.
- Target pages: contained high-intent locality subset only.
- Trigger to monetize: tracking number + final campaign/compliance terms.

**3. Hardware affiliate cluster (first to approve)**
- Why #3: many parallel routes now exist, and Renogy/BougeRV have already given direct positive fit confirmation.
- Highest-quality near-term candidates: Renogy, BougeRV, BLUETTI, ALLPOWERS, Power Queen, LiTime, Growatt, ECO-WORTHY, ShopSolar.
- Trigger to monetize: any one program returns formal platform approval + real tracking URL.
- Target pages: battery/backup-power editorial and relevant blog content, not blanket locality pages.
- CTA/event architecture already exists and fails closed.

**4. FlexOffers (EnergySage alternate)**
- Keep as fallback only. No substantive program/eligibility response yet.
- Do not place a second EnergySage CTA or create duplicate attribution paths.

**5. BigBattery**
- Real application remains pending.
- No owner-side lever is currently available; wait for decision and tracking asset.

## Current highest-value owner action

**Apply to EnergySage in CJ now.** CJ network activation is no longer a blocker. Do not change production until the EnergySage advertiser application is approved and a real tracking link is issued.
