# First-Dollar Readiness Checklist

Written 2026-08-15. What genuinely has to happen before GridPermit earns its first real dollar — and, for every partner currently in motion, exactly which step is the current blocker. See `docs/AFFILIATE_PARTNER_PIPELINE.md` for full per-candidate detail.

## The universal sequence

For any partner, in order:

1. **Partner approved** — the company/network has actually accepted GridPermit as a publisher, with evidence (not just an application submitted)
2. **Tracking URL issued** — a real, attributable link/code exists, not a plain unaffiliated URL
3. **URL safely configured in production** — the tracked link is live on the relevant page(s), with correct `rel` attributes and no query-param leakage of anything sensitive
4. **Disclosure updated** — the on-page disclosure language accurately reflects the real relationship (no more "compensation not yet confirmed" once it is confirmed)
5. **Tracking verified** — a real click has been confirmed to register on both GridPermit's analytics (GA4 event) and the partner's own dashboard
6. **CTA tested** — the live CTA has been manually verified end-to-end (desktop + mobile) after the tracked link goes live
7. **Real visitor clicks** — organic traffic actually uses the CTA, not just test clicks
8. **Qualified conversion occurs** — a lead/call/sale meets the partner's own qualification bar, not just a click
9. **Partner records the conversion** — the partner's dashboard shows the conversion, matching GridPermit's own expectation of what should have qualified

**GridPermit is currently stuck between step 1 and step 2 for every partner in the pipeline** — no partner has both (a) confirmed approval and (b) a real, attributable tracking URL at the same time. This is the honest, single-sentence summary of where GridPermit's whole monetization effort stands today.

## Current blocker, per partner actually in motion

| Partner | Current step reached | Exact blocker |
|---|---|---|
| **EnergySage** | Step 0 (pre-approval) | Has a Channel Partner *relationship* and account, but the dedicated tracking page (`/p/gridpermit/`) 404s — production reverted to the plain, untracked link. Separately, the paid CJ program (real per-lead payout) requires a CJ publisher account that can't be created until Payoneer/payment onboarding is finished — an owner-only, outside-this-repo blocker. |
| **HomeAdvisor** | Step 0 | Same CJ/Payoneer blocker as EnergySage's paid program — real, self-serve signup exists, but is gated on the same owner action. |
| **Profitise** | Contacted (per user report) | Awaiting their reply with real terms — no application has been submitted, no terms are known yet. |
| **BigBattery** | Step 0, application ~90% prepared | All truthful fields identified (name, email, website, niche); final form submission requires either owner action or a permission this environment's own safety layer denies to an automated agent. |
| **Power Queen** | Step 0 | Real Awin merchant (118441) confirmed, plus a non-Awin GoAffPro route exists — both require account creation only the owner can complete. |
| **MatchBurst** | Step 0 | Same Awin account-creation blocker (consolidated with Power Queen — one account unlocks both). |
| **PVBAT, First Call Solutions, OnCore Leads** | Step 0 | Applications need either a real traffic/followers figure GridPermit doesn't have yet, or owner-only account creation. |
| **Docan Power** | Step 0, hard stop | Signup requires password + payment method + Tax ID + CAPTCHA on the very first screen — no partial progress possible. |
| **Advertising Results Inc.** | Step 0 | Real, detailed business-application form exists (no password) — blocked purely on missing legal entity name, business address, and phone number, none of which exist in this repo. |
| **BuyTheCalls, Digital Master Media** | Pre-step-0 (economic evaluation phase) | Real programs, real solar payouts, but the actual go/no-go depends on real GridPermit traffic data that doesn't exist yet (no GA4 access) — see `docs/PAY_PER_CALL_FEASIBILITY.md`. |

**Update, 2026-08-19: Angi removed from this table.** The Angi Affiliate Team replied directly: *"Thank you for your interest in partnering with Angi, however we do not currently accept solar leads from affiliate partners."* Program/vertical mismatch, not a rejection of GridPermit itself — closed, no follow-up, no longer a first-dollar candidate. Full record kept in `docs/PARTNER_OUTREACH_QUEUE.md` and `docs/AFFILIATE_PARTNER_PIPELINE.md`.

## What this means, plainly

The single fastest realistic path to step 2 (a real tracked link) is **not** any of the new research from this session — it's **resolving the CJ/Payoneer onboarding blocker for EnergySage's existing paid program**, since that relationship, unlike every other candidate, already has an account, an advertiser ID (5835771), and (per the user's own report) a CJ dashboard showing a real $10.00 lead rate. Every other candidate in this pipeline still needs a *new* account created from zero — EnergySage just needs the *existing* one turned on.
