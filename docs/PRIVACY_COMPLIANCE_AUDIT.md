# Privacy / Compliance Audit

Last reconciled: 2026-08-26

This is an implementation audit, not legal advice. It separates current truthful site behavior from disclosures that should be added only when a specific monetization mechanism actually launches.

## Currently accurate

- GridPermit does not collect homeowner name, email or phone in its calculator flow.
- Existing analytics helpers sanitize known PII-shaped keys before emission.
- Current third-party-link language is generic and does not claim every outbound relationship is compensated.
- Current terms correctly allow for commercial relationships without asserting that every link is tracked.
- No GridPermit monetization partner is currently production-active in the partner registry.

## Add only when CompareSolarPrices launches

The same activation commit that exposes the CompareSolarPrices paid-referral CTA should add a short factual privacy disclosure stating that:

- a fresh random click identifier (`cid`) is generated for each outbound referral click;
- the identifier is not derived from name, email, address, phone or other homeowner identity data;
- the same identifier is sent to CompareSolarPrices and recorded in GridPermit analytics for referral/conversion reconciliation;
- it is not stored by GridPermit in a cookie, localStorage or sessionStorage;
- data handling after the visitor leaves GridPermit is governed by the destination site's own policies.

Do not describe this mechanism before it is live, because that would make the privacy page inaccurate in the opposite direction.

## Add only when a pay-per-call partner launches

- Add the partner-required call-recording / quality-compliance disclosure at the CTA.
- Add a concise sitewide privacy mention if calls from GridPermit pages may be recorded.
- If a partner supplies mandatory wording, preserve that wording rather than paraphrasing it.

## Add only when a hardware affiliate launches

- Existing generic referral-fee language is likely sufficient for the basic relationship disclosure.
- Name the active affiliate platform only if doing so is factually useful and accurate at launch.

## Open legal judgment calls

- Whether GridPermit's GA4 configuration creates consent-banner obligations for particular jurisdictions is a legal question, not resolved by this engineering audit.
- Whether a random, per-click, non-PII referral CID has any jurisdiction-specific privacy classification beyond ordinary analytics/referral attribution is also a legal question. The architecture minimizes identity linkage but does not claim a legal conclusion.

## Non-negotiable implementation rule

Privacy and disclosure text must never describe tracking, compensation, call recording or partner data flows more strongly than the production code and partner state actually support.
