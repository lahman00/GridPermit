# Zero-to-First-Dollar Plan

Last reconciled: 2026-08-25

Trigger-based tactical sequence, not a calendar commitment. Each trigger is a real external event (a partner reply, an approval, a tracking asset); the day labels are the outside bound within which that trigger's follow-up action should happen once it fires, not a promise that it fires by then.

## Day 0 (today)

- Architecture complete: fail-closed `src/lib/partners.ts`, `PayPerCallCTA.astro`, `ProductAffiliateCTA.astro`, EnergySage CPL state machine, analytics events, all inactive.
- Outreach already sent this pass: ALLPOWERS, BLUETTI, EcoFlow, Power Queen, EASUNPOWER, Vatrer Power, RICH SOLAR (all `AWAITING_RESPONSE`).
- No trigger has fired yet. No monetization is live.

## Day 1

Trigger: DMM sends the 7 missing items (payout, tracking number, setup, ZIP guidance, IVR logic, disclosure wording, agreement).
Action: review terms against the non-negotiable gates, populate `digital-master-media` in `partners.ts` (trackingPhone, payoutValue, campaignHours if changed, compensationVerified), flip `status` to `approved` and `trackingEnabled` to `true`, but leave `launchEnabled: false` until a human explicitly reviews the final compliance wording. Wire `PayPerCallCTA.astro` into a small, named subset of high-intent locality pages (not site-wide). Run tests/build. Only then flip `launchEnabled: true` in a separate, deliberate commit.

Trigger: CJ activation clears (owner confirms via CJ dashboard or support reply) and a real tracked EnergySage link is issued.
Action: update `energysage` in `partners.ts` (destination = real tracked URL, trackingEnabled = true, compensationVerified = true once terms are confirmed in writing, status = approved), which automatically upgrades `getCplState()` from `UNTRACKED_RELATIONSHIP` toward `ACTIVE_CPL` once `launchEnabled` is deliberately flipped. No template change needed in `InstallerCTA.astro` or `index.astro`.

## Day 3

Trigger: any hardware-affiliate candidate (ALLPOWERS, BLUETTI, EcoFlow, Power Queen, EASUNPOWER, Vatrer Power, RICH SOLAR) replies with eligibility confirmation.
Action: owner creates the account (GoAffPro/Impact/direct, per that candidate's confirmed route). Once a real tracking URL exists, update that partner's record in `partners.ts` and wire `ProductAffiliateCTA.astro` into the relevant battery/backup-power blog posts only (per `docs/MONETIZATION_PLACEMENT_MAP.md`). Measure `affiliate_cta_viewed`/`affiliate_cta_clicked` for at least a few days before drawing any conclusion.

Trigger: FlexOffers responds with an EnergySage alternate route.
Action: compare against the CJ path; whichever produces a real tracked link first becomes the live one. Do not run both simultaneously on the same page.

## Day 7

Trigger: BigBattery responds (approval or rejection).
Action: if approved, treat identically to the hardware-affiliate cluster above. If rejected, remove `bigbattery` from active consideration and note the rejection reason in `docs/MONETIZATION_CANONICAL_STATE.md`; do not re-apply.

Trigger: none of the above have fired yet.
Action: send one round of polite follow-up to any partner still `AWAITING_RESPONSE` past a reasonable reply window; do not duplicate outreach to anyone already followed up with once.

## Day 14

Trigger: still no partner has reached `APPROVED` + real tracking.
Action: re-run the primary-source expansion pass (`docs/MONETIZATION_CANONICAL_STATE.md` priority engine) against 15 more candidates, prioritizing direct/Impact/GoAffPro routes over anything Awin- or CJ-account-dependent. Re-check whether CJ's own onboarding status changed. Re-verify DMM has not gone stale.

## Definition of "first measurable monetization event"

The first time any of `affiliate_cta_clicked`, `cpl_cta_clicked`, or `pay_per_call_clicked` fires in GA4 from a genuinely launched (`isLaunchReady() === true`) partner. This precedes and is distinct from "first actual revenue," which additionally requires that click to convert per that partner's own confirmed payout terms.

## Definition of "first actual revenue"

The first partner-confirmed payout event: a paid lead, a paid call, or a paid sale, confirmed via that partner's own dashboard or payout report, not estimated from click volume.
