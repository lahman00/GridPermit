# Monetization Placement Map

Last reconciled: 2026-08-26

Maps every current GridPermit page type to what it is allowed to monetize with, once a route clears the canonical approval, tracking, compliance and launch gates in `docs/MONETIZATION_CANONICAL_STATE.md` and `src/lib/partners.ts`.

This document controls **placement eligibility**, not partner activation. No documentation entry can create approval, fabricate tracking, enable a launch switch, or override the machine-readable partner registry.

## Current production fact

**CompareSolarPrices is production-active** for the explicitly maintained Southern California locality allowlist.

The direct commercial and payment-method gate is complete: the approved route uses `ref=GridPermit` plus a fresh random 24-character non-PII CID on every real click, PayPal is confirmed, and the required paid-referral disclosure is rendered next to the CTA. W-8BEN remains a later administrative tax-file follow-up and is **not** a launch blocker.

No other monetization route is currently production-active. In particular, the broader EnergySage destination remains plain and untracked until advertiser approval and a real attributable CJ link exist.

## High intent

### Locality guide (`src/layouts/LocalityGuideLayout.astro`, approximately 341 pages)

- Primary monetization: one solar CPL route selected first by verified service-area fit and only then by economics.
- CompareSolarPrices: production-active only when both gates pass:
  1. the partner registry returns a launch-ready CompareSolarPrices CPL partner; and
  2. the California city matches the maintained Southern California service-city allowlist.
- CompareSolarPrices destination: generate the verified city deep link only through `src/lib/compare-solar-prices.ts`; unknown cities and non-California localities fail closed.
- CompareSolarPrices attribution: generate a fresh cryptographically random 24-character CID on every real outbound click. Never derive the CID from name, email, address, query text, user ID, IP address or any other personal data.
- CompareSolarPrices disclosure: state the paid referral relationship, do not quote savings, prices, approval odds or timelines on the partner's behalf, and do not imply that GridPermit is the installer.
- EnergySage fallback: noneligible localities may retain the existing plain root destination as a non-attributable external option. It is not an earning link and must not be described as an approved or compensated referral while `trackingEnabled=false`.
- Pay-per-call: a partner such as DMM may be tested only after separate campaign approval, exact payout/qualification/geo/hours, a real tracking number and final compliance/disclosure rules exist. Do not stack a pay-per-call CTA with a CPL CTA on the same page.
- Hardware affiliates: forbidden. A locality-guide reader is researching jurisdictional permit requirements, not shopping for equipment.
- CTA position: after the primary permit information and official contacts, before the footer disclaimer. Do not move monetization above the content the reader came to use.
- Maximum CTA density: one commercial CTA per page.
- Analytics: `cpl_cta_viewed` and `cpl_cta_clicked`, preserving partner, page, state and locality dimensions without PII.

### State hub (`src/pages/[state]/index.astro`)

- Primary: a broad-coverage solar CPL only after the partner is approved and the represented geography is eligible.
- CompareSolarPrices: forbidden on the statewide California hub while its documented service area is Southern California only.
- Hardware affiliate and pay-per-call: forbidden.
- CTA position: none today. A future placement may be one low-density banner only.
- Maximum CTA density: one optional CTA.
- Disclosure and analytics: use the same CPL state machine and view/click events as locality guides.

### County hub / utility hub (`src/pages/california/county/[slug].astro`, `src/pages/california/utility/[slug].astro`)

- Primary: solar CPL only when the entire represented geography is documented as eligible or the user can be routed to an eligible locality before click-out.
- CompareSolarPrices: no default placement because counties and utility territories can span supported and unsupported localities.
- Hardware affiliate and pay-per-call: forbidden.
- CTA position: none today. Any later addition must remain below the primary directory or utility information.
- Maximum CTA density: one optional CTA.

### California solar/battery hub pages (`california/index.astro`, `california/solar-permit-guides.astro`, `california/solar-permit-timeline.astro`)

- Primary: broad-coverage solar CPL only.
- CompareSolarPrices: no placement while coverage remains Southern California-specific and the page itself is statewide.
- Hardware affiliate and pay-per-call: forbidden.
- CTA position: none today.

## Medium intent: current blog inventory

The current content collection contains five posts. Treat them by their actual reader intent rather than applying a generic "battery article" rule to all of them.

### PG&E Solar Billing Plan guide (`src/content/blog/pge-nem3-calculator.md`)

- Intent: utility tariff, export-credit and project-evaluation research.
- Allowed future monetization: at most one approved broad-coverage solar CPL.
- CompareSolarPrices: forbidden because the article covers PG&E territory broadly, including locations outside the verified Southern California service area.
- Generic hardware affiliate: forbidden. The article does not recommend or compare a specific purchasable product.
- Pay-per-call: forbidden.
- Existing EnergySage link: plain and untracked until a real approved attributable route exists.

### SCE Solar Billing Plan guide (`src/content/blog/sce-guide.md`)

- Intent: utility tariff, export-credit and storage-evaluation research.
- Allowed future monetization: at most one approved solar CPL whose geography covers the relevant SCE audience.
- CompareSolarPrices: do not place merely because SCE serves Southern California. The article is utility-wide and can reach unsupported localities; locality-level eligibility is not known from the page alone.
- Generic hardware affiliate and pay-per-call: forbidden.
- Existing EnergySage link: plain and untracked until advertiser approval/tracking exists.

### SDG&E Solar Billing Plan guide (`src/content/blog/sdge-guide.md`)

- Intent: utility tariff, export-credit and storage-evaluation research.
- Allowed future monetization: at most one approved solar CPL whose geography covers the represented audience.
- CompareSolarPrices: no default placement. A utility-wide page is not equivalent to a verified city allowlist match.
- Generic hardware affiliate and pay-per-call: forbidden.

### California SGIP guide (`src/content/blog/sgip-battery-rebates-california.md`)

- Intent: incentive eligibility, program availability and installer/application research.
- Allowed future monetization: at most one approved broad-coverage solar-plus-storage CPL.
- Hardware affiliate: forbidden. SGIP eligibility and reservation rules cannot be reduced to an equipment-shopping click.
- Pay-per-call: forbidden.
- Existing EnergySage link: plain and untracked until advertiser approval/tracking exists.

### Powerwall 3 vs. Enphase IQ Battery 5P (`src/content/blog/tesla-powerwall-3-vs-enphase-iq5p.md`)

- Intent: named-product and system-design comparison.
- Preferred future monetization: exact-product affiliate links only when the approved advertiser/retailer route actually commissions the discussed Tesla Powerwall 3 or Enphase IQ Battery 5P product and a real deep link exists.
- Do not insert an unrelated generic battery brand merely because another hardware program offers a higher commission.
- Maximum hardware density: one link per named product already discussed in the article, with a single common disclosure; do not add a product carousel or unrelated alternatives without a separately reviewed editorial expansion.
- Alternate future monetization: one approved solar/battery installer CPL when exact-product affiliate routes do not exist. Never run the hardware and CPL choices simultaneously without an explicitly approved and separately measured experiment.
- CompareSolarPrices: no default placement because the post is statewide/general and does not establish a supported city.
- Pay-per-call: forbidden.
- Existing EnergySage link: plain and untracked until advertiser approval/tracking exists.

### Blog index (`src/pages/blog/index.astro`)

- Primary: none. It is a directory page.
- Any affiliate, CPL or pay-per-call CTA: forbidden. Individual posts carry their own intent-appropriate decision.

## Low / no monetization

### `methodology.astro`, `about.astro`, `contact.astro`, `privacy.astro`, `terms.astro`, `404.astro`, `how-it-works.astro`, `permits.astro`, `search.astro`, `pro.astro`

- Primary and secondary monetization: none.
- Any partner CTA: forbidden.
- Only the site-wide footer disclosure applies.
- `pro.astro` is GridPermit's own coming-soon product page, not a third-party partner surface.

## Conversion and attribution rules

- Preserve one commercial decision per page. Do not force visitors to choose among competing quote partners in the same viewport.
- Route by documented service-area and page-intent eligibility first, economics second. A higher payout never overrides geography, editorial fit or compliance.
- Every attributable click must retain partner and page context and, where supported, non-PII locality/sub-ID/CID dimensions.
- Never place personal data into affiliate sub-IDs, CIDs, UTMs, analytics labels, client-side logs or referral destinations.
- Do not fire a click conversion on render; view and click events remain distinct.
- Never manufacture quote requests, forms, calls, appointments or homeowner submissions to test tracking. Outbound verification stops before consumer-data submission unless a partner provides a documented sandbox.
- A public affiliate root URL is not a tracking asset. Tracking becomes enabled only after approval and issuance or verified generation of an attributable destination.
- Any conversion experiment must preserve the SEO freeze: no monetization-driven title, description, H1, canonical, robots, sitemap, URL or locality-architecture change.

## Cross-cutting production gates

- Never place two different partners' CTAs of the same channel on one page.
- Never place a monetized CTA above the primary informational content.
- Every monetized CTA must carry the appropriate `data-track-view` and `data-track-click` instrumentation from `src/lib/analytics-events.ts`.
- Disclosure text comes from verified partner state or a stricter documented partner-specific requirement; do not invent promotional copy or compensation claims.
- No hardware affiliate appears in production until advertiser approval, exact commission/attribution, a real product or category tracking link, promotional restrictions and deliberate launch enablement are all documented.
- No pay-per-call CTA appears until campaign approval, exact payable-call criteria, geo/hours, a real tracking number and applicable recording/consent language are documented.
- No partner becomes production-active from documentation alone. `src/lib/partners.ts` remains fail closed unless approval-like status, real tracking, placement eligibility and the independent launch switch all agree.
