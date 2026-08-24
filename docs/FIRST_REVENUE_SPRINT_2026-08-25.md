# GridPermit First-Revenue Sprint — 2026-08-25

Purpose: move GridPermit from partner research into the shortest credible path to first tracked revenue without violating the SEO freeze or activating unapproved monetization.

## Executive priority

### Lane A — Solar pay-per-call: Digital Master Media (highest near-term execution readiness)

Direct email from DMM on 2026-08-24 confirmed that GridPermit is a fit for SEO-driven solar traffic and that new pay-per-call publishers are accepted.

Confirmed campaign terms:
- Organic SEO/content traffic accepted
- New pay-per-call publishers accepted
- Solar qualification threshold: 120 seconds post-IVR
- Nationwide U.S. coverage
- Business hours: Monday-Friday, 8:00 AM-8:00 PM EST
- First qualified call from a consumer only; duplicates/repeats are not billable
- No daily minimum volume
- Calls are recorded
- Publisher must disclose recording and comply with applicable consent laws

Launch remains gated on:
1. GridPermit-specific payout
2. Tracking number
3. Campaign setup instructions
4. ZIP recommendations/exclusions
5. Exact IVR/qualification criteria if available
6. Required/recommended recording-consent wording
7. Any agreement or additional compliance requirements

Canonical implementation gate: GitHub issue #1.

Do not deploy any call CTA until those gates clear.

## Lane B — Solar CPL: EnergySage

EnergySage remains the preferred CPL/marketplace route.

Current routes:
- CJ advertiser 5835771: blocked by CJ account activation, not rejected by EnergySage.
- FlexOffers: pre-registration eligibility/EnergySage inquiry is open and awaiting a substantive support answer.
- Direct EnergySage partner route: official partner registration is live at https://www.energysage.com/partner/register/ and supports national organizations, with a partner landing page/dashboard model.

The direct form requires owner/contact information and should not be submitted by an agent without the owner completing any required identity/contact fields.

## Lane C — Hardware affiliate rescue after Awin block

Awin is not a viable publisher route for GridPermit because Israel is unavailable in the Tax Residency selector. No false country should be used.

Verified non-Awin paths:

### ALLPOWERS — strong alternate route
Official affiliate page currently lists:
- CJ
- Awin
- AvantLink
- GoAffPro / in-house

The page states that bloggers, content creators, review sites, comparison sites, and communities are eligible; standard commission starts at 5% per sale. GoAffPro/in-house is explicitly listed, so Awin is not required.

Action taken 2026-08-25: direct inquiry sent to marketing@allpowers.com asking which non-Awin route is best for GridPermit's U.S.-audience organic traffic and requesting current U.S. terms/eligibility.

### EcoFlow — direct affiliate contact opened
Official U.S. contact page lists affiliate@ecoflow.com for the affiliate program. EcoFlow's affiliate materials explicitly describe review sites, online communities, bloggers and content creators as eligible publisher types.

Action taken 2026-08-25: direct inquiry sent to affiliate@ecoflow.com asking for the current U.S. publisher network/route, commission/cookie terms, international-publisher eligibility for U.S. traffic, and editorial restrictions.

### BLUETTI — direct affiliate contact opened
Official U.S. affiliate page says affiliates/agencies may promote BLUETTI on websites, advertises up to 10% commission, and states a 30-day cookie. The exact U.S. network/path still needs confirmation before signup.

Action taken 2026-08-25: direct inquiry sent to marketing@bluetti.com asking for the current U.S. publisher route, international eligibility, current commission, cookie confirmation, and editorial restrictions.

### Power Queen
Official U.S. affiliate page confirms media/blog publishers are accepted and shows multiple affiliate-platform routes. A non-Awin route was already identified in the canonical pipeline. Owner action remains required for account creation once the preferred route is confirmed.

## Production rules

Until a program is approved and a real tracking asset exists:
- No production affiliate URLs
- No tracking phone number
- No site-wide monetization CTA
- No changes to titles, meta descriptions, H1s, canonicals, robots, sitemap, locality architecture, or schema solely for monetization
- No fabricated traffic, audience, company, tax, payment, or social data

When a first program clears the gate, rollout should be contained:
- Solar/locality high-intent pages: CPL or pay-per-call
- Battery/backup-power editorial: hardware affiliate
- Trust/legal/contact pages: no monetization

## Outreach executed in this sprint

Sent and labeled `Grid Permit`:
- EcoFlow Affiliate Team — `affiliate@ecoflow.com`
- ALLPOWERS Affiliate Team — `marketing@allpowers.com`
- BLUETTI Marketing/Affiliate Team — `marketing@bluetti.com`

All messages were informational/nonbinding and requested current eligibility/terms. No financial commitment, contract, tax change, exclusivity, or paid signup was accepted.

## Next trigger

The next coding pass should begin only when one of these becomes true:
1. DMM sends final payout + tracking number + compliance/setup terms; or
2. EnergySage/CJ/direct route produces approval + real tracking link; or
3. A hardware program approves GridPermit and provides a real affiliate tracking link.

At that point Claude should implement only the relevant contained monetization path, run tests/build, and leave unrelated SEO untouched.
