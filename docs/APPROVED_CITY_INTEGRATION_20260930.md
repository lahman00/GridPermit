# Approved-city integration, 2026-09-30

Prepared from production/main `55514385a66ff8a40d9a8e225b310032f5038c51`. Promotion requires current CI and independent production verification; this source document is not itself a deployment receipt.

## Scope

Ten independently sourced locality records were evaluated using the unmodified validator and readiness functions. Only **Palmdale, Long Beach and Santa Clarita** meet normal READY and unambiguous-utility checks and receive generated guide routes. The current approved CompareSolarPrices route supplies the existing solar quote placement without changing partner status, coverage permissions or tracking mechanics.

**Lancaster, Cathedral City, Indian Wells, Indio, Palm Desert, Palm Springs and Rancho Mirage** remain below data readiness and have no new guide or outbound placement. Indian Wells, Palm Desert and Rancho Mirage additionally preserve explicit SCE/IID split-territory records with null primary utility and `-multi` identifiers. Corona and Mission Viejo keep their existing utility guards. Commercial city approval does not override these independent controls.

The normal evaluation is stored in `output/aaron-approved-city-batch-evaluation.json` with its ten validation reports. Origin access warnings remain visible. Primary-source snapshots and detailed evidence indexes are retained privately by the operator; no private email bodies, traffic metrics, outbound records or outreach logs are published.

## Publication safeguards

- Added only the three generated city wrappers and their matching canonical city-root redirects.
- The seven cities requested in the next coverage batch remain outside the existing allowlist pending written confirmation.
- Long Beach's old published fee components are explicitly historical, applicable only through 2026-09-30; the city announces a replacement schedule effective 2026-10-01. No future/current replacement amount is guessed.
- Fee-envelope notes now render before numeric amounts in the shared layout, making effective dates, unknown applicability and exclusions visible rather than silently dropping them. Individual fee notes are preserved.
- No generic instant-permit language is converted to a numeric permit or PTO deadline. CCA generation suppliers remain separate from the wires utility.
- No provider agreement, new partner, lead, payment or external referral test is created.

## Verification contract

The batch's regression tests recompute readiness, assert exactly three new public guides, preserve split-utility holds, keep the unapproved seven-city list off, and enforce the historical Long Beach fee cutoff. Inventory assertions are reconciled to the actual ten new records without relaxing thresholds or changing classification logic.

Pre-promotion local verification: 722 tests, 718 passed and four explicitly network-gated skips; typecheck zero errors/warnings; 459 built pages; 67 outbound placements; 458 audited HTML routes and zero local partner-health failures. Seven isolated browser cases cover desktop/mobile, visible fee restrictions, one paid slot, anonymous POST shape and Mission Viejo's negative control. All six submission tests were intercepted locally with external domains blocked. Production POSTs and synthetic referrals remain zero.

After merge, verify the exact Netlify site `d49c19aa-f997-43f3-9b11-fabff36c4c83`, published commit, release source hash, all three functions, live new routes and preserved holds. A green build alone is not proof that the correct release is live.
