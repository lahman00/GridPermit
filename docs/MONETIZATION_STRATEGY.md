# GridPermit Monetization Strategy

Written 2026-08-14, after the national coverage milestone (50/50 states, 404 records, 328 READY). This document is the record of the Money Readiness Audit and the resulting decision. It is not a plan to revisit lightly — treat it as the working hypothesis until real conversion data proves or disproves it.

## 0. Audit findings this strategy is built on

Verified directly from the repository and live production (`https://mygridpermit.com`, commit `b0744e5`, CI green) on 2026-08-14:

- **328 READY, source-linked locality pages across 50 states** — the genuine asset. Each page (e.g. [Austin, TX](https://mygridpermit.com/texas/austin/solar-permit-guide/)) shows permit fees, rebates, utility/interconnection details, required documents, inspection steps, eligibility constraints, official contacts, and dated sources, with `BreadcrumbList` + `FAQPage` JSON-LD, a confidence badge, and an honest "last verified" date. This is real, defensible, decision-grade content — nobody else has assembled it this way for these specific cities.
- **Zero conversion path exists on any locality page.** [src/layouts/LocalityGuideLayout.astro](../src/layouts/LocalityGuideLayout.astro) has no CTA, no lead form, no partner link anywhere in its ~650 lines. A reader who finishes an Austin permit guide has nowhere to go except "Back to GridPermit."
- **The homepage is a California-only calculator**, not a national gateway. Title: "GridPermit - California Solar & Battery Savings Estimator." The hero, the ZIP-code tool, and the one existing outbound link (EnergySage) all live here — completely disconnected from the 328-page national dataset that's the actual product.
- **The one existing outbound link is a plain, honestly-disclosed, non-affiliate EnergySage link** (`https://www.energysage.com`, no tracking params, `rel="noopener noreferrer"` but not `rel="sponsored"`), present only on the homepage, with copy that explicitly says "GridPermit does not currently have an affiliate relationship with EnergySage and earns no compensation from it." This matches [docs/MONETIZATION_READINESS.md](MONETIZATION_READINESS.md), an earlier audit (2026-08-02) that reached the same conclusion and recommended staying at "plain referral" until a real partner relationship exists.
- **The site-wide nav CTA ("Estimate Savings") is broken for 49 of 50 states.** It appears on every page, including all 327 non-California locality pages, and links to `/#calculator` — a tool that only accepts California ZIP codes. A Texas or Nebraska reader who clicks the site's only prominent button hits a dead end ("This doesn't look like a California ZIP code. GridPermit currently covers California only.").
- **Analytics infrastructure is real and already well-built.** GA4 is wired sitewide via [src/components/Analytics.astro](../src/components/Analytics.astro), with a defined, PII-safe event taxonomy in [src/lib/analytics-events.ts](../src/lib/analytics-events.ts): `locality_guide_viewed`, `official_source_clicked`, `external_partner_clicked`, `permit_guide_clicked`, `search_used`, `faq_expanded`, `calculator_started/completed`, `blog_article_viewed`. Events fire via `data-track-view` / `data-track-click` / `data-track-toggle` attributes — no per-page wiring needed. `external_partner_clicked` and `permit_guide_clicked` are defined but **not currently attached to anything** on locality pages (confirmed: no such attribute exists in `LocalityGuideLayout.astro`).
- **No lead-capture form, no email capture, no backend, no serverless functions exist anywhere in the repo.** This is a fully static Astro site deployed to Netlify. Building a real lead-collection form today would mean collecting PII with no partner agreement to deliver it to and no privacy-policy language covering it — exactly the premature scaffolding the earlier audit already warned against.
- **Trust infrastructure is strong and should not be touched.** Every locality page has a disclaimer box, a footer disclaimer, an explicit "not legal/engineering/permit advice" statement, and a directive to verify with the actual AHJ/utility. `robots.txt` and the sitemap are correctly configured; Google Search Console ownership is verified (`public/googlea5625ff69127162c.html`), but this session has no GSC API access, so actual impression/click/query volume is **unknown** — the single biggest measurement gap (see Section 6).
- **Data maturity for the locality dataset itself:** 328 READY records is real coverage but is 1 (occasionally 2) locality per state — not comprehensive per-metro coverage anywhere. This matters directly for customer selection (Section 2).

## 1. Target customer

**Primary: the homeowner already on a locality page, monetized via referral — not paid by them directly, but the traffic they represent is sold.**

**Secondary (validate, don't build yet): the small solar installer or permit specialist, via a "GridPermit Pro" subscription.**

### Customer scoring

Scored 1 (worst) to 5 (best) against the audited product, not an idealized one.

| Customer | Pain intensity | GridPermit use frequency | Willingness to pay | Acquisition difficulty | Fit w/ existing data | Implementation cost | Competitive pressure | Recurring revenue potential | Monetizes *current* traffic | Solo-founder servable |
|---|---|---|---|---|---|---|---|---|---|---|
| A. Homeowner (referred, not billed) | 3 | 1 | 1 (direct) | 5 (already arriving) | 5 | 5 | 3 | 3 (aggregate, not per-user) | **5** | 5 |
| B. Small installer / permit specialist (Pro) | 4 | 4 | 3 | 2 (no channel today) | 3 | 3 | 4 (low *today*) | **5** | 1 (wrong audience today) | 4 |
| C. EPC / larger installation company | 4 | 3 | 4 | 1 (enterprise sales cycle) | 2 | 2 | 3 | 4 | 1 | 2 |
| D. Solar sales company (lead buyer) | 3 | n/a | 3 | 2 | 4 | 3 | 2 | 3 | 3 | 3 |
| E. Solar software / API customer | 4 | n/a | 3 | 1 | **1** | **1** | **1** | 4 | 1 | 2 |

**Why A wins for right now:** it is the only option that monetizes traffic that already exists, at near-zero build cost, with a channel (organic SEO) already running. Every other option requires *new* acquisition before it can earn a dollar — a much slower and more expensive first step for a solo founder auditing, not rebuilding, the product.

**Why B is the right secondary, not primary:** the data backs it up qualitatively (installers do pay for AHJ/permit tooling — see Section 3), and it's the more defensible long-term recurring-revenue engine. But GridPermit's current 328-record dataset is one-locality-per-state, not the multi-city-per-metro depth an installer actually needs day to day, and installers are not who's currently landing on the site. It needs its own acquisition motion and its own proof of willingness to pay — which is exactly why Phase 7 tests *interest*, not a live product.

**Why E (data/API) is explicitly rejected for now:** see Section 3 — Aurora Solar already bundles a 25,000+ AHJ database free with its design software, and a direct, well-funded competitor (AHJ.wiki) is building exactly this "structured AHJ compliance intelligence" product. GridPermit's 404 records is not remotely competitive as a standalone data product against either. Revisit only once the dataset is an order of magnitude deeper.

## 2. Competitive / money validation (2026 market)

Findings from public sources, captured 2026-08-14 (see individual citations inline; treat industry-blog figures as directional, not audited):

- **SolarAPP+** (NREL/DOE-funded, free to jurisdictions and installers) has been adopted by 450+ AHJs as of early 2026 and issues qualifying permits automatically, in hours. It is *not* a competitor for GridPermit's informational content — it automates the submission/approval step for jurisdictions that opt in, which is downstream of the "which utility, which documents, which fees" questions GridPermit answers. It does narrow the addressable pain for the subset of jurisdictions it covers.
- **Aurora Solar's AHJ Database** ships free to every Aurora design-software customer and already covers 25,000+ AHJs across seven categories of requirement (general, permitting, design, electrical, structural, ESS, ground mounts). This is the direct incumbent threat to any "sell AHJ data" plan — Aurora doesn't sell the data standalone because it doesn't need to; it's a retention feature bundled into a much larger paid platform GridPermit has no ambition to become.
- **AHJ.wiki** ("Permitting Intelligence for Distributed Clean Energy") is pursuing almost exactly the free-public-lookup + paid-team-tier structure this document considers for Model B — but as of this audit it is **pre-launch**, waitlist-only ("GET EARLY ACCESS," no live product, no published pricing). GridPermit already has 328 live, indexed, publicly-verifiable pages; AHJ.wiki has zero. This is a real but time-limited head start, not a reason for complacency.
- **Installer operations software** (SurgePV, QuoteIQ, Projul) prices AHJ/permit-tracking as one feature inside a much bigger paid platform: SurgePV runs ~$1,299–1,899/user/year (~$108–158/mo); QuoteIQ starts at $29.99/mo for a lighter tool. This is the useful price bracket for Model B's hypothesis — GridPermit Pro, as a narrow, single-purpose tool, should price below the full-platform tools and near the entry-level end.
- **PermitStack** sells raw *issued-permit* records (67M+ permits, 7,000+ cities) from $19/mo — a different product (transaction records, not AHJ requirement rules) and not a direct competitor, but confirms a market exists that will pay double-digit monthly fees for structured permit data via API.
- **Solar lead economics, 2026:** shared-marketplace leads run **$15–100** per lead industry-wide; EnergySage specifically runs a **publicly documented affiliate program at $9.60 per verified lead**, self-serve via CJ Affiliate or FlexOffers, typical approval in a few days, 45-day cookie window. This is the one number in this whole document that is a **verified, current, public rate** rather than an industry-blog estimate, which is why Model A's unit economics (Section 5) are built on it.

**What this rules out, explicitly:** GridPermit should not build a CRM, a design tool, a permit-submission product, or a standalone AHJ API today. The defensible wedge is being the best-trusted, fastest-to-answer *informational* layer — and turning the traffic that already generates into revenue before spending more effort deepening the dataset.

## 3. The offer (Model A — primary)

**Problem:** a homeowner who's read a real, source-verified permit guide for their city is at exactly the point of intent where "I now understand the permit — who actually installs this for me?" is the next question. GridPermit currently gives them no answer.

**Offer:** a clear, honestly-labeled call to action on every locality guide page — "Compare quotes from solar installers" — pointing to EnergySage's marketplace, upgraded from a plain unaffiliated link to a real, tracked EnergySage affiliate referral once the site owner completes EnergySage's self-serve affiliate signup (see Section 7 — this specific step needs the human account holder, not the agent, because it requires business/tax details).

**Pricing hypothesis:** $9.60 per delivered lead (EnergySage's own published affiliate rate) — not a hypothesis, a verified current rate, contingent on actually being accepted into their affiliate program.

## 4. Secondary offer (Model B, validate only — GridPermit Pro)

**Problem:** installers and permit specialists rebuild the same AHJ research from scratch, per job, per jurisdiction — the exact pain AHJ.wiki is also targeting, and the reason installer-ops tools price AHJ/permit tracking as a retention feature worth paying for.

**Offer to test (interest only, not a real product yet):** "GridPermit Pro" — downloadable permit checklists, saved AHJs, multi-city search, and change alerts once a jurisdiction's requirements are updated. A static interest page states this offer and a hypothesized price; a click is the only thing being measured.

**Pricing hypothesis:** **$29/mo**, bracketed against QuoteIQ's $29.99/mo entry tier and meaningfully below SurgePV's $108+/mo full-platform pricing — GridPermit Pro is deliberately narrower than either, so it should price at the low end of the comparable range. Explicitly a hypothesis to be revised by real interest-click data, not a committed price.

## 5. Unit economics

Every number below is tagged. **FACT** = independently verified this session (either from the live repo/production or a specific, checkable public source). **ASSUMPTION** = an industry-typical range used because no GridPermit-specific data exists yet. **CALCULATION** = arithmetic applied to the two categories above.

| Tag | Figure | Source |
|---|---|---|
| FACT | EnergySage affiliate payout: $9.60 per verified lead | EnergySage's own published CJ Affiliate/FlexOffers program terms, captured 2026-08-14 |
| FACT | 328 READY locality pages, 50 states represented, live in production | This repo, commit `b0744e5` |
| FACT | Current organic traffic volume | **Unknown — no GSC API access this session. This is the single largest gap in this entire analysis.** |
| ASSUMPTION | Locality-page-view → CTA-click rate | 2–5% (a prominent but non-intrusive CTA on long-form informational content; no GridPermit-specific data) |
| ASSUMPTION | CTA-click → EnergySage-completed-lead rate | 10–20% (typical marketplace on-site conversion for a warm, already-informed referral; EnergySage does not publish this rate) |
| ASSUMPTION | GridPermit Pro hypothesis price | $29/mo, bracketed against QuoteIQ ($29.99/mo) and SurgePV (~$108–158/mo) — see Section 2 |

### Model A (referral) — page views needed per MRR target

Using the midpoint assumptions (3% click rate × 15% completion rate = **0.45% of locality page views become a paid lead**, i.e. ~222 page views per lead, i.e. ~$0.043 revenue per locality page view):

| MRR target | Leads/mo needed (@ $9.60) | CTA clicks/mo needed (@ 15% completion) | Locality page views/mo needed (@ 3% click rate) |
|---|---|---|---|
| $100 | 11 | 70 | ~2,300 |
| $500 | 53 | 350 | ~11,600 |
| $1,000 | 105 | 700 | ~23,300 |
| $3,000 | 313 | 2,080 | ~69,300 |
| $10,000 | 1,042 | 6,950 | ~231,500 |

These are **CALCULATIONs from ASSUMPTIONs** — not a forecast. The real page-view number is unknown until GSC access or GA4 data is actually reviewed (first action item, Section 9).

### Model B (GridPermit Pro) — customers needed per MRR target

At the $29/mo hypothesis price:

| MRR target | Customers needed |
|---|---|
| $100 | 4 |
| $500 | 18 |
| $1,000 | 35 |
| $3,000 | 104 |
| $10,000 | 345 |

Acquisition channel for these customers does not exist yet (installers are not today's visitors) — this table exists purely to size the *interest-validation* bar, not to promise a funnel.

### Implementation cost / gross margin / time-to-first-revenue

| | Model A | Model B (interest test only) |
|---|---|---|
| Implementation complexity | Low — a CTA component + fixing the broken CA-only nav link + affiliate signup | Very low — one static page, one tracked click |
| Maintenance burden | Near-zero once live | Near-zero (no product exists to maintain yet) |
| Gross margin | ~100% (pure referral, no cost of delivery) | N/A — no product sold, only interest measured |
| Time to first $1 | Days to weeks — bounded by EnergySage's affiliate approval turnaround, not by engineering | N/A by design — this phase deliberately produces zero revenue, only a signal |

## 6. Decision

**Chosen primary model: Model A — free SEO traffic referred to EnergySage's installer marketplace, converted into commissioned leads once a real EnergySage affiliate relationship is in place.** Today, before that signup happens, the link stays exactly what it is: a plain, disclosed, non-affiliate outbound link earning nothing.

**Chosen secondary model: a GridPermit Pro interest-validation page** (Model B), run in parallel at near-zero cost, purely to start collecting a real willingness-to-pay signal before any subscription infrastructure is built.

**Decision criteria applied:**
1. *Fastest path to $1* — Model A, bounded only by EnergySage's affiliate approval time, not by build time.
2. *Fastest path to $100 MRR* — Model A; it scales with SEO traffic that's already live and growing, with no new acquisition cost.
3. *Leverages existing 404 records* — both models do; Model A leverages the traffic those records already generate today, which is the deciding factor over Model B.
4. *Does not require rebuilding GridPermit* — Model A requires adding a CTA and fixing one broken link, not touching the data pipeline, the layout architecture, or the trust/disclaimer system.
5. *Low operational burden* — Model A is a link; there is nothing to operate.
6. *Defensible with better AHJ data* — true of Model B specifically, which is exactly why it's kept alive as a parallel signal-gathering track rather than discarded outright.
7. *Can improve as SEO traffic grows* — Model A's revenue is a direct function of the traffic growth the last several sessions' work has already been producing.

### Rejected for now

- **Model C (AHJ data/API):** dataset is two orders of magnitude too small versus Aurora's bundled-free 25,000+ AHJ database and AHJ.wiki's dedicated (if pre-launch) competing product. Revisit only after the locality dataset is materially deeper.
- **Model D (sponsored locality):** requires a sales relationship with individual local installers, one city at a time — the least scalable model per unit of founder time, and the site currently has no visible "media kit" or traffic proof to sell against.
- **Model E (standalone permit checklist product):** the locality pages already function as the free checklist; building a separate paid "export" product before validating any willingness to pay (Model B's job) would be building ahead of a signal.
- **Model F (other affiliate/partner revenue):** no other partnership currently exists or was found to be a clear fit; EnergySage remains the only genuinely workflow-relevant partner identified. Revisit if/when a second qualified partner (e.g. a battery-specific or a permit-software affiliate program) surfaces.
- **A real lead-capture form:** deliberately not built. Building a PII-collecting form with no signed partner agreement, no consent copy, and no privacy-policy language covering it would be the exact premature scaffolding both this audit and the earlier `MONETIZATION_READINESS.md` audit warn against. EnergySage's own marketplace already has its own lead form — GridPermit's job is to be a well-placed, high-intent referral source into it, not to build a second one.

## 7. Implementation plan

Scoped to the smallest change that lets willingness-to-pay and click-through data start accumulating. See commit for the actual diff.

1. **Fix the broken nav CTA for non-California pages.** "Estimate Savings" currently links every one of the 327 non-CA locality pages to a California-only tool. Replace it, on non-CA pages, with a link to the EnergySage CTA section instead of a dead end.
2. **Add a real, disclosed CTA to every locality guide page** (`LocalityGuideLayout.astro`), placed after Official Contacts / before the footer disclaimer — the point in the page where a reader has just absorbed the actual permit facts and is closest to "who does this for me." Wire it to the existing `external_partner_clicked` and `permit_guide_clicked` GA4 events (already defined, previously unused).
3. **Keep the EnergySage link as a plain, honestly-disclosed non-affiliate link** until the site owner completes EnergySage's affiliate signup (CJ Affiliate / FlexOffers) — a business-account action outside this agent's authority (see Section 9, human action items). The moment that link becomes a real tracked affiliate URL, update the disclosure copy in the same place — never leave "no relationship" language in place once one exists (the exact trap the earlier audit already flagged).
4. **Add a "GridPermit Pro" interest page** stating the offer and the $29/mo hypothesis, with a single tracked "I'd pay for this" click (a new, explicitly-scoped analytics event) — no email collection, no account, no billing.
5. **No new analytics vendor, no new backend, no lead form.** Everything above works within the existing static Astro + GA4 stack.

## 8. Measurable success criteria

- **Model A, week 1–2:** `external_partner_clicked` / `permit_guide_clicked` event volume > 0 and trending with locality-page traffic — proof the CTA is being seen and used at all.
- **Model A, first real signal:** EnergySage affiliate application accepted, first tracked click recorded, first commissioned lead confirmed in the CJ/FlexOffers dashboard — this is "first $1."
- **Model A, $100 MRR checkpoint:** ~11 completed leads/month sustained for two consecutive months (see Section 5 table) — confirms the funnel assumptions were directionally right, not just a one-off.
- **Model B interest signal:** meaningful click-through on the Pro interest page (no fixed threshold set here deliberately — the point is to see whether the number is closer to 0.1% or 5% of viewers, since either answer changes what happens next) sustained over at least 500 page views, to avoid a false read from a handful of clicks.
- **Failure condition, Model A:** if CTA click-through stays near zero after the CTA has been live and indexed for 4–6 weeks (enough time for it to be seen by returning/new organic traffic), the placement or copy — not the underlying model — is the first thing to revisit before abandoning referral revenue as a wedge.
- **Failure condition, Model B:** if the Pro interest page collects near-zero clicks after a comparable traffic exposure window, that is a real signal installers are not finding GridPermit today (a traffic/acquisition problem, not a pricing problem) — the next move would be testing an installer-specific acquisition channel before touching the offer or price again.

## 9. What remains intentionally unbuilt, and the next experiment

**Unbuilt on purpose:**
- Any real lead-capture form or backend.
- Any billing, authentication, or account system for GridPermit Pro.
- Any AHJ/permit data API.
- Any sponsored-locality sales infrastructure.
- Any change to the trust/disclaimer system, the locality-record data pipeline, or the 404-record dataset itself.

**Human action required (outside agent authority):** completing EnergySage's affiliate signup via CJ Affiliate or FlexOffers requires the site owner's own business and tax details — this agent will not create that account. Once approved, swap the plain link for the real tracked affiliate URL and update the disclosure copy in the same commit.

**The exact next experiment:** ship the CTA + fixed nav link + Pro interest page (Section 7), let them run against real organic traffic for 2–4 weeks, then pull GA4 event counts for `external_partner_clicked`, `permit_guide_clicked`, and the new Pro-interest event. That data — not more speculation — decides whether Model A gets deepened (better CTA placement, a second partner) or Model B gets promoted from a signal-gathering page into a real product.
