# GridPermit AI Operations System

This is a thin evidence and coordination layer over the existing telemetry, partner factory, reconciliation, source-health and release scripts. It does not replace them or run autonomous agent loops.

## Components

- `data/operations/state.json` is the versioned operating contract and safety budget.
- `scripts/gridpermit-operations.mjs` runs five bounded checks and writes one immutable run directory.
- `scripts/lib/operations-system.mjs` validates evidence and preserves funnel-stage distinctions.
- `skills/gridpermit-*/SKILL.md` defines the five operator interfaces.
- Each run produces a task/evidence ledger, revenue ledger, partner state, SEO backlog, source audit, release gate and Hebrew owner report.

## Safe local run

```bash
npm run operations -- --out output/operations/<timestamp>
```

With private evidence stored outside Git:

```bash
npm run operations -- \
  --out output/operations/<timestamp> \
  --outbound /private/path/outbound.json \
  --partner /private/path/partner-report.json \
  --gsc /private/path/gsc.json \
  --ga4 /private/path/ga4.json \
  --release-evidence /private/path/release-evidence.json
```

The output directory must not already exist. This prevents accidental overwrite and makes runs reproducible. Private inputs are never copied into the repository; only validated, no-PII ledger fields are written.

## Existing infrastructure reused

- `scripts/outbound-export.mjs` remains the operator-only Netlify Blobs exporter.
- `scripts/reconcile-compare-solar-cids.mjs` remains the detailed CompareSolarPrices reconciliation path.
- `scripts/partner-*` remains the partner import, activation, health and rollback factory.
- `scripts/source-health-report.mjs`, `npm run seo-check`, `npm test`, `astro check`, `npm run build`, and `release-preservation-check` remain the underlying quality gates.

## Scheduling

No schedule is enabled. Fresh outbound export requires private Netlify authorization; GSC/GA4 access must be restored and verified; partner reports require operator authenticity review. Enabling a scheduled workflow before those boundaries are resolved would create noisy UNKNOWN reports or place secrets into an unverified path.

## Evidence schemas

Partner reports use an envelope with `authenticity: OPERATOR_VERIFIED`, `verified_at`, and `events`. Each event must include `stage`, anonymous 24-hex `cid`, `partner_id`, `timestamp`, and `evidence_ref`. Commission events also require integer `amount_cents` and `currency: USD`; `COMMISSION_PAID` additionally requires `payment_evidence_ref`.

GSC exports use `authenticity: OPERATOR_VERIFIED`, `verified_at`, and `rows` containing `page`, `clicks`, `impressions`, and optional `position`.

## Failure behavior

Missing integrations remain `UNKNOWN` or `BLOCKED`. Invalid evidence fails closed. No run sends messages, spends money, calls paid services, changes production, activates partners or creates commercial test traffic.
