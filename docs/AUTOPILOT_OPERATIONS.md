# GridPermit Autopilot Operations

## Activation boundary

The workflow in `.github/workflows/autopilot.yml` is not active while it exists only on a pull-request branch. Merging the pull request into `main` activates one daily schedule. The workflow never merges, deploys, changes partner routing, sends partner email, spends money, or creates referral traffic.

## Schedule

- One GitHub Actions schedule runs every day at 10:17 UTC.
- Monday's run performs the daily checks and also creates `WEEKLY_OWNER_REPORT_HE.md`.
- Other days create `DAILY_OPERATIONS_REPORT_HE.md`.
- `workflow_dispatch` supports a bounded manual daily or weekly verification.
- Workflow concurrency allows only one operating run at a time. Runtime is capped at 15 minutes.

## Daily checks

- Production homepage and immutable release identity.
- First-party telemetry health at `/telemetry/health`.
- Every published route through the existing read-only partner-health audit.
- Approved destination health using a HEAD request with no CID, query data, form submission, cookie, or JavaScript.
- Private outbound export only when `NETLIFY_AUTH_TOKEN` exists.
- The existing five-role operations coordinator.
- Open commercial blockers and expired program evidence.

Missing private evidence remains `BLOCKED` or `UNKNOWN`. It is never reported as zero.

## Weekly review

Monday reuses the same coordinator run and adds a Hebrew owner report covering revenue evidence, SEO availability, partner status, critical failures, changes since the prior run, and one next action. GSC, GA4, partner reports, and revenue stages remain blocked or unknown until authenticated unattended inputs are configured.

## Persistent state

Only `.autopilot-cache/state.json` is persisted with GitHub Actions Cache. It contains status fingerprints, aggregate stage counters, alert codes, and notification timestamps. It contains no CID, click row, email, phone, address, IP, token, raw partner report, or payment evidence.

The workflow uses a single concurrency group to prevent concurrent writes. Every cache save uses an immutable run-specific key and restores the newest prior key. Generated reports are written atomically. Raw private inputs and coordinator output stay under `runner.temp` and are never uploaded.

## Alerts and deduplication

New alerts are generated for:

- Production outage.
- Release identity drift.
- Broken active commercial route.
- Broken approved destination.
- Critical telemetry failure.
- Expired essential partner evidence.
- A newly observed verified conversion, payable commission, or paid commission.
- A failed authorized data source.

An unresolved alert is emitted once and then suppressed for 72 hours. Resolution is recorded. Reappearance after resolution may notify again.

## Notifications

The repository is public, so private commercial reports are never placed in an issue, PR comment, workflow log, or uploaded artifact.

Optional private delivery uses these GitHub Actions secrets:

- `GRIDPERMIT_ALERT_WEBHOOK_URL`: HTTPS endpoint accepting a JSON POST.
- `GRIDPERMIT_ALERT_WEBHOOK_BEARER`: optional bearer credential.

Without that webhook, a new critical alert fails the workflow once after state is saved. GitHub can then deliver its normal private workflow-failure notification according to the owner's GitHub notification settings. Weekly private report delivery remains `BLOCKED` until a webhook is configured and verified.

## Release Guardian

The existing CI workflow now runs typecheck, tests, production build and release preservation, SEO invariants, partner health, and a high-severity dependency audit. A separate permission-limited job updates one marked PR comment with the exact head and public-safe results. It never merges or deploys.

## Required permissions

- `NETLIFY_AUTH_TOKEN`: required for current private outbound rows. Without it, telemetry infrastructure health can still be checked but event counts remain unknown.
- Authorized partner report import: not configured for unattended GitHub Actions. Use a private, operator-verified import path; never paste it into workflow inputs.
- GSC and GA4 unattended credentials: not configured.
- Private notification webhook: not configured until the owner chooses and authorizes a destination.

## Safe stop

Pause or disable the `GridPermit Autopilot` workflow in GitHub Actions, or remove its `schedule` trigger in a reviewed pull request. No production rollback is needed because monitoring jobs do not mutate production.
