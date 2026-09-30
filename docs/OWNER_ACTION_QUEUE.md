# Owner Action Queue

Last reconciled: 2026-08-29

Only items that genuinely require Eyal (login, password, KYC, tax/bank data, CAPTCHA, or a judgment call an agent cannot make). Anything an agent can execute directly is not listed here; check `docs/MONETIZATION_CANONICAL_STATE.md` for those items instead.

## NEW 2026-08-29 — Impact.com applications ready (account already exists — used for Wix/Omnisend/Miloosh affiliate programs)

An Impact.com publisher login already exists. These three battery-affiliate partners each confirmed fit directly by email and handed over a real, ready application link. Applying just needs the existing Impact login + a few clicks per campaign — no new account creation:

12. **Renogy** — 6% confirmed, 27-day cookie. Apply: https://app.impact.com/campaign-campaign-info-v2/Renogy-Affiliate-Program.brand?io=pab7E7wnxDVFhAMwUbltHXy4s6RaXfepie6KwlhnLsSFwoeW2Jx02HnO%2FS6ryTQf — then reply to Yuna (renogy.affiliate@renogy.com) confirming submission so she expedites approval.
13. **BougeRV** — 7% confirmed. Apply: https://app.impact.com/campaign-campaign-info-v2/BougeRV.brand
14. **LiTime** — 5% base (8-10% at volume), 30-day cookie. Apply: https://app.impact.com/campaign-campaign-info-v2/LiTime-US.brand

## NEW 2026-08-29 — ALLPOWERS via CJ

15. ALLPOWERS confirmed (Bei Li, marketing@allpowers.com) they're moving affiliate management to CJ or GoAffPro and gave their CJ advertiser ID: **7797916**. Since the GridPermit CJ publisher account is already active, log into CJ and search/apply to advertiser 7797916 directly (same account already used for the EnergySage application review above).

## NEW 2026-08-29 — Digital Master Media (DMM) publisher agreement

16. Abid Ali sent the actual sign-up/publisher-agreement link (digitalmastermedia.com/offers) and clarified the anti-fraud buffer logic (blocks non-US callers pretending to be US callers by accent — not an ethnicity/national-origin filter; confirmed no discriminatory targeting requested). The publisher application includes binding terms + signature — read the agreement and submit only if terms are acceptable. See `docs/MONETIZATION_CANONICAL_STATE.md` for the full thread summary.

## CORRECTED 2026-08-29 — CompareSolarPrices is already live; only the W-8BEN remains

Earlier entries here (and in `MONETIZATION_CANONICAL_STATE.md`) incorrectly said this was not live. That was checked against the wrong city (Santa Monica, which isn't eligible) and a local git branch that predates the real deployed commit — the actual production code lives in a commit only on GitHub, unreachable locally because the GitHub account is suspended (see audit, 2026-08-29). Verified directly against production: the CTA is live and correct on Irvine (and presumably the rest of the 75-city allowlist).

17. **W-8BEN** (tax form, individual payee since Aaron pays Eyal personally, not GridPermit as an entity) — the only remaining action. File already prepared at `~/Downloads/W-8BEN_Eyal_Haimovich_filled.pdf`. Send it to Aaron so he can process payouts once the $100 accumulated minimum is reached. This does not block the already-live CTA.

## CJ / EnergySage activation

1. Log into CJ (members.cj.com) and open **Account Settings**, not the Advertisers view.
2. Check whether "Complete Your Network Profile" shows as done, and whether an explicit "Activate Account" button is present and unclicked.
3. If the account is genuinely stuck, file the CJ Support ticket. The ready-to-send message (no bank/routing/TIN/Payoneer sensitive data) and submission path (support center or 800-761-1072) are prepared in `docs/CJ_ACTIVATION_ESCALATION.md`.

## Digital Master Media (DMM) follow-up

4. Reply to Abid Ali's thread requesting the 7 remaining items (GridPermit-specific payout, tracking number, setup instructions, ZIP recommendations, exact IVR logic, disclosure wording, final agreement). See GitHub issue #1.

## Account creation (password required, agent cannot do this)

5. Redodo: create a GoAffPro account at redodopower.goaffpro.com.
6. LiTime: create a GoAffPro or Impact account (route not yet chosen, confirm via reply first if outreach lands).
7. Any hardware-affiliate candidate that replies with approval and asks for account setup with a password.

## Application review only (no action needed unless a decision is required)

8. Review any incoming reply from: ALLPOWERS, BLUETTI, EcoFlow, Power Queen, EASUNPOWER, Vatrer Power, RICH SOLAR, Profitise, FlexOffers, BigBattery. If a reply asks for tax/bank/legal-entity information, that step is owner-only; do not let an agent fill it in.

## Contracts and terms (review only, no autonomous acceptance)

9. Any partner agreement, terms-of-service click-through, or compliance document that arrives from DMM, CJ, or any hardware-affiliate program must be reviewed by the owner before acceptance. Agents may summarize terms but must not click "I agree" or submit binding acceptance.

## Pending owner-only judgment calls

10. Bark.com: decide whether to try the unconfirmed, untested pro@bark.us direct contact (Awin-only route otherwise, permanently blocked).
11. Whether to pursue EnergySage's direct partner registration form at energysage.com/partner/register/, which requires owner-supplied identity/contact information.

## Explicitly NOT on this list (agents can already do these)

- Sending outreach emails using the templates in `docs/PARTNER_OUTREACH_TEMPLATES.md`.
- Updating `src/lib/partners.ts` and `docs/MONETIZATION_CANONICAL_STATE.md` when a reply arrives.
- Building/testing monetization components (already done, inactive).
- Running tests, `astro check`, and the production build.

## NEW 2026-09-09 — HPH Solutions referral agreement

18. **HPH Solutions referral program** — economics and terms verified in `docs/HPH_REFERRAL_EVALUATION_2026-09-09.md`. Current published fees are $20 residential drafting, $40 residential solar design, 5% commercial design (50 kW–1 MW), with a 12-month referral-attribution window. The agreement also contains a **12-month non-circumvention clause** for referred customers at the same property/job site. This is a binding agreement and must be reviewed/accepted by the owner; agents must not type/sign the legal acceptance. No referral CTA should be activated until the agreement is countersigned and attribution instructions are confirmed.