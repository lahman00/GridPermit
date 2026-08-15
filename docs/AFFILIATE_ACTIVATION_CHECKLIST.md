# Affiliate Activation Checklist

Written 2026-08-15. Use this the moment CJ Affiliate / FlexOffers approves GridPermit's EnergySage application. It exists so activation is a 15-minute mechanical task, not a research project, when that day comes. No secrets live in this repo or this file — only where things go.

**Current state (as of this writing):** `src/components/InstallerCTA.astro` links plainly to `https://www.energysage.com` with an explicit "GridPermit does not currently have an affiliate relationship with EnergySage and earns no compensation from it" disclosure. This is the deliberate, honest fallback per `docs/MONETIZATION_STRATEGY.md` Section 7 — do not touch it until approval actually arrives.

## 1. Where the affiliate ID/URL goes

- **File:** `src/components/InstallerCTA.astro` — the single component used by every locality guide page (one edit point, not 341).
- Replace the plain `href="https://www.energysage.com"` with the real tracked CJ Affiliate / FlexOffers referral URL.
- Check `src/pages/index.astro` for any second EnergySage link in the homepage's secondary calculator section (the ZIP-code result flow) — confirm whether it needs the same swap or intentionally stays a plain link.
- **Do not** hardcode the tracking ID inline if CJ/FlexOffers issues it as a query parameter requiring rotation or expiry — if so, store it as a build-time environment variable (`PUBLIC_ENERGYSAGE_AFFILIATE_URL` or similar) read via `import.meta.env`, not committed to source. If it's a static permanent URL, a plain string in the component is fine — match whatever CJ actually issues.

## 2. Required env/config

- If CJ/FlexOffers issues a static permanent affiliate URL: no env var needed, just the URL string.
- If it issues a rotating/parameterized tracking link: add the variable to Netlify's site environment variables (Netlify dashboard, not this repo) and reference it via `import.meta.env.PUBLIC_...` in `InstallerCTA.astro`.
- Never commit the raw affiliate ID, tracking token, or any CJ/FlexOffers credential to git, even in a `.env.example` with a placeholder that looks real.

## 3. Link validation

- [ ] Click the new link locally (`npm run dev`, visit any locality guide, click "Compare quotes from solar installers →") and confirm it lands on EnergySage with the tracking parameter visible in the URL bar.
- [ ] Confirm the link still opens in a new tab (`target="_blank"`) with `rel="noopener noreferrer"` preserved — add `rel="sponsored"` alongside it per Google's paid-link guidelines, since this is now a compensated link.
- [ ] Spot-check 3–4 different locality pages (a CA page, a non-CA page, one recently-published page) to confirm the same component update propagated everywhere — it should, since it's one shared component, but verify rather than assume.

## 4. Disclosure verification

- [ ] Update the disclosure paragraph in `InstallerCTA.astro` — remove "does not currently have an affiliate relationship... earns no compensation" and replace with accurate, honest compensation language (e.g. "GridPermit may earn a referral fee if you get a quote through this link — this doesn't affect the price you pay."). Do not remove the disclosure entirely; disclosure is a legal requirement (FTC) and a trust signal, not optional boilerplate.
- [ ] Check `terms.astro` and `privacy.astro` for any "no compensation" / "currently... no tracking relationship" language describing the EnergySage link specifically — update those in the same commit so no page contradicts another.
- [ ] Check the homepage footer's affiliate-disclosure paragraph (`src/pages/index.astro`) for the same stale "no compensation" language.

## 5. Analytics verification

- [ ] Confirm `external_partner_clicked` still fires correctly on the updated link (the `data-track-click="external_partner_clicked"` attribute must survive the href swap — don't accidentally drop it while editing).
- [ ] In GA4 Realtime (or DebugView), click the link once in a staging/preview build and confirm the event lands with the correct event name and no new stray event names introduced.

## 6. Test click (production)

- [ ] After deploying, click the live link on `mygridpermit.com` from a real locality guide page (not localhost) and confirm the referral is tracked on the CJ/FlexOffers/EnergySage side (their dashboard should show a click within a few minutes).
- [ ] Confirm the click also appears in GA4 within the normal reporting delay.

## 7. Production verification

- [ ] Run the full existing pipeline before deploying: `npm test`, `astro check`, `npm run build`, `npm run seo-check`, `npm run data-quality-check`.
- [ ] After deploy, spot-check the same 3–4 locality pages from step 3 directly on production.
- [ ] Confirm no console errors introduced by the new link/tracking script (EnergySage or CJ may inject their own pixel/script on the destination page — that's their page, not GridPermit's, so no action needed there, but confirm GridPermit's own page has zero new console errors).

## What this checklist deliberately does NOT cover

Per explicit scope limits: this file does not touch Payoneer, banking, tax information, or account agreements — those remain the site owner's own action, outside any agent's authority, and are not part of "activation" in the sense used here. This checklist starts only after CJ/FlexOffers approval and a real, working affiliate URL already exist.
