# Monetization Placement Map

Last reconciled: 2026-08-26

Maps every current GridPermit page type to what it is allowed to monetize with, once a route clears the launch gate in `docs/MONETIZATION_CANONICAL_STATE.md`. Nothing here activates anything: it is the rule set a future implementation pass must follow so monetization never spreads beyond intent-appropriate pages. `eligiblePageTypes` on each `src/lib/partners.ts` record uses the same page-type vocabulary as this doc.

## High intent

### Homepage (`src/pages/index.astro`)
- Primary monetization: solar CPL (EnergySage today), placed immediately after the illustrative ROI calculator's results.
- Secondary monetization: none.
- Forbidden: hardware affiliate, pay-per-call (this is a broad-audience entry page, not a single-locality high-intent page).
- CTA position: directly below the calculator's output, the moment a visitor has just seen an illustrative savings estimate. This is arguably the single highest-intent moment on the whole site, since the visitor has self-selected into "I want to know what solar could do for me" immediately beforehand.
- Maximum CTA density: one.
- Disclosure pattern: same CPL state machine as the locality guides.
- Analytics event: `external_partner_clicked` today, reclassify to `cpl_cta_clicked` once tracked.

### Locality guide (`src/layouts/LocalityGuideLayout.astro`, ~341 pages)
- Primary monetization: solar CPL (EnergySage today) or pay-per-call (DMM) once launch-ready.
- Secondary monetization: none. Do not add a second competing CTA on the same page.
- Forbidden: hardware affiliate links (wrong intent; reader is mid-permit-research, not shopping for equipment).
- CTA position: after Official Contacts, before the footer disclaimer (existing `InstallerCTA.astro` placement).
- Maximum CTA density: one monetized CTA per page.
- Disclosure pattern: CPL state machine (`getCplState`/`getCplDisclosureText`) for CPL; pay-per-call taxonomy for DMM.
- Analytics event: `external_partner_clicked` (CPL, reclassify to `cpl_cta_clicked` once tracked) or `pay_per_call_cta_viewed`/`pay_per_call_clicked`.
- **Considered and deliberately excluded:** every locality guide has its own "Battery/solar incentive program on record" section (`LocalityGuideLayout.astro`, sourced from `record.battery_programs`), which is a genuine battery-specific decision moment. It stays hardware-affiliate-free anyway: a reader here is mid-permit-research for their *city*, not shopping for a specific product, and a second CTA would break the one-CTA-per-page density rule below. If a locality's battery-incentive section is ever judged worth its own monetization, that requires a deliberate placement-map amendment, not an automatic addition just because the section exists.

### State hub (`src/pages/[state]/index.astro`)
- Primary: solar CPL, matching the locality guides it lists.
- Secondary: none.
- Forbidden: hardware affiliate, pay-per-call (this is a directory page, not a high-intent single-city page).
- CTA position: none today; if added, a single low-density banner only.
- Maximum CTA density: one, optional.
- Disclosure pattern: same CPL state machine.
- Analytics event: `cpl_cta_viewed`/`cpl_cta_clicked` if added.

### County hub / Utility hub (`src/pages/california/county/[slug].astro`, `src/pages/california/utility/[slug].astro`)
- Primary: solar CPL.
- Secondary: none.
- Forbidden: hardware affiliate, pay-per-call.
- CTA position: none today; same rule as state hub if added later.
- Disclosure pattern: same CPL state machine.
- Analytics event: `cpl_cta_viewed`/`cpl_cta_clicked` if added.

### California solar/battery hub pages (`california/index.astro`, `california/solar-permit-guides.astro`, `california/solar-permit-timeline.astro`)
- Primary: solar CPL.
- Secondary: none.
- Forbidden: hardware affiliate, pay-per-call.
- CTA position: none today.
- Disclosure pattern: same CPL state machine.

## Medium intent

### Battery/backup-power blog posts (`src/pages/blog/*.astro`, `src/content/blog/*.md`)
- Primary monetization: hardware affiliate (BLUETTI/EcoFlow/ALLPOWERS/Power Queen/Redodo/EASUNPOWER/etc., whichever clears first).
- Secondary monetization: solar CPL, only on posts that are substantively about solar+battery decisions (e.g. NEM 3.0 payback posts), never both on the same post.
- Forbidden: pay-per-call (blog readers are researching, not requesting a callback).
- CTA position: inline after the relevant product-comparison section, not at the top of the article.
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

## Cross-cutting rules

- Never place two different partners' CTAs of the same channel on one page.
- Never place a monetized CTA above the primary informational content a reader came for.
- Every monetized CTA must carry a `data-track-view`/`data-track-click` pair from `src/lib/analytics-events.ts`.
- Disclosure text is always generated from partner state (`getDisclosureText`/`getCplDisclosureText`), never hand-written per placement.
