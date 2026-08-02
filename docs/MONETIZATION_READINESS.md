# Monetization Readiness Audit

An honest read of GridPermit's current monetization surface as of 2026-08-02. **No partner relationship, tracking ID, or lead-collection flow exists today.** This document audits what's actually in the repo, flags what's inconsistent, and lists what would need to exist before any real monetization step could be taken responsibly. It recommends the safest *next* step — it does not implement one.

## 1. Current EnergySage link

**Location:** [src/pages/index.astro:152](../src/pages/index.astro) (homepage results panel, "Compare Quotes From Solar Installers").

```html
<!-- NOTE: plain, non-affiliate external link — no tracking ID configured yet.
     Do not add rel="sponsored" or compensation language until a real
     affiliate/tracking URL is supplied. -->
<a href="https://www.energysage.com" target="_blank" rel="noopener noreferrer" class="btn-green-action-link">
  Visit EnergySage →
</a>
<p>You'll continue on EnergySage's website. This is a plain external link —
GridPermit does not currently have an affiliate relationship with EnergySage
and earns no compensation from it.</p>
```

**Finding: plain external link, accurately disclosed.** The URL (`https://www.energysage.com`) has no query parameters, referral codes, or tracking IDs. `rel="noopener noreferrer"` is present (correct for a new-tab external link) but **not** `rel="sponsored"`, which would misrepresent it as a paid placement. The inline disclosure sentence directly and correctly states there is no affiliate relationship and no compensation. This is the one part of the monetization surface that is already accurate and requires no change.

**Inconsistency worth flagging (not fixing — this is a legal-text decision, not a code bug):** the sitewide footer disclosure, present on every page, reads:

> "We may receive compensation when users visit or use services offered by our affiliate partners, at no additional cost to the user."

This is a general, forward-looking disclosure that could reasonably describe a *future* state once real partners exist — but read next to the EnergySage-specific text ("does not currently have an affiliate relationship... earns no compensation"), a careful reader could be confused about whether GridPermit has affiliate relationships right now. Recommend clarifying this footer language (e.g., "GridPermit does not currently have any affiliate or compensation relationships; if this changes, it will be disclosed here and on each relevant page") the next time the footer is touched for another reason — not urgent enough to justify a standalone content-only PR today.

## 2. Lead capture

**Current state: no lead-capture form exists anywhere in the codebase.** Confirmed by searching every page/component for `type="email"`, `type="tel"`, and any name/email/phone input — the only matches are CSS class names (`lead-action-box`, `lead-paragraph`) used for visual styling, not actual data collection. The homepage calculator itself explicitly avoids collecting personal information: it takes a ZIP code and a monthly bill figure, processes both client-side, and its own Privacy Policy states this directly ("Our calculator operates without requiring personal contact details such as names, email addresses, or phone numbers").

**Where a future lead form would logically appear**, if one were ever built:
- On each locality guide page (`src/layouts/LocalityGuideLayout.astro`), near the "Official Contacts" or footer-disclaimer section, framed as "Get quotes from installers serving {city}" — high-intent placement, since a reader who made it through permit/eligibility details is closer to a real decision.
- On the homepage, replacing or supplementing the current "Coming Soon" savings/payback results once real utility rate data exists (per `docs/DATA_ARCHITECTURE.md` Section 6), rather than bolting a form onto the current placeholder-estimate flow.
- Never on the blog posts or methodology/about pages — those are informational, not decision-stage content.

**Per this audit's explicit instructions, no live lead-collection form has been published**, and none should be until the prerequisites in Section 4 are actually in place.

## 3. Contact email domain

**Finding: `@gridpermit.com` is used in two places, while the live site is `mygridpermit.com`.**

| File | Usage |
|---|---|
| [src/pages/contact.astro:35](../src/pages/contact.astro) | `support@gridpermit.com`, `privacy@gridpermit.com` |
| [src/pages/privacy.astro:37](../src/pages/privacy.astro) | `privacy@gridpermit.com` |

The site's actual domain, confirmed in `astro.config.mjs` (`site: 'https://mygridpermit.com'`) and used consistently for every canonical URL and Open Graph tag sitewide, is **`mygridpermit.com`** — not `gridpermit.com`. This exact discrepancy was already flagged as an open item in the original repository audit (item G1) and remains unresolved.

**This document does not change these email addresses.** Per this phase's explicit instruction ("do not change until confirmed"), only the site owner can confirm whether `gridpermit.com` is a real, separately-owned domain with working mail (a common and legitimate pattern — companies often keep a bare apex domain for email while serving the live site from a different subdomain or domain), or whether these addresses are a leftover from an earlier domain choice and should be updated to `@mygridpermit.com`. Sending a real support/privacy inquiry to an address that silently bounces would be a genuine trust failure, so this should be confirmed before any monetization work that depends on these addresses (e.g. a partner agreement's contact clause) proceeds.

## 4. Prerequisites for lead generation (none currently satisfied)

| Prerequisite | Status |
|---|---|
| Privacy disclosure covering data collected by a lead form | **Missing.** Current Privacy Policy explicitly describes a form-free calculator; it says nothing about what would happen if contact details were ever collected. |
| Consent language (opt-in for contact by a partner/installer) | **Missing.** No consent mechanism exists because no data-collecting form exists. |
| Data retention policy | **Missing.** Not addressed anywhere in `privacy.astro` or `terms.astro`. |
| Partner disclosure (who receives submitted leads, and why) | **Missing** — there is no partner to disclose. |
| Geographic eligibility enforcement | **Partially exists** for the calculator (ZIP-range check limits to California), but this logic has never been extended to a lead-submission context. |
| Spam/bot protection | **Missing.** No CAPTCHA, rate-limiting, or honeypot exists anywhere (there's nothing to protect yet). |
| Lead-quality fields (e.g. homeownership status, timeline to purchase) | **Missing** — no lead form exists to have fields. |
| Analytics events around lead submission | **Missing** — see Phase 10 of this session, which adds a general event helper but does not add a lead-submission event, since no lead flow exists to instrument. |
| A real partner agreement | **Does not exist.** No installer, marketplace, or lead-buyer relationship has been established. |
| A defined payout model (CPL, rev-share, flat sponsorship, etc.) | **Not defined** — cannot be defined before a partner exists. |

**None of these should be built speculatively.** Building a consent flow or data-retention policy for a lead form that doesn't exist yet risks exactly the kind of premature, unused scaffolding this project's engineering principles already warn against — the right sequence is: secure a real partner and payout model first, then build the specific consent/disclosure/retention language that partner's terms actually require.

## 5. Recommended safest initial monetization method

**Plain outbound referral links (what already exists with EnergySage) is the correct starting point, and should remain the only monetization surface until a real partner agreement exists.**

Ranked by risk, from what's already safely in place to what would require the most groundwork:

1. **Plain outbound referral link (current state)** — zero data collected, zero compensation claimed, fully accurate disclosure. No further action needed here beyond the footer-language clarity note in Section 1.
2. **Affiliate link (future, only once a real relationship exists)** — the next natural step if/when GridPermit signs an actual affiliate agreement with EnergySage or a similar marketplace. Requires: updating the EnergySage link to the partner's real tracking URL, updating the disclosure text to accurately describe the relationship (never leaving stale "no relationship" language in place once one exists), and adding `rel="sponsored"`.
3. **Sponsorship (a flat placement fee, no per-lead tracking)** — lower integration complexity than CPL, but requires a willing sponsor and its own disclosure language ("sponsored content" / paid-placement labeling).
4. **Direct CPL (cost-per-lead) or lead form** — the highest-effort, highest-risk option, requiring every item in Section 4 to be genuinely in place first, plus a signed partner agreement defining exactly what "a qualified lead" means and how payout is calculated. Should not be attempted before GridPermit has both real traffic (to make it worth a partner's integration effort) and a completed locality-data rollout (so leads can be geographically qualified against verified permit/utility data, which is the actual product differentiation this site is building toward).

**Bottom line:** stay at step 1 (plain referral, honestly disclosed) until there is a real, signed relationship to describe — at which point steps 2 or 3 are both safe next moves, in that order of likely fit for an educational/informational site like this one.
