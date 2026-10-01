# CompareSolarPrices reconciliation: evidence boundaries

The CLI reads local supplied files only. It does not fetch telemetry, contact the partner, or create a referral. Use only an already-authorized export and an authentic partner statement verified by the operator. Keep all actual statements/results outside the public repository.

## Separate dates

The 30-day attribution clock runs from the click to the **quote request**, not the later qualification date. Optional `quote_requested_at` is an explicit UTC timestamp supplied from written partner evidence. `quote_status_date` remains the status/qualification date. Never infer one from the other.

If the request date is missing, attribution remains unverified, `fully_reconciled` is false and `expected_total_payout_usd` is null. A late qualification is not rejected merely because the request was made earlier within the valid window. No installation deadline is invented.

## Duplicate and conflicting rows

Every CID is normalized for case. Multiple partner rows for one CID are quarantined as a group; the tool neither chooses the first/last status nor adds repeated commissions. Resolve the source statement before calculating a settlement total. Malformed CIDs are not echoed back into diagnostic output.

## Counts are not cash

Outcome counts refer only to unique parseable partner-report rows, not independently verified cash receipts. Unknown/ambiguous rows remain explicit discrepancies. An unmatched CID is missing local evidence, not proof of an invalid referral; retention, privacy opt-outs and unrecorded redirects can leave gaps.

`fully_reconciled` means only that the supplied-file checks passed. The operator must verify statement authenticity. A `paid` label in a CSV does not prove payment; approved, payable and paid commission fields remain null until separate authentic evidence is reviewed. No rows supplied is not proof of no leads. Error-bearing amounts are null rather than apparently settled totals.

## Reversible verification

Tests use clearly isolated local fixtures. No production POST, partner visit, test lead, phone call or newly collected customer data is needed. The existing 37-day retention, routing, qualification, privacy opt-outs and partner terms are unchanged by these corrections.
