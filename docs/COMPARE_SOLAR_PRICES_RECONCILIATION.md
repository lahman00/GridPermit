# CompareSolarPrices Click and Payout Reconciliation

Last reconciled: 2026-08-26

## Current commercial baseline

Directly confirmed with Aaron:

- $25 per qualified quote request
- $200 per funded installation conversion
- Southern California
- 30-day click-to-quote attribution
- no stated time limit on the later funded-install conversion once the GridPermit referral is attached
- monthly qualified-lead payouts
- $100 accumulated payout threshold with rollover
- PayPal accepted for the Israel-based payee
- GridPermit referral contract: `ref=GridPermit` plus a fresh non-PII 24-character CID on every click

This runbook does not change the agreement. It defines the evidence needed to verify earned revenue without collecting homeowner personal information.

## Privacy boundary

The reconciliation key is the random CID. Do not put any of the following into a CID, sub-ID, analytics event, issue, commit, report or reconciliation file:

- name
- email
- phone number
- street address
- full IP address
- form contents
- utility account or bill information
- any other homeowner identifier

The partner should report conversion status against CID, not send homeowner PII to GridPermit.

## GridPermit click-side fields

Minimum fields for each real outbound click:

| Field | Purpose |
|---|---|
| `cid` | Random 24-character hexadecimal reconciliation key |
| `partner` | `compare-solar-prices` |
| `clicked_at` | UTC timestamp |
| `source_path` | GridPermit page path, without query-string PII |
| `locality_slug` | Eligibility and coverage reconciliation |
| `state` | Expected `CA` for the current route |
| `ref` | Expected `GridPermit` |
| `destination_host` | Expected CompareSolarPrices host |
| `user_agent_class` | Optional broad device class only; no fingerprinting |

Do not store a CID before a real user click. Do not generate a quote submission for testing.

## Partner-side monthly report requested

The ideal partner report contains one row per GridPermit CID and no homeowner PII:

| Field | Expected values |
|---|---|
| `cid` | Exact GridPermit CID |
| `first_click_date` | Partner-observed click date if available |
| `quote_status` | qualified / unqualified / pending / duplicate / reversed |
| `quote_status_date` | Date of latest status |
| `quote_payout` | 25 when qualified, otherwise 0 unless directly agreed otherwise |
| `install_status` | funded / not_funded / pending / unknown |
| `install_status_date` | Date of latest status |
| `install_payout` | 200 when funded, otherwise 0 unless directly agreed otherwise |
| `reason_code` | Non-PII reason for unqualified, duplicate or reversed status |
| `payment_period` | Month or statement identifier |
| `paid_or_accrued` | paid / accrued / rolled_over |

If Aaron uses a different report format, preserve the same evidence concepts rather than forcing a specific spreadsheet layout.

## Reconciliation checks

For each statement period:

1. Validate every reported CID against `/^[a-f0-9]{24}$/i`.
2. Match the CID to exactly one GridPermit click event.
3. Flag partner CIDs with no GridPermit click.
4. Flag a single CID attached to multiple unrelated click events.
5. Confirm `ref=GridPermit` and the approved destination host were used.
6. Confirm qualified quote requests occurred within 30 days of the click.
7. Do not reject a later funded-install conversion merely because more than 30 days passed after the click; the directly confirmed install conversion had no stated time limit once the referral was attached.
8. Apply $25 only to qualified quote requests and $200 only to funded installations unless a later written agreement changes the economics.
9. Reconcile qualified, pending, duplicate, unqualified and reversed rows separately.
10. Recalculate the monthly earned amount and the accumulated amount against the $100 payout threshold.
11. Track rollover when the accumulated payable amount is below $100.
12. Match paid PayPal amounts to the corresponding statement period and CID-level total.

## Discrepancy categories

Use non-PII categories:

- missing partner CID
- unknown CID
- duplicate CID
- attribution-window mismatch
- unsupported locality
- qualified-status disagreement
- reversal without reason
- funded-install status missing
- payout-rate mismatch
- threshold / rollover mismatch
- payment received mismatch

Do not include homeowner details while discussing a discrepancy. CID, dates, status and amount should be sufficient.

## Monthly close process

1. Export the GridPermit click-side CID report for the statement period.
2. Obtain Aaron's CID-level conversion statement or portal export.
3. Normalize timestamps to UTC and amounts to USD.
4. Run the checks above.
5. Prepare a discrepancy list containing only CID, dates, statuses, reason codes and amounts.
6. Resolve material discrepancies before marking the period reconciled.
7. Record:
   - click count
   - matched CID count
   - qualified quote count
   - funded installation count
   - gross earned amount
   - reversals
   - payable amount
   - amount paid
   - amount rolled over
8. Preserve the source statement and reconciliation output in an owner-controlled location.

## Coverage expansion

The current production allowlist is deliberately conservative. A 2026-08-26 follow-up asked Aaron for an authoritative ZIP, county or city list plus exclusions and capacity limits.

Do not expand production routing from a generic phrase such as “Southern California.” Add a locality only after its current coverage and the applicable economics are directly confirmed.

## Change control

If payout, qualification, attribution, threshold, reporting or coverage terms change:

1. preserve the written source
2. update issue #5 or a successor commercial issue
3. update `docs/MONETIZATION_CANONICAL_STATE.md`
4. update `src/lib/partners.ts` when machine-readable commercial facts change
5. update tests and placement routing when coverage changes
6. do not retroactively apply changed terms unless the partner explicitly says they are retroactive

## Non-negotiable test rule

A valid tracking test ends after observing the outbound request/link. Never submit a fake quote, call, homeowner profile or installation record to test attribution.
