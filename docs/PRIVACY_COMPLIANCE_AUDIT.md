# Privacy / Compliance Audit

Last reconciled: 2026-08-26

Reviews `src/pages/privacy.astro`, `src/pages/terms.astro`, and the site's outbound-tracking/disclosure architecture against the current monetization pipeline. This is a review, not a rewrite: it separates what's already accurate today from what will need a specific, factual addition the moment a specific partner type actually launches. Nothing in this document should be read as legal advice; where a genuine legal judgment call exists, it's flagged as such rather than resolved here.

## Currently accurate (no change needed)

- `privacy.astro` correctly states the calculator requires no name/email/phone, describes ZIP/bill-spend as browser-processed calculator inputs, and correctly describes the analytics helper's PII-stripping behavior (`sanitizeAnalyticsParams` in `src/lib/analytics-events.ts` does in fact strip zip/bill/name/email/phone/address keys — this is a true, verifiable claim, not aspirational).
- `privacy.astro`'s Analytics section correctly describes GA4 usage in general terms without overclaiming what's tracked.
- `privacy.astro`'s Third-Party Links section is appropriately generic ("solar marketplaces and product providers... under their own privacy policies") and does not claim a compensated relationship that doesn't exist.
- `terms.astro`'s "Third-Party Referrals and Commercial Relationships" paragraph is accurately hedged: it says relationships "may be commercial" and that a link "should not be assumed to be tracked or compensated unless the page specifically discloses that fact" — this is true of every current outbound link on the site (EnergySage is untracked/unconfirmed compensation; nothing else is live).
- The site sets no cookies of its own beyond what GA4's own script manages; there is no GridPermit-side tracking cookie, session identifier, or fingerprinting mechanism today.

## Additions needed only when a specific partner type actually launches

Do not add these now — adding them today would describe practices that don't yet exist, which is exactly as inaccurate as omitting them once they do. Each should be added in the same commit that actually activates that partner type.

### When CompareSolarPrices (or any CID-based CPL partner) launches
- `privacy.astro` should add a short paragraph describing that a random, non-personally-identifying click identifier (the CID) is generated at the moment of an outbound referral click, sent to the partner in the URL, and recorded in GridPermit's own analytics for revenue-attribution matching — and that it is not derived from or linked to any personal information, is not stored in a cookie or local storage, and exists only for that single click.
- Confirm the specific partner's own privacy policy is what governs data handling after the user leaves GridPermit (the existing generic Third-Party Links paragraph already covers this, so likely no change needed there beyond the CID description above).

### When Digital Master Media (or any pay-per-call partner) launches
- `privacy.astro` and/or the CTA's own on-page disclosure should state that calls may be recorded for quality/compliance purposes (the CTA-level disclosure in `PayPerCallCTA.astro` already does this generically via `getDisclosureText()`; the sitewide privacy policy should add a matching short mention once any call CTA is actually live, so the practice is disclosed at the site level too, not only at the point of the button).
- If a specific partner's compliance team supplies exact required consent wording (as DMM's own final terms may), use that exact wording rather than paraphrasing it — see `docs/DISCLOSURE_TAXONOMY.md`.

### When any hardware-affiliate partner (Renogy, BougeRV, ALLPOWERS, etc.) launches
- `terms.astro`'s existing "may earn referral fees" language already covers this generically; no new paragraph is strictly required, but consider naming the specific active network(s) (e.g. "some links use the Impact or GoAffPro affiliate platforms") if and when a specific integration goes live, since that's a factual detail a privacy-conscious reader may want.

## Legal judgment calls flagged, not resolved

- Whether GDPR/UK-GDPR-style consent-banner obligations apply to GA4 usage for GridPermit's specific audience mix is a legal question this audit does not attempt to answer. The current privacy policy describes GA4 usage but does not implement a cookie-consent banner. This is unchanged by the monetization work in this pass and is flagged for owner/legal judgment, not decided here.
- Whether any specific state's (e.g. California's CCPA/CPRA) "sale of personal information" framing could apply to a CID-based, non-PII click-attribution mechanism is a plausible-sounding question but not one this document resolves. The mechanism as designed (a random value with no PII linkage, generated fresh per click, never stored) is built to minimize that risk, not to guarantee a specific legal conclusion.

## What was explicitly not done

- No legal claims were invented to make the site "sound compliant." Every accuracy claim above was verified against the actual code (`sanitizeAnalyticsParams`, `compare-solar-prices.ts`'s CID generation, `getDisclosureText()`), not assumed.
- No consent-banner, cookie-management, or legal-certification code was added. That remains an owner/legal decision if it's ever judged necessary.
