# CompareSolarPrices activation runbook

Status: **STAGED, NOT LIVE**

This document is the implementation companion to GitHub issue #5. It does not authorize production traffic by itself.

## Directly confirmed commercial terms

- $25 per qualified quote request.
- $200 per funded installation conversion.
- Southern California service area.
- Click-to-quote attribution window: 30 days.
- Once the GridPermit referral is attached to a lead, the later installation conversion has no stated time limit.
- One referral payout per address; addresses already known to CompareSolarPrices before the referral click do not qualify.
- $25 lead payouts for Eyal Haimovich are monthly with a $100 accumulated minimum, rolling over until the threshold is met.
- $200 conversion payouts remain payable as funded installations are paid to CompareSolarPrices.
- PayPal selected for payment setup.
- W-8BEN accepted by CompareSolarPrices for Eyal Haimovich as the non-U.S. individual payee.

## Referral-link contract

Every referral click must use:

- `ref=GridPermit`
- a fresh unique `cid` generated for that click
- `cid` containing only letters, numbers, dashes and underscores
- `cid` no longer than 32 characters
- no name, email, address, phone number or other personal data in `cid`

Example structure only:

`https://www.comparesolarprices.net/solar-irvine-ca/?ref=GridPermit&cid=UNIQUEVALUE`

`src/lib/compare-solar-prices.ts` implements the contract. It generates a 24-character cryptographically random hexadecimal `cid` and deep-links only to cities explicitly represented by CompareSolarPrices' own Southern California service-area material. Unknown cities fail closed rather than sending potentially out-of-area traffic.

## Placement/compliance rules

Any live placement must:

- disclose the paid referral relationship near the CTA
- not state savings figures, prices or timelines on CompareSolarPrices' behalf
- not imply GridPermit is the installer
- not use paid search on CompareSolarPrices brand terms or close variants
- not use purchased-list bulk email or SMS
- preserve user-initiated navigation to CompareSolarPrices

The staged `CompareSolarPricesCTA.astro` follows those copy constraints and uses the existing `cpl_cta_viewed` / `cpl_cta_clicked` analytics taxonomy.

## Production activation gate

Do **not** import `CompareSolarPricesCTA.astro` into `LocalityGuideLayout.astro` or any production page until all of these are true:

1. Aaron confirms the exact PayPal account detail needed and payment setup is complete.
2. Eyal completes and sends the W-8BEN.
3. The staged tests and full repository test/build checks pass.
4. The implementation is reviewed to confirm no out-of-area city is eligible.
5. A real outbound click test confirms `ref=GridPermit` and a fresh compliant `cid` arrive at the correct partner landing page. Do not submit a fake quote request or fake homeowner lead during testing.
6. Only after the above, reconcile `docs/MONETIZATION_CANONICAL_STATE.md` and `src/lib/partners.ts` together before enabling production monetization.

## Current staged files

- `src/lib/compare-solar-prices.ts`
- `src/components/CompareSolarPricesCTA.astro`
- `tests/compare-solar-prices.test.mjs`

The production locality layout intentionally has no reference to the staged component. The regression test enforces that fail-closed state.
