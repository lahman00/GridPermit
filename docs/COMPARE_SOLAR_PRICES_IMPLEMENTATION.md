# CompareSolarPrices implementation and activation runbook

Current source review: 2026-09-30. Production activity must be independently verified; a passing city helper is not an activation receipt.

## Runtime contract

- Canonical partner configuration and verification: `data/commercial/partners/compare-solar-prices.json` and its referenced verification.
- User-initiated POST to the first-party `/go/compare-solar-prices` handler, carrying only an anonymous CID, approved page path and qualification confirmation.
- Partner destination: `https://www.comparesolarprices.net/#quote`, retaining `ref=GridPermit` and fresh anonymous CID.
- No GridPermit collection of a homeowner name, phone number, address or utility bill.
- Proximate paid-referral disclosure; no savings, price, timing or guaranteed-approval claims.
- Existing-solar battery intent uses a separately reviewed placement and both browser and server qualification checks.

## City confirmation versus technical eligibility

Aaron confirmed the 14-city commercial list in message `1a0ef13f175fb849`, responding to `1a0eed725339af3f`. Three have active canonical locality routes: Norwalk, Orange, Victorville. Corona is utility-blocked. Ten lack canonical locality records in this release. Mission Viejo remains blocked independently. Neither the city confirmation nor the legacy allowlist may bypass these gates.

## Release sequence

1. Work from current verified production source, not an assumed up-to-date main branch. Preserve unrelated dirty worktrees.
2. Reconcile all runtime source, Netlify functions and generated manifest through a reviewed release branch.
3. Run full tests, typecheck, build, release-preservation checks and local partner-health audit.
4. Verify browser qualification and outbound payload locally with submission intercepted. Never submit a synthetic production referral or fake lead.
5. Verify the exact Netlify site ID, expected prior deployment and absence of a competing deployment before promotion. Correct site: `d49c19aa-f997-43f3-9b11-fabff36c4c83`.
6. After deployment read the published deployment, release metadata and all expected route contracts. Restore the known-good prior deployment on a genuine regression.
7. Keep search clicks, CTA interactions, server-recorded outbound events, partner-reported qualification and actual payments as separate evidence stages.

## Commercial reporting

Written Sep 29 evidence confirms that $25 qualification requires verified contact information, a utility bill, and confirmation the homeowner has or will receive the quote report. Friday reporting is conditional on quote activity. The $200 installation event occurs only when CompareSolarPrices receives its downstream installation payment. Do not turn outbound clicks into accrued commission. Earlier confirmed PayPal/tax facts remain historical evidence; no tax forms, financial changes or new agreement are executed by this runbook.

## Historical record

The prior staging-only version is retained in Git history. Its old city-deep-link destination and owner-blocker list are not current launch instructions.
