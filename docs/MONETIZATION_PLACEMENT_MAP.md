# Monetization Placement Map

Last reconciled: 2026-08-26

Maps every current GridPermit page type to what it is allowed to monetize with, once a route clears the launch gate in `docs/MONETIZATION_CANONICAL_STATE.md`. Nothing here activates anything: it is the rule set a future implementation pass must follow so monetization never spreads beyond intent-appropriate pages. `eligiblePageTypes` on each `src/lib/partners.ts` record uses the same page-type vocabulary as this doc.

## High intent

### Locality guide (`src/layouts/LocalityGuideLayout.astro`, ~341 pages)
- Primary monetization: one solar CPL route selected by verified service-area fit. CompareSolarPrices is the preferred staged route for eligible Southern California localities once its payment/tax and launch gates clear. EnergySage can remain the broader fallback only after its own advertiser approval and tracking gate clear.
- Pay-per-call: DMM may be tested later only after its separate campaign/tracking/compliance gate clears. Do not stack a pay-per-call CTA with a CPL CTA on the same page.
- Secondary monetization: none. Do not add a second competing CTA on the same page.
- Forbidden: hardware affiliate links (wrong intent; reader is mid-permit-research, not shopping for equipment).
- CTA position: after Official Contacts, before the footer disclaimer (existing `InstallerCTA.astro` placement). Do not move monetization above the primary permit information.
- Maximum CTA density: one monetized CTA per page.
- Partner selection must fail closed. A locality gets a partner only when the locality is inside that partner's documented service area. A state-wide or name-only match is insufficient.
- For CompareSolarPrices specifically: only California locality guides that match the maintained Southern California service-city allowlist are eligible. Non-California pages and unknown California localities must render no CompareSolarPrices CTA.
- CompareSolarPrices deep links should use the matching city landing page where a verified mapping exists; otherwise use no CompareSolarPrices placement rather than guessing a URL.
- CompareSolarPrices must generate a fresh non-PII `cid` on every outbound click. Never derive `cid` from name, email, address, query text, user ID, IP address, or other personal data.
- CompareSolarPrices copy must disclose the paid referral relationship, must not quote savings/prices/timelines on the partner's behalf, and must not imply GridPermit is the installer.
- Disclosure pattern: CPL state machine (`getCplState`/`getCplDisclosureText`) for general CPL. A partner-specific required disclosure may be rendered only when it is stricter and still factually accurate.
- Analytics event: `cpl_cta_viewed` / `cpl_cta_clicked` for tracked CPL. Preserve partner, page and locality dimensions without PII.

### State hub (`src/pages/[state]/index.astro`)
- Primary: broad-coverage solar CPL only, matching the locality guides it lists.
- CompareSolarPrices: forbidden on a statewide California hub while its documented service area is Southern California only. Do not expose an offer to visitors outside its coverage merely because the page is California-related.
- Secondary: none.
- Forbidden: hardware affiliate, pay-per-call (this is a directory page, not a high-intent single-city page).
- CTA position: none today; if added, a single low-density banner only.
- Maximum CTA density: one, optional.
- Disclosure pattern: same CPL state machine.
- Analytics event: `cpl_cta_viewed`/`cpl_cta_clicked` if added.

### County hub / Utility hub (`src/pages/california/county/[slug].astro`, `src/pages/california/utility/[slug].astro`)
- Primary: solar CPL only when the entire represented geography is known to fall inside the partner's approved service area or routing can be made locality-specific before click-out.
- CompareSolarPrices: do not place by default because a county/utility can span supported and unsupported localities. Require explicit verified coverage before any future placement.
- Secondary: none.
- Forbidden: hardware affiliate, pay-per-call.
- CTA position: none today; same rule as state hub if added later.
- Disclosure pattern: same CPL state machine.
- Analytics event: `cpl_cta_viewed`/`cpl_cta_clicked` if added.

### California solar/battery hub pages (`california/index.astro`, `california/solar-permit-guides.astro`, `california/solar-permit-timeline.astro`)
- Primary: broad-coverage solar CPL only.
- CompareSolarPrices: no placement while coverage remains Southern California-specific and the page itself is statewide.
- Secondary: none.
- Forbidden: hardware affiliate, pay-per-call.
- CTA position: none today.
- Disclosure pattern: same CPL state machine.

## Medium intent

### Battery/backup-power blog posts (`src/pages/blog/*.astro`, `src/content/blog/*.md`)
- Primary monetization: hardware affiliate (Renogy/BougeRV/ALLPOWERS/BLUETTI/EcoFlow/Power Queen/Redodo/EASUNPOWER/etc., whichever clears its approval and tracking gates first).
- Secondary monetization: solar CPL only on posts substantively about a solar-plus-battery purchase decision, never both a hardware CTA and a CPL CTA on the same post unless a later experiment is explicitly approved and separately measured.
- Forbidden: pay-per-call (blog readers are researching, not requesting a callback).
- CTA position: inline after the relevant product-comparison or decision section, not at the top of the article.
- Maximum CTA density: one hardware-affiliate CTA per post; two only if genuinely comparing two named products already discussed in that post's own text.
- Disclosure pattern: standard tracked-affiliate disclosure (`ProductAffiliateCTA.astro` via `getDisclosureText`).
- Analytics event: `affiliate_cta_viewed`/`affiliate_cta_clicked`.

### Blog index (`src/pages/blog/index.astro`)
- Primary: none (directory page).
- Forbidden: any CTA. Let individual posts carry their own.

## Low / no monetization

### `methodology.astro`, `about.astro`, `contact.astro`, `privacy.astro`, `terms.astro`, `404.astro`, `how-it-works.astro`, `permits.astro`, `search.astro`, `pro.astro`
- Primary: none.
- Secondary: none.
- Forbidden: any partner CTA (affiliate, CPL, or pay-per-call).
- CTA position: n/a.
- Disclosure pattern: only the site-wide footer disclosure applies.
- Analytics event: none partner-specific.

`pro.astro` is GridPermit's own "coming soon" product page, not a third-party partner surface; it stays out of scope for partner monetization regardless of intent level.

## Conversion and attribution rules

- Preserve one commercial decision per page. Do not make visitors choose among competing quote partners in the same viewport.
- Route by documented eligibility first, economics second. A higher payout never overrides service-area or compliance rules.
- Every click-out must be attributable at partner + page + locality level where the partner supports a non-PII sub-ID/CID.
- Never place personal data into affiliate sub-IDs, CIDs, UTMs, analytics event labels, or client-side logs.
- Do not fire a click conversion event on CTA render; view and click events remain distinct.
- Do not manufacture form submissions, quote requests, calls, or test leads to verify tracking. Outbound-link verification stops before any consumer form submission unless a partner provides a documented sandbox/test path.
- Any future conversion experiment must preserve the existing SEO freeze: no monetization-driven changes to title/meta/H1/canonical/robots/sitemap/locality architecture.

## Cross-cutting rules

- Never place two different partners' CTAs of the same channel on one page.
- Never place a monetized CTA above the primary informational content a reader came for.
- Every monetized CTA must carry a `data-track-view`/`data-track-click` pair from `src/lib/analytics-events.ts`.
- Disclosure text is always generated from partner state (`getDisclosureText`/`getCplDisclosureText`) or from a stricter documented partner-specific disclosure requirement; never hand-write promotional claims per placement.
- No partner becomes production-active from documentation alone. Real approval, a real tracking asset, verified commercial terms, compliance review, and the deliberate launch switch are all required.