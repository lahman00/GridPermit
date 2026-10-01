# Lead Smart — current state audit (documentation only, no activation)

**Status of this document: audit only.** No campaign was activated, no tracking number was published, no Ringba invitation was accepted, and no one was contacted to produce this. This exists to separate what the repo currently records from what a historical conversation reportedly reached, and to list exactly what would need fresh confirmation before any activation could even be considered.

## 1. Current repo state

- `src/lib/partners.ts` (`id: "lead-smart"`): `status: "awaiting_response"`, `trackingEnabled: false`, `compensationVerified: false`, `placementEligible: false`, `launchEnabled: false`, `destination: ""`, `lastVerified: "2026-08-26"`.
- Notes field (verbatim): "Lead Smart directly confirmed GridPermit fit, non-U.S. publisher eligibility for U.S. homeowner calls, SEO/local-search traffic, and consumer-initiated inbound-call requirements. Seth said payout can be duration-based or qualified-lead based and that a W-8 is required, but he did not yet provide current Solar coverage or payout economics. Follow-up sent asking for states/ZIPs, hours, payout/rate, minimum billable duration and disqualifiers before tax onboarding. See issue #15."
- `docs/MONETIZATION_CANONICAL_STATE.md` (line 48) carries the same `AWAITING_RESPONSE` status and the same narrative, plus an explicit instruction: "Do not send W-8 until campaign economics are concrete enough to evaluate."
- `src/lib/partner-routing.ts`: `lead-smart` is listed in `CHANNEL_PRIORITY.pay_per_call` (second priority, after `digital-master-media`) — but `isLaunchReady()` requires `status` to be one of `approved/tracking_received/ready_for_production/production_active` **and** all three boolean gates **and** a real tracking asset. Lead Smart's current record fails every one of those conditions, so `getEligiblePartners()`/`selectPartner()` cannot select it today regardless of its position in the priority list.
- `src/components/PayPerCallCTA.astro`: not wired into any page (confirmed by its own header comment and by this audit); renders nothing unless a partner passes `getLaunchReadyPartner(partnerId, "pay_per_call")`, which requires the same gates above.
- No `data/commercial/partners/lead-smart.json` file exists (unlike `energyaid.json`, `oc-solar.json`, etc.) — Lead Smart's state lives only in `src/lib/partners.ts` and the canonical-state doc, not in the newer per-partner JSON schema used elsewhere in this repo.

**Net: the repo's own state is self-consistent and correctly inert** — nothing in code or config currently allows Lead Smart to go live, and the last-verified date (2026-08-26) and narrative both describe a pre-economics, pre-tracking stage.

## 2. Historical evidence we possess

The historical email thread with Seth Pikus / Lead Smart progressed materially beyond the repo's 2026-08-26 snapshot:
- GridPermit CTA copy and placement were approved on Aug 31
- A Ringba publisher invite was provided
- A live solar tracking number was supplied
- The solar offer was described as residential consumer-initiated inbound calls with nationwide buyer coverage, subject to live buyer/cap availability
- A live buyer coverage sheet URL was supplied
- Historical buyer hours were supplied: 8:00 AM–7:00 PM Central Monday–Friday and 10:00 AM–2:00 PM weekends
- Payout was described as variable by buyer/call quality, with the exact amount per call visible in Ringba rather than a fixed GridPermit-specific rate in the email
- W-8 was required
- Modest initial volume was requested

This is treated here strictly as **historical** evidence of a conversation that happened — not as proof that any of it is still valid today.

## 3. Contradictions / stale state

- The repo's notes say current Solar coverage or payout economics were still missing. The historical thread later supplied a live buyer-coverage sheet, campaign hours, a Ringba invite and tracking number. A fixed GridPermit-specific payout was still not stated in the email; compensation remained variable by routed buyer/call quality and visible per call in Ringba.
- The repo's narrative is therefore stale in two ways: it understates the historical onboarding/tracking progress, and it omits the historical coverage/hours evidence. Keeping every launch gate false is still correct because none of those Aug 26–31 facts has been freshly reconfirmed today.
- **Nothing** in the Aug 31 evidence is re-confirmed as still valid as of today. Tracking numbers get reassigned, campaigns get paused, Ringba invites expire, and rate cards change — none of that staleness risk is unique to this partner, it's just unverified here.

## 4. Exact fresh evidence required before activation

All of the following must be **independently reconfirmed in writing**, not assumed from the Aug 31 conversation:

1. The campaign is still active today (not paused, not closed).
2. The previously-supplied tracking number is still assigned to GridPermit specifically (not reassigned, not expired).
3. Current eligible states/ZIP coverage for solar. Historical coverage was supplied, but it must be re-confirmed because buyer availability and caps can change.
4. Current buyer hours (the historical schedule must not be assumed current).
5. Current payout/rate structure, in writing. The historical email described variable per-call economics visible in Ringba, not a fixed GridPermit-specific payout.
6. Minimum billable call duration.
7. Duplicate/repeat-caller policy.
8. Explicit disqualifiers (what makes a call non-billable).
9. Call-recording and disclosure requirements (what GridPermit's CTA copy must say, and what the caller must be told).
10. Ringba account/invite validity — does the invite still work, is it still addressed to GridPermit, does the account exist and function.
11. Payment and tax requirements beyond "W-8 required" — exact process, timing, minimum payout threshold if any.
12. What reporting/reconciliation fields Lead Smart can actually provide (call ID, duration, buyer, timestamp, disposition) — without this, GridPermit cannot reconcile a single call the way `scripts/reconcile-compare-solar-cids.mjs` reconciles CompareSolarPrices today.

## 5. Owner-only actions

None of the following should be done by an assistant on the owner's behalf:
- Confirming the Ringba invite is still valid, or re-requesting a new one.
- Accepting any Ringba publisher agreement or onboarding terms.
- Reviewing and signing any Lead Smart / Ringba contract.
- Submitting a W-8 (the canonical doc's own existing instruction — do not send until economics are concrete — still applies and is not overridden by this audit).
- Deciding whether modest initial volume and a nationwide-but-unconfirmed-coverage offer is worth pursuing at all, given GridPermit's real current traffic scale.

## 6. Technical prerequisites

- **No phone-tracking-number UI component is wired to any page today.** `PayPerCallCTA.astro` exists and is tested in isolation but is not imported by any real page — placement still needs a decision (which pages, what copy, what disclosure).
- A real, current `trackingPhone` value would need to replace the empty `destination: ""` field, and `trackingEnabled`, `placementEligible`, and `launchEnabled` would all need to flip to `true` only after every item in Section 4 is confirmed — the code's own gate (`isLaunchReady`) already enforces this; nothing needs to be built to enforce it, only real data needs to be entered once it exists.
- A reconciliation process equivalent to the CompareSolarPrices CSV reconciler does not exist for pay-per-call data yet — Lead Smart calls would have no automated way to be checked against GridPermit's own outbound-click records the way `reconcile-compare-solar-cids.mjs` does today, unless Lead Smart's reporting fields (Section 4, item 12) turn out to support it and a parallel script is built.

## 7. Compliance / disclosure requirements

- TCPA-adjacent call-recording disclosure must be confirmed and must appear in the actual CTA copy before any real caller reaches it (see `PayPerCallCTA.astro`'s existing `"Calls may be recorded for quality and compliance purposes."` line as a starting point, not a finished compliance review).
- Consumer-initiated inbound-only is a real constraint per the historical evidence — no outbound dialing, no incentivized calling, consistent with every other pay-per-call partner already vetted in this repo's `partner-terms-forensics` work.
- Non-U.S. publisher eligibility was reportedly confirmed historically — this should be re-confirmed in writing, not re-assumed, since eligibility terms for international publishers are exactly the kind of thing that changes between one conversation and a later activation.

## 8. Fail-closed activation checklist (for a future pass — not executed here)

Activation should not proceed unless **all** of the following are true, each with a dated, written source:

- [ ] Campaign confirmed active today (not just "as of Aug 31")
- [ ] Tracking number confirmed currently assigned to GridPermit
- [ ] Coverage, hours, payout, minimum duration, disqualifiers, and duplicate policy all confirmed in writing
- [ ] Ringba invite/account confirmed functional
- [ ] Payment/tax process confirmed and only then is W-8 submission appropriate
- [ ] Reporting fields confirmed sufficient for reconciliation
- [ ] Call-recording/disclosure copy reviewed and placed in the actual CTA before any real traffic reaches it
- [ ] `src/lib/partners.ts`'s `lead-smart` record updated with real values and `status` moved to an `APPROVED_LIKE_STATUSES` member only after every item above is true
- [ ] A page decision made for where `PayPerCallCTA.astro` would actually render

**If any item is unconfirmed, unknown, or ambiguous, activation must not proceed.** This document does not conclude that Lead Smart is a good or bad opportunity — only that nothing here has been freshly reconfirmed, and nothing should be activated on the strength of a 5-week-old conversation alone.
