# GridPermit Pay-Per-Call Decision Gate — 2026-08-24

This is a current decision supplement to `docs/PAY_PER_CALL_FEASIBILITY.md`. It adds fresh primary-source checks from 2026-08-24 and defines the exact gate before engineering starts. No production code was changed.

## Current best-fit candidates

### Digital Master Media

Primary-source checks on 2026-08-24 confirm:

- Solar Installation offer exists.
- Payout shown as **up to $53 per qualified call**.
- SEO / Organic is explicitly accepted as a traffic source.
- USA nationwide coverage is stated.
- The solar offer shows a **120-second post-IVR buffer** on the offers page.
- Net 10 payment is stated for the offer.
- Publisher application asks for: full name, email, phone, messaging platform identity, publisher location/country, experience generating calls, prior networks, traffic source, call-tracking platform, call type, estimated daily volume, verticals, website/offer-approval links, compliance acknowledgements, and a signature.

Implication: the offer fit is real, but GridPermit should **not submit the application yet** because several fields require owner-supplied facts and contractual/compliance acknowledgement. Do not fabricate prior call-generation experience, call volume, tracking platform, or messaging identity.

### BuyTheCalls

Primary-source checks on 2026-08-24 confirm:

- Solar is an explicit vertical.
- Typical USA solar payout range shown as **$40–$90 per qualified call**.
- Their publisher page explicitly says SEO sites are accepted.
- Calls are inbound, exclusive, duration-filtered and geo-targeted.
- Qualification can depend on minimum duration, geography and intent.
- Publishers may operate worldwide while driving USA inbound traffic.
- Weekly publisher payouts are stated.

Implication: this is currently the cleaner theoretical fit for GridPermit's organic-search model, but application terms still need to be inspected and owner-required fields confirmed before any commitment.

## Engineering gate

Do **not** ask Claude to build or deploy click-to-call / DNI yet.

Engineering begins only when all of the following are true:

1. One pay-per-call network has actually approved GridPermit or provided a usable campaign/tracking number.
2. Exact campaign qualification rules are known: eligible geos, hours, minimum duration, duplicate/repeat treatment, caps, intent criteria, and any IVR rules.
3. The partner has confirmed whether calls are recorded and what disclosure/consent obligations are imposed on the publisher.
4. A contained initial placement set is selected from existing solar locality pages.
5. The owner has approved any contractual/compliance terms that require explicit acknowledgement.

## Proposed architecture after the gate clears

Only after approval, Claude can implement a contained first version:

- One `PayPerCallCTA` component, not a site-wide rewrite.
- Data-driven campaign configuration: partner, number/tracking token, eligible states/cities, business hours, disclosure text, campaign status.
- Default hard fail-closed behavior: no approved campaign = no phone CTA rendered.
- Preserve existing affiliate / EnergySage CTAs unless a deliberate A/B or placement rule is approved.
- Add a first-party analytics event for phone-CTA exposure and click/tap.
- Never log phone numbers, caller identity, call audio, or sensitive consumer information in GridPermit analytics.
- Roll out to a small set of pages first.

## Compliance note

Inbound pay-per-call materially reduces the outbound-calling risk that would exist in a cold-call model, but it does not eliminate compliance work. Network-specific call recording, consent language, state recording-consent rules, advertising disclosures, and any TCPA-related partner requirements must be resolved from the actual campaign agreement before production.

## Current decision

**Research continues; engineering is intentionally blocked.** The commercial evidence is strong enough to keep pay-per-call as a serious monetization path, but not strong enough to justify building infrastructure before an approved campaign exists.
