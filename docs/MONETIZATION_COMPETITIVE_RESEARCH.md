# Monetization Competitive Research

Written 2026-08-15. How real, established solar/home-improvement informational sites monetize — for strategy context, not for copying layouts. Every claim below is sourced; two entries (Modernize, Forbes Home) had their own sites block automated fetches, so those lean on secondary sources and are flagged as lower-confidence.

## SolarReviews.com

**Mechanism:** Lead-gen/lead-selling, explicitly disclosed. Their own FAQ: *"Our sole source of revenue is that approximately 1–2% of the people that use SolarReviews will wish to get competitive quotes from solar companies,"* sold to installers at **$18–$98 per lead** depending on location. Installers buy one of four exclusivity tiers (Exclusive/Duo/Trio/Quad — sold to 1–4 companies), no lock-in contracts.

**CTA placement:** A free "Solar Calculator" tool is the primary top-of-funnel hook, self-directing users toward a quote request before requiring contact info.

**Disclosure:** Explicitly states installers cannot pay for higher search-result placement or to suppress negative reviews.

Sources: solarreviews.com/faqs, solarreviews.com/company-registration

## Solar-Estimate.org

**Not an independent competitor** — same parent company as SolarReviews (Solar Investments Inc.); its About page redirects to solarreviews.com/about-us. Same lead-sell mechanism. Acquires traffic via Google Ads, Google Display, and Facebook.

Sources: solar-estimate.org/about-us (redirects), solar-estimate.org

## EnergySage.com — GridPermit's own existing partner, worth understanding as a case study

**Mechanism:** Two-sided marketplace — free to homeowners; **installers pay EnergySage to join the network and receive quote requests** (exact pricing not public).

**Editorial stance, directly relevant to GridPermit's own disclosure discipline:** EnergySage's own editorial guidelines state *"Neither EnergySage nor individual content creators will accept direct compensation from manufacturers, brands, or business partners in order to influence content."* This "no pay-for-play" framing, despite the business fundamentally depending on installer fees, is the same tension GridPermit's own disclosure language already navigates carefully (see `docs/AFFILIATE_PARTNER_PIPELINE.md`'s disclosure work).

Sources: energysage.com/about-us/company/, energysage.com/installers/, energysage.com/editorial-guidelines/

## Modernize.com (QuinStreet) — lower confidence, direct site fetch blocked (403)

QuinStreet's own 10-K (SEC EDGAR) describes the group-wide model as **cost-per-lead / cost-per-click / performance-based pricing** paid by advertisers for qualified leads, inquiries, or calls. Modernize sells shared leads (up to ~4 contractors per lead, national average ~1.5) plus a pricier exclusive option, acquired via paid search, display ads, and content marketing/cost calculators.

Sources: SEC EDGAR 10-K (qnst-10k_20180630.htm), prnewswire.com (QuinStreet/Modernize acquisition release) — Modernize's own site returned 403 to automated fetch, so this section is secondary-sourced; a manual browser check is recommended before quoting it as primary.

## Forbes Home — lower confidence, direct site fetch blocked (403)

Dual model per its own Advertiser Disclosure (retrieved via search-result excerpt, not direct fetch): **(a) paid placement** — advertisers pay for position on comparison pages, and **(b) affiliate links** embedded in editorial articles. States compensation "does not influence the recommendations or advice" given.

Sources: forbes.com/advisor/advertiser-disclosure/ (excerpt) — recommend a manual check before quoting verbatim.

## What this means for GridPermit's own model

Every player in this space monetizes the same underlying way: **selling homeowner intent (leads) to installers/contractors**, either exclusively or shared 2–4 ways, with free tools (calculators, cost estimators) as the acquisition hook and SEO/content as the channel — not display ads, not subscriptions. GridPermit's existing model (a single referral link into EnergySage's own version of this same marketplace) is the smallest, lowest-risk version of the pattern everyone else in this space runs at scale. Forbes Home is the one outlier blending affiliate/paid-placement rather than owning lead capture directly — closer in shape to what GridPermit's `InstallerCTA.astro` already does than the lead-marketplace model is.

**Pattern worth naming explicitly:** both EnergySage and SolarReviews foreground "no pay-for-play, editorial independence" language even though their entire revenue depends on the installers being reviewed/listed. GridPermit's current disclosure ("GridPermit has a partner relationship with EnergySage; whether this results in compensation has not yet been confirmed") is more conservative than either of them — worth keeping in mind as a deliberate choice, not an oversight, the next time disclosure language gets revisited.

**Nothing here changes GridPermit's current strategy** — this confirms the existing single-partner-referral model (per `docs/MONETIZATION_STRATEGY.md`) is the right-shaped first step relative to the rest of the market, not an underpowered one.
