# First-party outbound measurement

The existing partner router still chooses the partner. The build exports only approved, ACTIVE, renderable URL placements to `netlify/generated/outbound-routes.json`. The recorder cannot accept an arbitrary destination, city or intent. Phone calls retain their separate call-report path; a phone click is not an HTTP outbound receipt.

`POST /go/<partner>` accepts exactly `cid`, `page_path` and `qualified`. Browser code keeps the existing qualification and disclosure, creates one random CID, and submits a new-tab form with `noopener`. The first-party POST retains its Origin header. The 303 response sets `Referrer-Policy: no-referrer`, so the following partner request does not carry the page referrer. CSP keeps `ref=GridPermit`, the same CID, and `#quote`.

## Persistence and access

Netlify Blobs store `gridpermit-outbound-v1` is site-scoped and private to authenticated server/CLI access. No event-reading HTTP endpoint or credential is exposed. The function uses platform-supplied credentials. Event fields are only stage, random CID, partner ID, CTA ID, page path, page-derived city, intent, and server timestamp. It writes no contact fields, IP, user-agent, arbitrary query parameters, request headers or request bodies. Infrastructure access/security systems may process IPs independently.

Each event occupies an immutable slot keyed by UTC date and a 16-bit hash of partner/CID. Conditional creation plus a strong read-back confirms the exact stored event. This bounds new event data to 65,536 records, each at most 512 bytes, per day (32 MiB before storage metadata). A slot collision is `CAPACITY_COLLISION`, never an overwrite or a counted success. At small traffic volumes this is deliberately conservative; this ledger is a lower bound, not a lossless total-click counter. Replays within the day do not add rows; the operator export deduplicates partner/CID across all retained days as well.

Records are logically available for 37 days: the current 30-day quote-attribution window plus a seven-day reporting buffer. Hourly cleanup deletes expired events, with up to one normal scheduling interval of physical delay. It marks itself unhealthy before work. Interruption or a heartbeat older than 90 minutes stops new recording. A provider outage can delay physical deletion; `/telemetry/health` exposes cleanup health without exposing events. Recovery reruns cleanup, not a synthetic click. Site-scoped storage survives deployment rollback; never delete the store as part of rollback.

## Abuse, cost and failure behavior

Only same-origin POSTs with a matching Origin and `Sec-Fetch-Site` are accepted. Unknown fields, oversized bodies, duplicate fields, non-hex CIDs, unknown placements, expired commercial evidence, known bots and prefetch are rejected before writes. DNT/GPC skips recording. These filters do not prove a request is human: a determined client can forge headers. `OUTBOUND_RECORDED` means an eligible request was durably stored, not a verified person or lead.

Two native Netlify code rules limit outbound and health requests to 10/minute per domain/IP. Provider rate limiting can be approximate; it is not a global accounting cap. The verified existing Pro account has 5,000 included plan credits, auto-topup disabled and no usage-exceeded marker. No billing setting, subscription or recharge was changed. Account credit limits are shared across sites, so abuse can consume existing allowance or pause sites; they are not proof of zero operational cost. Per-IP limits and storage bounds limit exposure, but do not eliminate distributed abuse.

The recorder waits at most 1.2 seconds for persistence. Failure or timeout still redirects to the approved destination and returns `UNCONFIRMED`; it never fabricates a recorded event. A late successful write may appear in the export even after an unconfirmed response. Expired or invalid routes and qualification failures do not redirect. An edge rate limit may return 429 before code executes. There is no automatic retry or alternative partner selection in the recorder.

## Eight separate evidence stages

1. CTA_RENDERED: existing client rendered event or a build placement, explicitly distinguished by source.
2. CTA_EXPOSED: viewport observation.
3. CTA_CLICKED: client interaction with a CID.
4. OUTBOUND_RECORDED: durable server receipt with that CID.
5. PARTNER_REPORTED_REFERRAL: authentic partner report matching the CID.
6. QUALIFIED_LEAD: partner qualification evidence.
7. FUNDED_INSTALL: partner installation/funding evidence.
8. COMMISSION: authentic commission stage, with paid cash requiring payment evidence.

Never infer a later stage from an earlier one. `scripts/outbound-export.mjs --out NEW_FILE.json` reads through an operator's normal Netlify session token supplied via `NETLIFY_AUTH_TOKEN`. It filters records outside the same 37-day reconciliation window, deduplicates receipts and leaves partner/lead/commission fields null. No token belongs in source, output artifacts or browser code. The existing partner-report normalizers remain separate.

## Release and rollback

Use `.nvmrc`, `npm ci`, tests, typecheck, and `npm run build`. The build regenerates the outbound manifest and release metadata. The activation factory snapshots `netlify/` with the other source, builds the exact snapshot, checks the expected live deployment, and ships functions with the static files. Verify the provider deploy log actually accepted both rate rules and the hourly schedule; syntax errors in a rule must not be treated as protection.

Use the recorded previous Netlify deployment as rollback target. Reverting only HTML while leaving a mismatched function registry is not a complete rollback. Configuration pause/rollback uses the existing factory, tests, build and live smoke. Production must never receive the `.example` partner used by `verify-activation-fast-path.mjs`; that runner intercepts the deploy boundary and performs local audits only.

The baseline reproduction commit is separate from this telemetry change. The dirty canonical checkout is preserved. `origin/main` must be reconciled through the local integration branch; pushing it can trigger production CI, so no push is part of this sprint.
