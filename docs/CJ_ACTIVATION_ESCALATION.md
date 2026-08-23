# CJ Account Activation — Diagnosis & Support Escalation

Written 2026-08-24. I have no CJ login credentials in this environment and never will (categorically off-limits) — everything below is either (a) research into CJ's own public documentation, or (b) a prepared message for you to send yourself. Nothing was submitted on your behalf.

## Diagnosis

CJ's own publisher-onboarding documentation (junction.cj.com) describes a **7-step onboarding checklist** that must be fully completed before an explicit **"Activate Account"** button (at the bottom of the checklist) becomes usable — merely filling in individual fields is not the same as activation; the button must be clicked separately. The 7 steps: validate email, enter user information, complete your network profile, add a promotional property, enter company details, submit tax forms, provide payment information.

**Cross-referencing this against what's confirmed done for GridPermit:**

| Checklist step | Status |
|---|---|
| Validate email | Unknown — not reported either way |
| Enter user information | Unknown — not reported either way |
| Complete network profile | **Unknown — this is a distinct step from "promotional property" and is easy to overlook** |
| Add promotional property | ✅ Confirmed — GridPermit property is Active |
| Company details + tax forms | ✅ Confirmed — W-8BEN submitted |
| Payment information | ✅ Confirmed — Payoneer USD receiving account entered, CJ acknowledged the change |
| **Explicit "Activate Account" button click** | **Unknown — this is a separate action from completing the fields above, and CJ's own docs treat it as easy to miss** |

**Most likely explanation, in order of probability:**
1. **The "Complete Your Network Profile" step is incomplete** — distinct from the promotional-property step, and not mentioned in anything reported so far.
2. **The explicit "Activate Account" button was never clicked** — even with every field filled in, CJ's process requires this as a separate final action.
3. **CJ is still internally verifying the newly-changed payment information** — banking-detail changes commonly trigger a backend verification hold before an account can activate, even though the UI shows the field as "saved."
4. Less likely, but not ruled out: a genuine CJ-side account-state defect. CJ's own documentation explicitly anticipates the exact symptom reported ("checklist not appearing / Activate Account button missing") and directs publishers to contact Client Support for it — meaning this scenario is common enough that CJ has a standard support path for it, not necessarily rare.

**I cannot distinguish between these from outside the account** — this requires either finding the checklist inside the dashboard (it may be on a specific "Account Settings" or "Getting Started" page, not the main Advertisers/Reports view) or CJ Support confirming the exact state directly.

## Before contacting support: two things worth checking yourself first

1. Look specifically at **Account Settings** (not the Advertisers search page) for a "Getting Started" or onboarding-checklist widget — CJ's docs say it should show remaining steps with checkmarks.
2. Look for a **"Complete Your Network Profile"** item specifically, separate from the promotional property — this is the one step not yet confirmed done.

If neither surfaces anything, use the escalation below.

## Prepared support message

**Where to send it:** CJ's Support Center at `members.cj.com/member/contactSupport.cj` (requires logging into your CJ account first — I can't do this, it needs your login), or by phone at **800-761-1072**. Sending it myself isn't possible — that support form is only reachable from inside an authenticated session.

**Message, ready to paste (no sensitive banking data included):**

> Subject: Account activation blocked — onboarding checklist not visible
>
> Hello,
>
> My CJ publisher account (promotional property: GridPermit) is fully accessible, but I'm unable to apply to advertiser program 5835771 (EnergySage). The application page returns: "The superuser on this account must complete the onboarding checklist and activate the account before you can apply to join advertiser programs."
>
> I don't see an onboarding checklist or an "Activate Account" control anywhere in my dashboard. For context on what's already done:
> - The GridPermit promotional property is confirmed Active.
> - My W-8BEN tax form has been submitted.
> - I've entered my Payoneer USD receiving account details in Payment Information, and the system acknowledged the change.
>
> Could you tell me exactly which onboarding step is still outstanding, or manually correct my account's activation state if everything required has in fact been completed?
>
> Thank you.

## What this does not do

- Does not log into CJ, submit this on your behalf, or guess/invent any account-specific detail (bank/routing numbers, TIN, Payoneer account details) — none of that appears above.
- Does not retry the EnergySage application blindly, per instruction.
