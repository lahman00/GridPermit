---
name: gridpermit-revenue-intelligence
description: Build a privacy-safe, evidence-scoped GridPermit revenue ledger from first-party outbound exports and verified partner reports.
---
# Revenue Intelligence
Inputs are an optional `OUTBOUND_RECORDED` export and optional operator-verified partner event report. Invoke `npm run operations -- --out <new-directory> [--outbound <json>] [--partner <json>]`. Never turn an unavailable input into zero. Keep every funnel stage separate. Reject PII, malformed CIDs, unmatched CIDs, unsupported stages, and payment claims without payment evidence. Synthetic fixtures may test code but never count as revenue.
