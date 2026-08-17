# Pay-Per-Call Feasibility Assessment

Written 2026-08-15. Evaluates whether pay-per-call monetization could make economic sense for GridPermit, without rejecting it merely because the infrastructure doesn't exist yet. **No click-to-call infrastructure was built to produce this document — this is analysis only.**

## The one-line verdict

**All pay-per-call models found in this research are inbound-only** (a website visitor calls a tracked number; GridPermit never places an outbound call) — so none trigger the "reject if outbound calling required" condition. The real gate isn't outbound-calling risk, it's that **the actual revenue potential is unknowable until GridPermit has real traffic data**, and building the infrastructure would introduce a genuinely new compliance surface (call-recording/consent handling) the site has zero policy or infrastructure for today.

## Networks evaluated

| Network | Vertical fit | Payout (primary-sourced) | SEO/organic traffic accepted? | Qualification rules found |
|---|---|---|---|---|
| **Digital Master Media** | Solar, Roofing, HVAC, Electrical — explicit | Solar up to $53, Roofing up to $178, HVAC up to $94, Electrical up to $57 | Yes, explicit ("SEO / Organic" listed) | Compliance-acknowledgment gate confirmed; exact call-duration/intent thresholds not published — **gap** |
| **BuyTheCalls** | Solar, HVAC, Roofing — explicit | Solar $40–90, HVAC $20–80, Roofing $25–75 (their own site) | Yes, explicit ("If you run traffic — search, social, SEO sites... BuyTheCalls is a buyer for your volume") | Minimum call duration (60–120s by vertical), correct geo, "real person, real intent," business-hours delivery, caps |
| **CallVox** | Plumbing, HVAC, Roofing, Electrical, Pest Control, Windows — **no solar/battery** | $20–80/call by vertical (published) | Not stated either way | Not published; excludes "spam, incentivized, or bot traffic" |
| **BrokerCalls** | Solar listed, but as a sales-lead vertical, not permit content; battery not covered | Not published | Not stated | Not published |
| **eLocal** (re-confirmed from earlier passes) | Broad home services, 50+ verticals | Not published | Not stated | Requires "existing pay-per-call campaign experience" — a structural gate GridPermit doesn't meet as a first-time entrant |
| **DOPPCALL, Inquirly, Lead Smart** | No solar vertical found in any of the three (re-confirmed, unchanged from prior passes) | Not published | DOPPCALL: yes (SEO checkbox); others not stated | N/A — vertical mismatch is the disqualifier before qualification rules even matter |

**Best fit if this is ever pursued: BuyTheCalls or Digital Master Media** — both have solar named explicitly, both publish real payout ranges on their own sites, both explicitly welcome organic/SEO traffic.

## Factor-by-factor evaluation (BuyTheCalls / Digital Master Media, the two viable candidates)

**Qualified-call minimum duration:** BuyTheCalls: 60–120s by vertical (published). DMM: not published — gap.

**IVR rules:** Not published by either — a real unknown that would need to be confirmed at application time.

**Geo restrictions:** Both require correct geographic targeting for a call to qualify. This is a natural fit for GridPermit's architecture — every locality guide page already knows its own city/state, so call routing could map directly onto existing page structure rather than needing new geo-detection logic.

**Hours:** BuyTheCalls requires delivery within business hours. DMM: not published.

**Duplicates:** Not published by either.

**Caller qualification:** BuyTheCalls: "real person, real intent." DMM: compliance-acknowledgment gate exists but the specific caller-qualification bar isn't published.

**Payout:** See table above — both are real, both are meaningfully higher per-conversion than EnergySage's benchmark ($9.60/lead), which makes sense given a phone call is a higher-intent, higher-friction action than a link click.

**Traffic restrictions:** Both explicitly welcome SEO/organic content-site traffic — no disqualifying restriction found for GridPermit's actual traffic profile.

**Compliance requirements:** This is the real cost, not the payout. Real inbound click-to-call at scale typically means: call recording (with consent language), TCPA-adjacent consent handling for any call-tracking number displayed to a "reasonable expectation of privacy" caller, and DMM's own compliance-acknowledgment gate at application. GridPermit currently has **zero** call-handling policy, zero consent-collection UI, and no legal review of what a call-recording disclosure would need to say. This is a real, non-trivial addition — not just an engineering task.

**Reporting/tracking mechanism:** Both networks provide their own dashboards; GridPermit's side would need a way to render the correct tracking number per network/campaign.

**Dynamic-number-insertion (DNI) requirements:** Genuine technical work. The standard approach: a third-party DNI service (e.g., CallRail/Invoca-style, or numbers issued directly by the network) swapped into a CTA component based on traffic source. Shape-wise, this is comparable to the existing `InstallerCTA.astro` pattern — a new, contained component added to already-existing locality pages, not a new page or a backend rebuild. The complexity is in correctly attributing which page/campaign a call came from, not in the phone-number swap itself.

**TCPA implications:** TCPA governs *outbound* calls/texts primarily — since this model is 100% inbound (the homeowner initiates the call), TCPA exposure is lower than an outbound-calling model, but call-recording consent (state two-party-consent laws, e.g. California) still applies and would need real legal-language review before launch, not just a technical toggle.

**Outbound calling required?** No — confirmed inbound-only for every network evaluated. **This does not trigger a rejection** under the stated condition.

**Is simple inbound click-to-call sufficient?** Yes, functionally — no outbound infrastructure would be needed, only a tracked number displayed on-page.

## What's missing to turn this into a real go/no-go

The single blocking unknown, consistent with every other revenue estimate in this engagement: **actual GridPermit traffic data.** No GA4 API access exists in this environment (see `docs/PARTNER_APPLICATION_PROFILE.md` and the GA4 investigation notes in the tracker). Without real page-view numbers for the relevant locality guides, there's no way to convert "$40–90 per qualified solar call" into an actual revenue estimate — see `docs/REVENUE_SCENARIOS.md` (or `scripts/revenue-scenarios.mjs`) for the scenario model this feeds into once that number exists.

## Recommendation

**Do not build click-to-call infrastructure yet.** Not because the model is fake or a poor fit — it isn't; BuyTheCalls and Digital Master Media are both real, both solar-relevant, both organic-traffic-friendly, and both pay meaningfully more per conversion than the existing EnergySage link. The reasons to wait:

1. **No traffic data to size the opportunity** — the same gap blocking several other decisions in this engagement.
2. **New compliance surface** — call-recording consent language doesn't exist anywhere in GridPermit's current legal/trust infrastructure and would need real review, not just a code change.
3. **The existing single-partner EnergySage model hasn't been proven yet either** (per `docs/MONETIZATION_STRATEGY.md`'s own sequencing logic) — validating a simpler, already-live model before adding a second, more complex one is the more disciplined order of operations.

**If this gets prioritized later:** resolve GA4 access first, then build a single `PayPerCallCTA.astro`-style component (mirroring `InstallerCTA.astro`) wired to one network (BuyTheCalls or DMM, whichever's application terms turn out cleaner), on a **contained subset** of pages, not all 341 at once — consistent with this project's standing "prove the model small before scaling it" discipline.
