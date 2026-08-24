# GridPermit Monetization Control Plane — 2026-08-25

> **Superseded for current state** by `docs/MONETIZATION_CANONICAL_STATE.md`. This document remains as historical evidence for this pass; check the canonical file for the latest partner statuses.

Purpose: one operational view of the highest-value monetization routes that can realistically produce first revenue without violating the current SEO freeze or publishing unapproved tracking assets.

## Non-negotiable gates

- No production affiliate link without real program approval + real tracking link.
- No production pay-per-call CTA without real campaign approval + tracking number + final compliance terms.
- No SEO title/meta/H1/canonical/robots/sitemap/locality-content changes for monetization rollout.
- No fabricated traffic, audience, company, tax, social, payment, or volume claims.
- No paid commitment, deposit, exclusivity, financial change, or contract acceptance without owner review.

## Lane A — Solar pay-per-call: Digital Master Media

Status: `FIT_CONFIRMED / SETUP_PENDING`

Direct email confirmation received 2026-08-24 from Abid Ali after review of GridPermit:
- SEO/content traffic accepted.
- New pay-per-call publishers accepted.
- Solar threshold: 120 seconds post-IVR.
- Nationwide U.S. coverage.
- Business hours: Monday-Friday, 8:00 AM-8:00 PM EST.
- Only first qualified call from a consumer is payable; repeats are not billable.
- No daily minimum volume.
- Calls are recorded.
- Publisher-side call-recording disclosure and applicable consent-law compliance required.

Current public-source context:
- DMM publicly advertises Solar Installation at up to $53/call.
- Public application/payment language may contain generic terms that differ from campaign-specific email terms. Campaign-specific written terms control launch decisions.

Remaining launch gates:
1. GridPermit-specific/current solar payout.
2. Tracking number.
3. Campaign setup instructions.
4. ZIP targeting recommendations/exclusions.
5. IVR/qualification criteria.
6. Required/recommended recording-consent disclosure wording.
7. Any publisher agreement/additional compliance requirements.

Implementation after gate clears:
- high-intent solar pages only;
- contained rollout;
- no site-wide phone CTA;
- track pay-per-call separately from CPL/product-affiliate events;
- evaluate quality before scale.

Canonical GitHub gate: Issue #1.

## Lane B — Solar CPL: EnergySage

Status: `BLOCKED_BY_CJ_ACCOUNT_ACTIVATION` with FlexOffers alternate route under review.

Known current path:
- CJ advertiser 5835771.
- CJ application currently blocked because publisher account onboarding/activation is incomplete.
- This is not an EnergySage rejection.
- FlexOffers support case is open as an alternate route and awaiting a substantive response.

Launch gate:
- real advertiser approval + real tracking link.

## Lane C — Hardware affiliate cluster

### ALLPOWERS
Status: `CONTACTED / ALTERNATE_ROUTE_CONFIRMED`

Primary-source verified:
- U.S. program accepts bloggers/content creators/review websites and home-energy communities.
- Networks/routes listed by ALLPOWERS include CJ, Awin, AvantLink, and GoAffPro/direct.
- Base commission starts at 5% with performance tiers up to 10%.
- 30-day cookie.
- Monthly payouts through platform; direct GoAffPro has its own thresholds/process.
- Trademark brand bidding/PPC restrictions apply unless approved.

GridPermit outreach sent to marketing@allpowers.com asking for the best non-Awin route and current publisher terms.

### BLUETTI
Status: `CONTACTED / ALTERNATE_ROUTE_EXISTS`

Primary-source verified:
- Websites are an accepted promotion channel.
- Up to 10% commission.
- 30-day cookie.
- Free affiliate application.

GridPermit outreach sent to BLUETTI marketing/affiliate team. Awaiting route/eligibility response.

### EcoFlow
Status: `CONTACTED / ALTERNATE_ROUTE_EXISTS`

Primary-source verified:
- Review sites, online communities, bloggers and content creators are explicitly invited.
- EcoFlow US publishes affiliate@ecoflow.com as the affiliate contact.
- Regional program economics vary, so do not import EU/CA payout rates into the U.S. decision without U.S.-specific confirmation.

GridPermit outreach sent to affiliate@ecoflow.com. Awaiting U.S.-specific terms/route.

### Power Queen
Status: `CONTACTED / GOAFFPRO_ROUTE_VERIFIED`

Primary-source verified on Power Queen US:
- Media/blog publishers are eligible.
- U.S. affiliate routes include Awin and GoAffPro.
- Base commission starts at 5.5%.
- 30-day cookie.
- No fee to join.
- Battery/home-backup/solar-adjacent catalog is directly aligned with GridPermit hardware content.

Because Awin is unavailable, GridPermit sent a direct inquiry to service@ipowerqueen.com asking to confirm GoAffPro eligibility, SEO/content traffic acceptance, and whether the published 5.5% / 30-day terms apply there.

## Activation order

1. DMM if final payout/tracking/compliance package arrives.
2. EnergySage if CJ activation or FlexOffers route clears.
3. First hardware partner to return APPROVED + TRACKING_LINK_RECEIVED.
4. Add additional hardware partners only where page intent warrants it.

## Revenue-placement rule

- Locality/high-intent permit pages: solar CPL / installer referral, with selected very-high-intent pages eligible for pay-per-call after approval.
- Battery/product/editorial pages: hardware affiliate.
- Trust/legal/contact pages: no monetization.

## Claude trigger

Claude should not modify production monetization yet.

Trigger Claude only when at least one of these becomes true:
- DMM provides approved campaign + tracking number + final compliance terms; or
- an affiliate/CPL partner provides APPROVED status + a real tracking URL.

At that point, implementation should be small, reversible, tested, and limited to the page-intent subset defined above.
