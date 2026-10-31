# CSP evidence review — 2026-10-30

Review completed by Codex at the operator's request at `2026-10-30T18:35:49Z`.
This records a review of the existing permission, not a new partner approval,
territory expansion, contract acceptance, or production release.

## Why the previous build stopped

The existing internal `program.reverify_after` and verification `expires_at`
deadlines were `2026-10-30T09:57:07Z`. Routing correctly failed closed after
that time. The underlying correspondence does not state that the partnership
ends on that date or requires a new approval email every month. The 30-day
window in the original terms is click-to-quote attribution; it is not a
partnership end date. No routing or freshness rule is changed by this review.

## Evidence and limits

| Scope | Reviewed evidence | Result |
| --- | --- | --- |
| Original referral permission and tracking | `gmail:1a03a05e3fd3f646`, implementation acknowledgement `gmail:1a03f3d056636a9f` | Existing `ref=GridPermit` plus fresh anonymous CID contract retained. No terms accepted or renegotiated. |
| Battery retrofit, direct quote destination and qualification | `gmail:1a0eafa285b84cf3`, homeowner clarification `gmail:1a0f1bf9041d8bb6` | Existing-solar battery permission comes from the September response, not the October city batch. Existing homeowner and confirmation gates remain. |
| Existing city list | Official homepage plus `gmail:1a0ef13f175fb849`, `gmail:1a0f1bf9041d8bb6`, `gmail:1a0fdcecf35f78d3` | The union covers exactly the existing 90-city allowlist, with no additions or omissions. Technical eligibility remains separate. |
| County boundaries | `gmail:1a0fb35cb1756d95` | No county-wide permission inferred. Corona and Mission Viejo utility holds remain. |
| October continuation | `gmail:1a0fdcecf35f78d3` | Confirms only San Clemente, Cypress, Laguna Beach, Lakewood, Ventura, Cerritos, Hawthorne and Carson under the existing setup. It is not a new approval of all cities or battery intent. |
| Later correspondence | Authorized mailbox search through the review time | No later received cancellation/change found. An October 8 unsent/trash draft is excluded as evidence. Absence of a message is not a new approval. |

The official homepage was read through a web reader reporting a cached crawl
approximately two weeks old. It enumerates 74 of the existing cities; the
written city batches cover the remaining 16. This is not represented as a
fresh direct GET: two untracked Mac GET attempts returned HTTP 406. The
existing untracked destination HEAD check returned HTTP 200. Neither HEAD nor
cached HTML proves a conversion, a payout, or a partner-side tracking receipt.
Raw correspondence, the source-to-city matrix, HTTP observations and review
receipt are retained privately outside the public repository.

## Recorded decision

The existing reviewed scope remains supported by the original permission,
specific later confirmations, source review, and unchanged local tracking
contract. The repository's existing verification schema accepts a dated,
reviewed record bound to the exact configuration; it does not prescribe a
fresh monthly partner email. The older `csp-homepage-20260825` record likewise
records a later source-review date. This review creates
`csp-operator-review-20261030` and preserves every commercial field except the
review reference and review timestamps. Previous records remain unchanged.

The next internal review is due `2026-11-29T18:35:49Z`, retaining the existing
30-day review interval. This interval is an internal control, independent of
the attribution window. There is no automatic renewal. At that deadline the
unchanged program and approval gates still reject routing, even with fresh
destination health. Earlier evidence changes or a failed health check still
block routing immediately.

Before release, require full tests, build/preservation, partner health,
86-route contract comparison, CI and Guardian. No new city, category,
placement, tracking parameter, payout term, or commercial permission is
introduced; no live referral, form submission, partner message, merge or
deployment is part of this review.
