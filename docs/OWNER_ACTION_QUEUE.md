# Owner Action Queue

Last reconciled: 2026-08-25

Only items that genuinely require Eyal (login, password, KYC, tax/bank data, CAPTCHA, or a judgment call an agent cannot make). Anything an agent can execute directly is not listed here; check `docs/MONETIZATION_CANONICAL_STATE.md` for those items instead.

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
