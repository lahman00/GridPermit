# Four approved-city night release — 2026-10-01 Israel / 2026-09-30 UTC

## Baseline and scope

Prepared from verified production/main `9f8b3fb54c1385223b7121124eac36ee7e336c5a` (PR94). Existing seven-city written approval and mandatory homeowner confirmation remain intact. No partner configuration, approval, allowlist, qualification or commercial term is changed.

Lancaster, Cathedral City, Indio and Palm Springs now each meet the existing 80% completeness threshold, pass the unchanged utility guard, and have zero validation errors. Validator scores respectively 89, 90, 90 and 86, with existing access warnings retained (REVIEW, not falsely clean origin fetches). Four generated guide wrappers and canonical city-root redirects are added.

The four original unresolved utility cities—Corona, Indian Wells, Palm Desert, Rancho Mirage—remain held. Mission Viejo separately remains utility-held. No address-level utility is guessed.

## Evidence discipline

The current CPUC program scope, Appendix D assignments and administrator budget tracker were fetched directly with HTTP 200 at 2026-09-30 22:00 UTC. Registry dates use UTC; local retrieval was October 1 in Israel. The tracker displays data dated 2026-09-30. IID is assigned to SoCalGas for this program, Lancaster Choice Energy and Desert Community Energy to SCE; incentive administration is not wires/gas service.

The solar component of the paired Residential Solar and Storage Equity program is explicitly the same paired program as the storage component, not an additional or standalone award. SCE Non-POU and SCG budgets are described as waitlisted, individual eligibility/reservation remain unknown, and all dollar amounts and award dates remain null.

Previously prepared but insufficiently evidenced Lancaster toolkit/one-business-day claims and Cathedral City fee amounts were NOT imported. All four permit-fee fields stay null. Lancaster checklist and deadline remain null; Cathedral City generation supplier and deadline remain null; Indio generation supplier and deadline remain null; Palm Springs checklist/inspection steps remain null. Source access warnings were not suppressed or reclassified to bypass readiness.

Palm Springs uses the already-read official city code's maximum of three business days only for checklist-compliant small rooftop permit issuance. No minimum, inspection, installation or PTO duration is invented.

## Concrete defects fixed

1. Partial timeline bounds rendered as unknown despite an explicit maximum. The formatter now supports maximum-only/minimum-only values, preserves nulls and source scope, and rejects malformed/reversed bounds. Established complete ranges retain their original day-unit rendering; unrelated business-day phases in notes do not relabel them.
2. County labels such as Los Angeles and Los Angeles County generated duplicate canonical hub slugs. Grouping now uses state plus normalized slug and deduplicates repeated evaluation IDs, without reducing the minimum distinct-city threshold. Supplied full county labels are preferred, never invented.
3. Eligible city pages lacked a nearby path to their quote section. A hidden-by-default internal shortcut appears only if the approved CTA actually rendered; clicking it only scrolls to the existing offer and never bypasses homeowner confirmation.
4. Mobile Huntington Beach overflow was reproduced from a long plain-text permit portal URL. Text now wraps within the content card instead of being clipped or widening the viewport.

## Verification

- 736 tests: 732 passed, four explicitly network-gated skips, zero failures.
- Typecheck: zero errors and zero warnings.
- Build: 463 pages, 78 approved outbound placements, 21 required city-preservation contracts and three server functions.
- Browser: 89 cases, including all 78 paid routes at mobile width, four new cities and battery route at desktop width, and six held/negative controls. Unchecked qualification never submitted; checked forms were intercepted locally with opaque CID and qualified=1. External domains blocked; no production POST or fake lead.
- Exact-build SEO: all 78 paid routes have self canonicals, sitemap inclusion, mandatory qualification and at least two distinct internal linking pages, with zero audit failures.
- Full baseline live audit: 458 HTML routes and 74 paid placements, zero failures. Candidate local health and post-promotion live audit are recorded separately.

Fresh private search, indexing, retained outbound and partner evidence are kept outside the repository. No conversion improvement, partner acceptance or income is inferred.

Promotion requires current-head CI, unchanged baseline and independent verification of the exact Netlify site `d49c19aa-f997-43f3-9b11-fabff36c4c83`, merge commit, source hash, functions, four new guides, all existing paid routes and utility holds. This source document does not itself assert a deployment.
