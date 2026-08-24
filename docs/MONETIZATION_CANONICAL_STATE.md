# GridPermit Monetization — Canonical Current State

Last reconciled: 2026-08-25

## Purpose

This is the single current-state source of truth for every monetization partner and route. It supersedes the "current state" sections of every other monetization doc in this repo. Older docs (`docs/AFFILIATE_PARTNER_PIPELINE.md`, `docs/MONETIZATION_CONTROL_PLANE_2026-08-25.md`, `docs/FIRST_REVENUE_SPRINT_2026-08-25.md`, `docs/MONETIZATION_RESEARCH_2026-08-25.md`, `docs/HARDWARE_AFFILIATE_EXPANSION_2026-08-25.md`, `docs/PAY_PER_CALL_DECISION_2026-08-24.md`, `docs/CJ_ACTIVATION_ESCALATION.md`, `docs/AWIN_CLUSTER_APPLICATION_KIT.md`, `docs/PARTNER_OUTREACH_QUEUE.md`) remain as historical narrative and evidence trail, not deleted, but if any of them conflicts with this file on current status, this file wins.

The machine-readable mirror of this table lives in `src/lib/partners.ts`. If this document and that file ever disagree, treat it as a bug and reconcile both in the same commit.

## Non-negotiable gates (unchanged, restated for this doc)

- No production affiliate/CPL link without real program approval + a real tracking URL.
- No production pay-per-call CTA without real campaign approval + a real tracking number + final compliance terms.
- No SEO title/meta/H1/canonical/robots/sitemap/locality-architecture change for monetization rollout.
- No fabricated traffic, audience, company, tax, payment, social, or revenue figures.
- No contract, exclusivity, deposit, paid subscription, or tax/bank change without explicit owner approval.

## Canonical partner ledger

| Partner | Channel | Status | Approved | Tracking | Payout (as published/reported) | Cookie | Geo | Blocker | Next executable action |
|---|---|---|---|---|---|---|---|---|---|
| **EnergySage** | CPL (solar) | `OWNER_ACTION_REQUIRED` (CJ-side) | No | No (plain untracked root link is the live CTA) | Reported ~$10/lead on CJ's program page — not independently confirmed in writing | Reported 45-day referral window — not independently confirmed | US | CJ advertiser 5835771 blocked on account activation (Network Profile step or "Activate Account" button unclear which; see `docs/CJ_ACTIVATION_ESCALATION.md`) | Owner logs into CJ → Account Settings, checks onboarding checklist state, clicks Activate if available, or files the prepared CJ Support ticket |
| **EnergySage (FlexOffers alt.)** | CPL (solar) | `AWAITING_RESPONSE` | No | No | Unknown | Unknown | US | Support case open, no substantive reply yet | Wait for FlexOffers reply; do not duplicate outreach |
| **EnergySage (direct partner form)** | CPL (solar) | `DISCOVERED` | No | No | Unknown | Unknown | US | Requires owner-supplied identity/contact info at energysage.com/partner/register/ | Owner-only: complete and submit the form if desired |
| **Digital Master Media (DMM)** | Pay-per-call (solar) | `AWAITING_RESPONSE` | Fit confirmed by email, not a signed agreement | No tracking number | Public site advertises up to $53/call; GridPermit-specific rate not received | N/A (call-based; 120s post-IVR qualification threshold) | US, nationwide | Missing: GridPermit-specific payout, tracking number, setup instructions, ZIP recommendations, exact IVR logic, disclosure wording, final agreement | Follow up with DMM contact (Abid Ali) for the 7 items in GitHub issue #1 |
| **BigBattery** | Hardware affiliate (battery) | `PENDING_APPROVAL` | No | No | Reported/published 5% commission on hardware | Unknown | US | Awaiting BigBattery's review of submitted application (2026-08-20) | Wait; no channel to follow up exists |
| **Profitise** | CPL (solar) | `AWAITING_RESPONSE` | No | No | Unknown | Unknown | Unknown | No reply visible (no inbox access in this environment) | Wait; do not duplicate outreach |
| **ALLPOWERS** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | No | No | Published 5% base, up to 10% tiers | 30 days | US | Awin blocked; non-Awin routes (GoAffPro/CJ/AvantLink) exist; outreach sent 2026-08-25 to marketing@allpowers.com | Wait for reply; owner creates GoAffPro/direct account once route confirmed |
| **BLUETTI** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | No | No | Published up to 10% | 30 days | US | Awin blocked; Impact.com alternate confirmed live; outreach sent 2026-08-25 to marketing@bluetti.com | Wait for reply; owner applies via Impact.com once confirmed |
| **EcoFlow** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | No | No | Published minimum 5% | 7 days | US | Awin blocked; Impact.com alternate confirmed live; outreach sent 2026-08-25 to affiliate@ecoflow.com | Wait for reply; owner applies via Impact.com once confirmed |
| **Power Queen** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | No | No | Published 5.5% base | 30 days | US | Awin blocked; GoAffPro route confirmed live; outreach sent 2026-08-25 to service@ipowerqueen.com | Wait for reply; owner creates GoAffPro account once confirmed |
| **Redodo** | Hardware affiliate (battery) | `OWNER_ACTION_REQUIRED` | No | No | Unknown | Unknown | US | GoAffPro portal confirmed live, no outreach sent yet | Owner creates GoAffPro account (redodopower.goaffpro.com) — no blocker beyond account creation |
| **EASUNPOWER** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | No | No | Published 5% on confirmed orders | Unknown | Unknown, US traffic | Direct email program; outreach sent 2026-08-25 to avy@easunpower.com | Wait for reply |
| **Vatrer Power** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | No | No | Unknown | Unknown | Unknown | UpPromote-hosted program; outreach sent 2026-08-25 to brand@vatrerpower.com | Wait for reply |
| **LiTime** | Hardware affiliate (battery) | `OWNER_ACTION_REQUIRED` | No | No | Published up to 5% | Unknown | Unknown | GoAffPro/Impact non-Awin routes confirmed, no outreach sent yet | Owner creates GoAffPro or Impact account |
| **RICH SOLAR** | Hardware affiliate (battery) | `AWAITING_RESPONSE` | No | No | Unknown | Unknown | Unknown | Outreach sent 2026-08-25 to support@richsolar.com | Wait for reply |
| **Renogy** | Hardware affiliate (battery) | `VERIFIED` | No | No | Published average 6%, no stated maximum | Unknown | US (worldwide with regional acceptance) | Impact-hosted program confirmed live, no outreach sent yet | Owner/agent sends outreach to renogy.affiliate@renogy.com, then applies via Impact once confirmed |
| **Anker SOLIX** | Hardware affiliate (battery) | `VERIFIED` | No | No | Published 5% | 30 days | US | Routes via LinkShare or Impact (preferred); no outreach sent yet | Send outreach to affiliate@anker.com, apply via Impact |
| **Goal Zero** | Hardware affiliate (battery) | `VERIFIED` | No | No | Published up to 10% | 30 days | US | Routes via Partnerize; no outreach sent yet | Apply via Partnerize registration portal |
| **Signature Solar** | Hardware affiliate (battery) | `VERIFIED` | No | No | Published up to 9% | 7 days | US | Direct in-house program; no outreach sent yet | Submit direct application at signaturesolar.com/affiliate-application/ |
| **Nature's Generator** | Hardware affiliate (battery) | `VERIFIED` | No | No | Published 5% | Unknown | US | ShareASale primary route (non-Awin); no outreach sent yet | Create free ShareASale account |
| **SunGoldPower** | Hardware affiliate (battery) | `VERIFIED` | No | No | Published 6% | Unknown | US | ShareASale primary route (non-Awin); no outreach sent yet | Sign up via ShareASale or contact support@sungoldpower.com |
| **Zendure** | Hardware affiliate (battery) | `VERIFIED` | No | No | Published 5% or 10%, page inconsistent, unconfirmed | 30 days | US | Routes via Impact (preferred) or Awin; no outreach sent yet | Confirm actual commission at signup via Impact |
| **Growatt** | Hardware affiliate (battery) | `VERIFIED` | No | No | Published 15%-20% | Unknown | US | Routes via direct email, Awin, or Partner Boost; no outreach sent yet | Email marketing.pps@growatt.com or apply via Partner Boost |
| **Jackery** | Hardware affiliate (battery) | `DISCOVERED` | No | No | Unknown, fetch did not render terms | Unknown | US | Program confirmed to exist; terms unverified | Manually visit jackery.com/pages/affiliate-program to confirm terms before outreach |
| **Modernize** | CPL (solar, multi-trade) | `DISCOVERED` | No | No | Unconfirmed (third-party sources suggest per-lead) | Unconfirmed (sources suggest 30 days) | US | Primary page bot-blocked (403); terms not independently verified | Do not contact until independently verified |
| **Segway (portable power)** | Hardware affiliate (battery) | `DISCOVERED` | No | No | Unknown | Unknown | US | Program URL exists; product scope (power stations vs. mobility) unconfirmed | Manually verify product scope and terms before outreach |
| **Oukitel Power** | Hardware affiliate (battery) | `REJECTED` | No | No | N/A | N/A | N/A | Awin-only, no non-Awin alternate found | None; closed unless a non-Awin route surfaces |
| **Battle Born Batteries** | Hardware affiliate (battery) | `REJECTED` | No | No | N/A | N/A | N/A | No live affiliate page found; unrelated reputational-risk signal noted | None; closed unless a live program page is found |
| **Mighty Max Battery** | Hardware affiliate (battery) | `REJECTED` | No | No | N/A | N/A | N/A | Cannot confirm the program is currently live (404s) | None; closed unless a live page is confirmed |
| **ADT Solar** | General referral | `REJECTED` | No | No | N/A | N/A | N/A | Consumer refer-a-friend app, not a publisher affiliate channel | None; wrong program type |
| **MatchBurst** | CPL (solar) | `BLOCKED` | No | No | Unknown | Unknown | Unknown | Awin blocked (Israel not in Tax Residency dropdown); no non-Awin alternate found (matchburst.com blocks direct fetch, 403) | None known; park until a genuine alternate surfaces |
| **Bark.com** | General home services referral | `BLOCKED` | No | No | Unknown | Unknown | Unknown | Awin blocked; Bark's own page states it runs on Awin; unconfirmed direct contact pro@bark.us exists | Owner may try the untested pro@bark.us contact if desired; not yet attempted |
| **Angi** | General home services referral | `REJECTED` | No | No | N/A | N/A | N/A | Angi Affiliate Team confirmed directly: does not accept solar leads from affiliate partners | None; closed |
| **Current Connected** | Hardware affiliate (battery) | `REJECTED` | No | No | Published 8% average | Unknown | US/Canada residents only | GridPermit/owner is not a US/Canada resident applicant; explicit published eligibility mismatch | None; closed |
| **SUNcheck** | CPL (solar) | `REJECTED` | No | No | N/A | N/A | N/A | No evidence anywhere of a real affiliate program or the previously-claimed $1,000/365-day figure, re-checked and still absent | None; closed |
| **Awin (network)** | N/A — network, not a partner | `BLOCKED` | N/A | N/A | N/A | N/A | N/A | Israel is not offered in Awin's own Tax Residency dropdown at signup | None; do not spend further time forcing Awin. Alternate routes per-program are the strategy (see above) |

## Production-ready status: none

Zero partners are `APPROVED` + tracking-received + launch-enabled. The one live production CTA (EnergySage, `src/components/InstallerCTA.astro` + `src/pages/index.astro`) is a **plain, untracked, unconfirmed-compensation referral link** — not earning revenue, and must not be described as if it were.

## Status vocabulary used in this document

`DISCOVERED` · `VERIFIED` · `CONTACTED` · `AWAITING_RESPONSE` · `APPLICATION_STARTED` · `OWNER_ACTION_REQUIRED` · `PENDING_APPROVAL` · `APPROVED` · `TRACKING_RECEIVED` · `READY_FOR_PRODUCTION` · `PRODUCTION_ACTIVE` · `REJECTED` · `BLOCKED`

No other status values should be introduced without updating this table and `src/lib/partners.ts` together.

## First-revenue priority engine

Scoring weights: revenue potential 30% · probability of approval 20% · time to activation 20% · traffic/content fit 15% · implementation effort 10% · compliance risk 5%. Scores are qualitative (1-5 per factor) since no real conversion data exists yet — this ranks distance-to-first-dollar, not a revenue forecast.

| Route | Revenue potential | Approval odds | Time to activation | Content fit | Impl. effort | Compliance risk | Weighted rank |
|---|---|---|---|---|---|---|---|
| A. DMM pay-per-call | High (per-call payout likely exceeds a per-lead CPL) | Medium (fit already confirmed by email; full agreement not yet in hand) | Medium (all 7 missing items must land before a click-to-call CTA is legal to ship) | High (locality pages are exactly the high-intent surface DMM wants) | Low (component can be built now, gated on config) | Medium (call recording/consent disclosure must be exact) | **1** |
| B. EnergySage CPL | Medium-high (per-lead, already-reported rate) | Medium (blocked on a CJ account-activation technicality, not a rejection) | Low once CJ clears (placement and copy already exist) | High (already the live locality/homepage CTA) | Very low (swap one link + flip one flag) | Low | **2** |
| C. Hardware affiliate cluster (BLUETTI/EcoFlow/ALLPOWERS/Power Queen/Redodo/EASUNPOWER/etc.) | Low-medium per sale, but 7+ parallel candidates in flight | Medium-high (several are lightweight signups once a route is confirmed) | Medium (still needs an owner-created account per brand) | Medium (battery editorial content, narrower page set than solar CPL) | Low (one reusable component serves all of them) | Low | **3** |
| D. FlexOffers (EnergySage alternate) | Same ceiling as B if it resolves first | Unknown (support case unanswered) | Unknown | High | Very low | Low | **4** |
| E. BigBattery | Low-medium (per-sale, narrower catalog fit) | Unknown (awaiting their review) | Unknown (their timeline, not ours) | Medium | Low | Low | **5** |

### Top 5 immediate monetization routes

**1. DMM pay-per-call (solar)**
- Why #1: highest likely per-conversion payout, and GridPermit is already a confirmed fit — the remaining gap is purely administrative (missing terms), not commercial uncertainty.
- Missing blocker: GridPermit-specific payout, tracking number, ZIP guidance, IVR logic, disclosure wording, final agreement (7 items, GitHub issue #1).
- Trigger to implement: DMM sends the tracking number + final terms.
- Target pages: high-intent locality guides only (not site-wide).
- CTA type: click-to-call button, phone-only, no form.
- Event tracking: `pay_per_call_cta_viewed`, `pay_per_call_clicked`.
- Disclosure: call-recording/consent notice, exact wording pending DMM.
- Fallback if rejected/stalled: fall back to EnergySage CPL as the sole locality CTA (status quo).

**2. EnergySage CPL (solar)**
- Why #2: the relationship, placement, and copy already exist; only CJ account activation and a real tracking link stand between this and go-live.
- Missing blocker: CJ account-activation status is unresolved (see `docs/CJ_ACTIVATION_ESCALATION.md`).
- Trigger to implement: CJ activates the account and issues a working tracked link, or FlexOffers/direct route delivers one instead.
- Target pages: all locality guides + homepage (existing placement).
- CTA type: existing button, swap URL only.
- Event tracking: existing `external_partner_clicked`, reclassify as `cpl_cta_clicked` once tracked.
- Disclosure: update from `UNTRACKED_RELATIONSHIP` to `APPROVED_CPL` disclosure state (see Phase 7 architecture below).
- Fallback: continue as an untracked, disclosed referral link (current state).

**3. Hardware affiliate cluster (first to approve)**
- Why #3: highest breadth (7+ live candidates), lowest technical effort once one program approves, but lowest per-conversion payout of the three lanes.
- Missing blocker: every candidate is still pre-approval; several are one owner-created account away (Redodo, LiTime).
- Trigger to implement: any one program returns `APPROVED` + a real tracking URL.
- Target pages: battery/backup-power editorial and blog content only, never locality permit pages.
- CTA type: inline product-affiliate card with disclosure.
- Event tracking: `affiliate_cta_viewed`, `affiliate_cta_clicked`.
- Disclosure: standard tracked-affiliate disclosure (Phase 11 taxonomy).
- Fallback: keep battery content unmonetized until one clears.

**4. FlexOffers (EnergySage alternate route)**
- Why #4: same payout ceiling as EnergySage CPL but currently has no confirmed timeline.
- Missing blocker: no substantive reply to the open support case.
- Trigger to implement: FlexOffers approves + issues a tracked link.
- Target pages: same as EnergySage CPL (this is an alternate network for the same product, not a separate CTA).
- CTA type: same as EnergySage CPL.
- Event tracking: same as EnergySage CPL.
- Disclosure: same as EnergySage CPL.
- Fallback: EnergySage-via-CJ remains primary; this is a backup path, not an additional CTA.

**5. BigBattery**
- Why #5: real submitted application with a real per-sale commission, but narrower catalog fit than the broader hardware cluster and no owner-side lever to pull while waiting.
- Missing blocker: BigBattery's own review of the 2026-08-20 application.
- Trigger to implement: BigBattery approves + issues a tracking link/code.
- Target pages: battery editorial content, same eligibility class as the hardware cluster.
- CTA type: same reusable product-affiliate component as the cluster.
- Event tracking: `affiliate_cta_viewed`, `affiliate_cta_clicked`.
- Disclosure: standard tracked-affiliate disclosure.
- Fallback: folds into the general hardware-affiliate cluster once approved; no dedicated component needed.
