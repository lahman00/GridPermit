# Affiliate Partner Pipeline — Full Audit

Written 2026-08-15. This document supersedes the narrower `docs/AFFILIATE_PIPELINE.md` (single-program EnergySage tracker) as the canonical partner pipeline. It records grounded, primary-source verification of 23 named candidates against GridPermit's actual current state: **341 live locality pages, 100% solar/battery permit content, zero HVAC/roofing/electrical/general-home-services/contractor-software content** (confirmed via `docs/FUTURE_EXPANSION.md` — none of those verticals has been built, and none is in scope right now).

**No production monetization changes were made while producing this document.** Every finding below was verified via live web research (WebSearch/WebFetch/curl against primary sources — company sites, network advertiser pages, or the company's own affiliate/partner page) on 2026-08-15. Where a fact could not be verified from a primary source, it is marked **NOT FOUND** — nothing here is guessed or extrapolated from a similar-sounding company.

---

## Master status index (normalized vocabulary)

This is the single source of truth for every candidate investigated across all research passes. Statuses use only this controlled vocabulary: `DISCOVERED` / `NEEDS_VERIFICATION` / `VERIFIED` / `APPLICATION_STARTED` / `OWNER_ACTION_REQUIRED` / `CONTACTED` / `WAITING_FOR_NETWORK` / `PENDING_APPROVAL` / `APPROVED` / `TRACKING_LINK_RECEIVED` / `PRODUCTION_ACTIVE` / `REJECTED`. Detailed narrative for each candidate remains in the dated pass sections below — this table is the index, not a replacement for that detail.

| Candidate | Status | One-line reason |
|---|---|---|
| EnergySage (existing relationship) | `OWNER_ACTION_REQUIRED` | Real Channel Partner account + CJ advertiser ID 5835771 exist; partner landing page 404s, CJ program blocked on Payoneer/payment onboarding |
| HomeAdvisor | `WAITING_FOR_NETWORK` | Real self-serve CJ signup exists, same account-activation blocker as EnergySage's CJ program |
| Profitise | `CONTACTED` | Inquiry sent per user report (not independently verified by me); awaiting reply |
| Angi | `CONTACTED` | Same as Profitise |
| BigBattery | `APPLICATION_STARTED` | Step 1 completed with zero fabrication; final submission blocked by this environment's own permission layer |
| Power Queen | `OWNER_ACTION_REQUIRED` | Real Awin merchant 118441 confirmed + GoAffPro direct route found; both need account creation |
| MatchBurst | `OWNER_ACTION_REQUIRED` | Same Awin account blocker as Power Queen (consolidated, not duplicated) |
| PVBAT | `OWNER_ACTION_REQUIRED` | Real, no password, blocked on a real traffic/followers figure GridPermit doesn't have |
| Docan Power | `OWNER_ACTION_REQUIRED` | Hard stop — password + payment + Tax ID + CAPTCHA all on the first screen |
| Advertising Results Inc. | `OWNER_ACTION_REQUIRED` | Real form, no password, blocked on missing legal entity/address/phone |
| First Call Solutions | `OWNER_ACTION_REQUIRED` | Real, no password; weak vertical specificity (no roofing/HVAC/electrical named) |
| OnCore Leads | `OWNER_ACTION_REQUIRED` | Real, solar+HVAC+roofing+electrical all named; no payout published |
| homeyou | `OWNER_ACTION_REQUIRED` | Confirmed live Solar Energy directory category; "Apply Now"/"Login" pairing implies account creation, unconfirmed |
| Bark.com (Awin) | `OWNER_ACTION_REQUIRED` | Best-documented terms found (up to $100/lead, 30-day cookie); same Awin account blocker |
| Signature Solar | `OWNER_ACTION_REQUIRED` | Real, documented (up to 9%, 7-day cookie); product-affiliate model, application page didn't fully render for field confirmation |
| Aragon Advertising | `NEEDS_VERIFICATION` | Credible, established network; solar vertical itself unconfirmed — outreach drafted in `PARTNER_OUTREACH_QUEUE.md` |
| Modernize (QuinStreet) | `OWNER_ACTION_REQUIRED` | Real, public-company-backed, solar+roofing+HVAC listed; terms opaque until applied |
| Fixr.com | `OWNER_ACTION_REQUIRED` | Real, solar included; login-gated portal, likely requires account creation |
| Bluetti | `VERIFIED` | Real, 10% up to, 30-day cookie, network choice (Impact/Awin/CJ) — `OWNER_ACTION_REQUIRED` for account creation |
| EcoFlow | `VERIFIED` | Real, min. 5%, 7-day cookie — `OWNER_ACTION_REQUIRED` for account creation |
| ALLPOWERS | `VERIFIED` | Real, 5–10% tiered, 30-day cookie, explicitly welcomes review/comparison sites — `OWNER_ACTION_REQUIRED` for account creation |
| Autel Energy | `OWNER_ACTION_REQUIRED` | Real, 10%, 30-day cookie, fills the EV-charger gap; payout requires a PayPal account (payment info — owner-only) |
| Jackery | `NEEDS_VERIFICATION` | Real program page confirmed live; commission/cookie figures only aggregator-sourced, not confirmed on Jackery's own page |
| Renogy | `NEEDS_VERIFICATION` | Real, on-brand; commission (~6%) and cookie (30-day) only secondary-sourced |
| Generator Mart | `NEEDS_VERIFICATION` | Affiliate page exists but blocked automated fetch (409); "8% commission" is **UNVERIFIED PAYOUT** (aggregator-only) |
| Firman Power Equipment | `NEEDS_VERIFICATION` | Real page, no published commission/cookie, curated/influencer-oriented application, not a clean SEO-affiliate fit |
| power.solar | `REJECTED` | Explicitly targets "real estate professionals, contractors, community organizations, environmental influencers" — not content/SEO publishers |
| Digital Master Media | `NEEDS_VERIFICATION` | Reclassified from REJECTED — real, solar payout confirmed ($53/call); blocked on missing GridPermit traffic data, see `PAY_PER_CALL_FEASIBILITY.md` |
| BuyTheCalls | `NEEDS_VERIFICATION` | Same reclassification and same blocker as Digital Master Media |
| BrokerCalls | `REJECTED` | Real, but solar vertical is a sales-lead category, not content-aligned; no battery vertical |
| CallVox | `REJECTED` | Real, no solar/battery vertical at all |
| PermitFlow partners | `REJECTED` | Real company; partner program reads as B2B (integrations/resellers/associations), no evidence of a content-publisher track |
| Permit Hub | `REJECTED` | Reopened twice, confirmed unchanged both times — audience is contractors/businesses, no published terms |
| Kohler Generators | `REJECTED` | Re-verified per specific request — the real Kohler affiliate program (FlexOffers, 2.4%/30-day) is for bath/kitchen fixtures, not generators; the generator-specific partner page is a B2B dealer network |
| SUNcheck / SUNcheck Inc. | `REJECTED` | Claimed "$1,000/365-day" figure could not be traced to any source, including aggregators; their own sites don't mention an affiliate program at all |
| eLocal | `REJECTED` | Pay-per-call, but gated to "experienced" affiliates with existing campaigns — GridPermit doesn't qualify as a first-time entrant |
| Inquirly | `REJECTED` | No publisher/affiliate program found at all |
| DOPPCALL | `REJECTED` | Real, SEO-friendly, but no solar vertical found |
| Lead Smart | `REJECTED` | Mixed trust signals reinforced by an unresolved $6,326 payment dispute; no solar vertical |
| Home Services Lead Group | `REJECTED` | Solar now listed as a vertical, but legitimacy remains unverifiable (no BBB/press/address/phone/network listing) |
| Jobtable | `REJECTED` | B2B contractor SaaS, wrong audience; own published terms internally inconsistent (20% vs 30%) |
| OnCrew | `REJECTED` | B2B contractor software, wrong audience (installer-recruitment program at Atomi Smart specifically, not a paid affiliate mechanism for OnCrew itself — see full detail below) |
| JobCloser | `REJECTED` | B2B contractor SaaS, wrong audience |
| bidyou.ai | `REJECTED` | B2B construction-estimating tool, wrong audience, terms unconfirmed |
| Atomi Smart | `REJECTED` | "Atomi Alliance" is an installer-recruitment network, not a paid-commission affiliate program |
| Polyares | `REJECTED` | Real, but 20+ general trade categories, no solar/battery vertical |
| LeadBank / Home Alliance | `REJECTED` | Real, but no solar/battery vertical found |
| Callvanta | `REJECTED` | Identity ambiguous (callvanta.pro inaccessible, callvanta.com is an unrelated company) |
| CallX | `REJECTED` | Confirmed life-insurance-only on the primary source |
| Current Home | `REJECTED` | No verifiable entity found |
| PreConstruct AI | `REJECTED` | No verifiable entity found |
| Filter King | `REJECTED` | Real, well-documented Awin terms; zero HVAC content exists on GridPermit today |
| Factory Direct Filters | `REJECTED` | Same reasoning as Filter King |
| Roofing4US | `REJECTED` | Building-materials retailer, wrong content type |
| PlotForge | `REJECTED` | Best-documented terms of any candidate; zero fit (new-construction contractors, not homeowners) |
| CostToBuildHouse | `REJECTED` | Program confirmed **inactive** ("no longer active") on direct re-check — was previously the top APPLY-NOW pick |
| Networx | `REJECTED` | Weak/no dedicated solar category, opaque terms |

---

## ✅ Resolved: the EnergySage CTA 404 flagged above

`https://www.energysage.com/p/gridpermit/` was confirmed 404ing at time of writing. Per your explicit go-ahead, all 6 live EnergySage CTAs were reverted to the plain, working `https://www.energysage.com` root link (commit `4023c19`, deployed and production-verified). This is not a new application — it's GridPermit's existing relationship, currently paused pending EnergySage fixing the partner page on their end. See §"Application Queue" below for genuinely new programs to apply to.

---

## Verification methodology

For each candidate: company/program existence, network, application URL, US coverage, vertical, eligibility, SEO/content-traffic policy, commission model, cookie window, application requirements, prohibited traffic, and GridPermit content-fit — verified via the company's own site, its network's advertiser/merchant listing (CJ, Awin, FlexOffers, Rewardful, FirstPromoter), or (for Angi/HomeAdvisor's corporate structure) an SEC filing. Four parallel research passes were run; all claims below are traceable to a cited URL.

## Classification definitions

| Class | Meaning |
|---|---|
| **APPLY NOW** | Verified real program, self-serve/instant approval, published terms, no dealbreaker — safe to apply today (application itself still requires the owner's business/tax/payment details, per standing rule that no agent creates financial accounts) |
| **OWNER ACTION REQUIRED** | Verified real program, but application is gated behind an account, email inquiry, or manual review only the owner can complete |
| **NEEDS VERIFICATION** | Program or company exists but key terms (commission, legitimacy, or fit) are unconfirmed — do not commit until further diligence |
| **REJECT** | No verifiable program, no fit, or a confirmed dealbreaker (wrong mechanism, unverifiable legitimacy, wrong audience) |

---

## Candidate-by-candidate findings

### 1. EnergySage — solar marketplace
- **Two distinct relationships — do not conflate:** (A) GridPermit's own Channel Partner page `energysage.com/p/gridpermit/` — **currently 404, see urgent flag above**. (B) EnergySage's public self-serve **CJ Affiliate** program: [public.cj.com/signup/publisher?advertiserId=5835771](https://public.cj.com/signup/publisher?advertiserId=5835771), confirmed live, "Partner with EnergySage," pay-per-qualified-lead, nationwide. Commission/cookie not published pre-approval (previously documented as $9.60/lead, 45-day cookie in `docs/AFFILIATE_PIPELINE.md` from a prior session — not re-confirmed publicly this session, likely gated behind CJ login now).
- **Network:** CJ Affiliate (B); unclear for A given the 404.
- **US coverage:** Yes. **Vertical:** Solar — direct fit, already GridPermit's primary CTA.
- **SEO traffic:** Not addressed on the public page either way.
- **Eligibility:** Requires an active CJ publisher account (business/tax/payment info — owner-only).
- **Classification: OWNER ACTION REQUIRED** (for the CJ program) + **URGENT FIX NEEDED** (for the currently-broken Channel Partner page already live in production).

### 2. Angi — general home services
- **Exists/active:** [angi.com/landing/affiliatepartners](https://www.angi.com/landing/affiliatepartners), confirmed live.
- **Network:** Direct in-house — **not** a public CJ/Impact/Awin listing (some secondary sources claim an Impact program at "25% commission"; no primary-source confirmation found, treat as unverified).
- **Application:** Email-only inquiry to `affiliate@angi.com` — no self-serve signup.
- **Commission/cookie:** Not published; requires inquiry.
- **Vertical:** General home services, not solar-specific.
- **Fit:** Weak — no dedicated GridPermit page for general home services exists today; would only work as a generic footer/homepage "other services" link.
- **Classification: NEEDS VERIFICATION** (must email to learn real terms before any decision).

### 3. HomeAdvisor — general home improvement
- **Exists/active:** [homeadvisor.com/rfs/aboutus/affiliates/affiliateSignup.jsp](https://www.homeadvisor.com/rfs/aboutus/affiliates/affiliateSignup.jsp), confirmed live.
- **Network:** **CJ Affiliate**, self-serve signup confirmed: `signup.cj.com/member/brandedPublisherSignUp.do?air_refmerchantid=2236060` (merchant ID 2236060). Runs independently of Angi's in-house program despite the corporate merger (confirmed via [SEC DEF 14A](https://www.sec.gov/Archives/edgar/data/1705110/000170511022000043/angidef14a2022.htm) — Angi/HomeAdvisor unified under one company in 2021, but the separate CJ program is still live today).
- **Commission/cookie:** Not published pre-approval — "aggressive payouts for qualified leads/calls."
- **Vertical:** General home improvement, not solar-specific.
- **Fit:** Same weak-fit reasoning as Angi — same CJ publisher account as EnergySage would cover this at zero incremental account-creation cost.
- **Classification: OWNER ACTION REQUIRED** (real, self-serve CJ signup exists).

### 4. Kohler Generators
- **Finding:** `kohlerhomeenergy.rehlko.com/become-a-kohler-partner` is a **dealer/reseller partner program** (businesses reselling Kohler product lines), not a consumer content-affiliate program — no commission/cookie/publisher terms anywhere on the page. A separate $300 customer-referral rebate exists (per a third-party blog, not Kohler's own site) but is a loyalty rebate for existing owners, not a content-affiliate mechanism.
- **Classification: REJECT** — no verifiable content-affiliate program exists.

### 5. eLocal — home services pay-per-call network
- **Exists/active:** [elocal.com/affiliate-contact](https://www.elocal.com/affiliate-contact/), confirmed live, now part of HomeServe Plc.
- **Network:** Direct in-house pay-per-call.
- **Application:** Gated questionnaire, explicitly requires **existing pay-per-call campaign experience** — not self-serve for a new content publisher.
- **Model mismatch:** Pay-per-call requires a phone-call generation mechanism GridPermit doesn't have (static content site, no click-to-call funnel).
- **Classification: REJECT** — structural mismatch (no call funnel) and selective-admission gate GridPermit doesn't currently meet.

### 6. Filter King — HVAC air filters
- **Exists/active:** [filterking.com](https://filterking.com/), Awin merchant 125512. Commission **7.5%**, cookie **30 days**. Excludes coupon/deal sites (fine for a content site).
- **Vertical:** HVAC filters. **Fit: none today** — GridPermit has zero HVAC content.
- **Classification: REJECT (fit)** — legitimate, well-documented program; revisit only if GridPermit ever builds HVAC content (not currently planned, see `docs/FUTURE_EXPANSION.md` §2).

### 7. Factory Direct Filters — HVAC air filters
- **Exists/active:** [factorydirectfilters.com](https://factorydirectfilters.com/), on FlexOffers. Commission **4%**, cookie **30 days**.
- **Classification: REJECT (fit)** — same reasoning as Filter King.

### 8. Roofing4US
- **Finding:** Real company, but it's a **roofing materials/supplies retailer** (metal roofing, insulation, skylights), not a roofing-service or lead-gen business. Awin merchant 80381, commission **2%**, cookie **30 days**.
- **Classification: REJECT** — wrong content type (materials e-commerce, not permit-relevant) plus no roofing content on GridPermit at all.

### 9. Home Services Lead Group
- **Finding:** A website exists (`homeservicesleadgroup.com/affiliates`) claiming a 22-vertical PPC/PPL marketplace, but **zero independent corroboration found** — no BBB profile, no reviews, no press mentions, no address/phone, not listed on any known affiliate network. Solar is not even among its claimed verticals.
- **Classification: REJECT** — cannot verify legitimacy; do not pursue an unvetted company with no confirmable track record.

### 10. Lead Smart
- **Finding — name ambiguity, two unrelated companies:** (a) **Lead Smart Inc** (leadsmartinc.com), home-services pay-per-call network, BBB-listed but **not accredited**, mixed trust signals (one scam-detection service scored it 19.9/100), no published commission/cookie, no solar vertical confirmed. (b) **LeadSmart Technologies** — an unrelated B2B industrial-CRM reseller program, irrelevant to GridPermit.
- **Classification: REJECT** — for (a), unresolved trust-signal concerns plus no solar vertical; (b) is not applicable.

### 11. Permit Hub
- **Finding — two unrelated entities:** (a) `permithub.com` — real B2B permit/inspection SaaS for contractors; has a `/partners/` page mentioning referral commissions but **no published rate, cookie window, or terms** (privately negotiated on application). (b) Inspected.com's "Permit Hub" feature — Florida-only permit tracking, **no affiliate program found at all**.
- **Fit:** Poor for both — 100% B2B contractor tooling, not homeowner-facing, not solar-specific.
- **Classification: REJECT (fit)** for (b); **NEEDS VERIFICATION** for (a) only if GridPermit ever builds contractor-facing content (not in scope).

### 12. PlotForge (siteplangenerator.com)
- **Exists/active:** Confirmed, brands itself "PlotForge™," affiliate program via **FirstPromoter** ([siteplangenerator.firstpromoter.com](https://siteplangenerator.firstpromoter.com/)). This is the **best-documented commission structure of any candidate in this audit**: tiered **25%/35%/50% recurring** (by referral volume) for 12 months, 10–20% residual after, flat 20% on one-time $149 orders, **90-day last-click cookie**, $50 minimum payout, 45-day hold.
- **Vertical:** Automated site-plan generator for new-construction building permits — a contractor/builder tool, not solar-specific.
- **Fit: none today** — serves new-build site plans, not homeowner solar/battery retrofits.
- **Classification: REJECT (fit)** — genuinely excellent terms, but zero contextual placement on GridPermit's current content. Worth revisiting only if a new-construction-adjacent vertical is ever built.

### 13. CostToBuildHouse
- **Exists/active:** Confirmed, affiliate program via **Rewardful** ([equin-global-llc.getrewardful.com](https://equin-global-llc.getrewardful.com)). Instant approval, no traffic minimum, explicitly welcomes content creators/bloggers/SEO traffic. Commission **30% on Construction Cost Report** ($6/sale), **33% on Contractor Bid Review** ($10/sale), **30-day cookie**. Covers all 50 states.
- **Vertical:** New-construction cost estimation and a "Permit Intelligence Report" — permit-adjacent, homeowner-facing.
- **Fit:** Weak-to-moderate — same broad "homeowner researching permits" audience, low barrier to test, but per-sale revenue is small ($3–10) and the product isn't solar-specific.
- **Classification: APPLY NOW** — real, instant-approval, explicitly SEO-friendly terms; lowest-risk candidate to actually test in this entire list (still requires the owner's payment details to receive payout, per standing rule).

### 14. Current Home
- **Finding: NOT FOUND.** No verifiable company, product, or website under this exact name — all searches returned only unrelated entities (utility electrification programs, Apple/Google Home, Homes.com). Highly generic name; no substitution made.
- **Classification: REJECT** — no verifiable entity.

### 15. PreConstruct AI
- **Finding: NOT FOUND.** No company/product named "PreConstruct AI" or at preconstruct.ai found in Crunchbase, Product Hunt, or general search. Real adjacent players exist (PermitFlow, GreenLite Technologies) but were **not** substituted for this name.
- **Classification: REJECT** — no verifiable entity.

### 16. MatchBurst
- **Exists/active:** matchburst.com, Miami-based multi-vertical home-improvement lead platform (roofing, gutters, **solar**, plumbing, HVAC, remodel, security). Affiliate program confirmed via [Awin merchant profile 114854](https://ui.awin.com/merchant-profile-terms/114854), CPL model, US-only traffic.
- **Commission/cookie:** Not disclosed publicly (varies by vertical, visible only in Awin dashboard).
- **Prohibited traffic:** Incentivized traffic, scraping/co-reg, brand-term bidding (per Awin standard terms).
- **Fit:** Plausible partial fit — solar is one of its verticals, but it's a general multi-vertical broker, not solar-specific.
- **Classification: NEEDS VERIFICATION** — real program, but actual solar-specific terms only visible after Awin application.

### 17. Profitise
- **Exists/active:** profitise.com, direct (not on a major network) US lead-gen network explicitly covering **solar** and insurance leads/calls. Pay-per-lead, rate undisclosed; separately a 3% sub-affiliate override, paid bi-weekly.
- **SEO/content traffic:** Site language suggests no restriction ("freedom of choice how/where/when to run campaigns").
- **Fit: Strong direct fit** — solar-lead affiliate program, directly on-topic.
- **Classification: OWNER ACTION REQUIRED** — legitimate on-topic opportunity; actual payout terms require direct outreach/application, which needs the owner's business details.

### 18. OnCrew
- **Finding — two unrelated companies:** (a) oncrew.ai — US AI phone-answering for HVAC/plumbing/electrical/roofing contractors, direct affiliate program (25% of subscription revenue, first 12 months, email-based signup, no self-serve URL). (b) oncrew.com.au — unrelated Australian workforce SaaS.
- **Fit:** None — B2B software sold to contractors; GridPermit's readers are homeowners, not the buyer.
- **Classification: REJECT** — wrong audience.

### 19. JobCloser
- **Exists/active:** jobcloser.com, field-service-management software for trades. Self-serve affiliate signup ([jobcloser.com/affiliateprogram](https://www.jobcloser.com/affiliateprogram/account/signup)), **10% of referral's payment, first 6 months only**.
- **Fit:** None — B2B contractor SaaS.
- **Classification: REJECT** — wrong audience.

### 20. Jobtable
- **Exists/active:** jobtable.com, contractor job-management software. Self-serve program page states **both 20% and 30%** recurring commission in different places — an internal inconsistency worth flagging as a minor trust concern on its own, separate from the fit issue.
- **Fit:** None — B2B contractor SaaS.
- **Classification: REJECT** — wrong audience, plus unresolved terms inconsistency.

### 21. bidyou.ai
- **Exists/active:** AI construction-estimating tool for contractors/estimators. Footer references an affiliate program and disclosure page, but **no commission, cookie, or eligibility terms could be retrieved**.
- **Fit:** None — B2B estimating tool, not homeowner-facing.
- **Classification: REJECT** — wrong audience; terms also unconfirmed.

### 22. Atomi Smart
- **Finding — two unrelated companies share the name:** (a) atomismart.com, real US smart-home hardware brand (mini-splits, fans, lighting). Its "Atomi Alliance" is an **installer-recruitment network, not a commission affiliate program** — no monetary terms published anywhere. (b) Atomi Systems Inc. — unrelated Vietnam-based eLearning software company with its own, separate affiliate program (25%/sale via 2Checkout) — **do not conflate with (a)**.
- **Classification: REJECT** — (a) isn't actually a paid-affiliate mechanism; (b) is a different, irrelevant company.

### 23. Paragon Power Solutions
- **Exists/active:** paragonpowersolutions.com, residential solar company, direct affiliate program (`/become-an-affiliate/`). Claims **"up to $1,000 payout per closed home solar lead"** — exact tier structure not published. Stated HQ is **Puerto Rico** (part of the US, but worth noting for a company making a large, unstructured payout claim). Multiple unrelated companies use the generic "Paragon" name — confirmed this is the correct, specific solar entity.
- **Fit: Strong direct fit** (solar leads), but per your explicit instruction, **not to be approved without direct verification.**
- **Classification: NEEDS VERIFICATION** — real, on-topic, but the payout claim and small-company profile warrant confirming legitimacy and getting exact terms in writing before any commitment.

---

## Monetization routing matrix — page intent → primary/fallback partner

**Honesty check first:** GridPermit's live content covers only two of these eight categories today. The other six have **no existing GridPermit page to place any link on** — adding a partner without matching content would either mean an out-of-context link on an unrelated page, or building new thin content to justify one, both explicitly prohibited by this task and by `docs/FUTURE_EXPANSION.md`'s expansion gates. The matrix below documents the *design*, but only rows 1–2 have a real placement today.

| Page intent | GridPermit content exists today? | Primary partner | Fallback partner | Status |
|---|---|---|---|---|
| **Solar** (341 locality guides) | **Yes — live** | EnergySage (fix the broken partner page first; CJ program as the paid path) | Profitise (solar-lead network, direct outreach) | Active placement, urgently needs the 404 fix |
| **Battery/storage** (locality guide fields + CA blog) | **Yes — live** | EnergySage (same marketplace covers battery systems) | Paragon Power Solutions (needs verification first) | Rides the existing EnergySage placement; no dedicated battery-only partner verified |
| **Roofing** | No | — | — | No verified fit (Filter King/Roofing4US are unrelated retail/materials businesses); do not add without real roofing content |
| **HVAC/heat pump** | No | Filter King *(shelf-ready, not active)* | Factory Direct Filters *(shelf-ready, not active)* | Both have real, documented terms — held pending an HVAC content vertical that doesn't exist and isn't planned |
| **Electrical/EV charging** | No | — | — | No candidate in this audit matched this vertical; not evaluated |
| **General home services** | No dedicated page (only homepage/footer) | HomeAdvisor (real CJ, self-serve) | Angi (real, but terms require an email inquiry) | Would only work as a generic "other services" link, not a topical CTA — low priority |
| **Permitting/site plans (non-solar)** | No | CostToBuildHouse (real, instant-approval, permit-adjacent) | Permit Hub / PlotForge (real but 100% B2B-contractor facing) | CostToBuildHouse is the only one with a plausible homeowner-facing angle |
| **Contractor software** | No — GridPermit has no contractor-facing audience or pages | — | — | OnCrew/JobCloser/Jobtable/bidyou.ai are all real, verified programs, but zero natural placement exists anywhere on GridPermit today |

---

## Ranked top 10 (by realistic near-term value: verified legitimacy × real terms × actual content fit × owner effort)

| Rank | Candidate | Why |
|---|---|---|
| 1 | **EnergySage** | Already the live CTA partner; urgent fix needed (404) then pursue the CJ program for real payout terms |
| 2 | **HomeAdvisor** | Real, self-serve CJ signup, same publisher account as EnergySage covers it at no extra setup cost |
| 3 | **CostToBuildHouse** | Only APPLY-NOW-grade candidate: instant approval, published terms, explicitly SEO-friendly, permit-adjacent |
| 4 | **Profitise** | Direct solar-lead fit, real network, terms require outreach |
| 5 | **Angi** | Real but gated behind an email inquiry; general (not solar) fit |
| 6 | **MatchBurst** | Real Awin CPL network, solar is one of its verticals, terms undisclosed pre-application |
| 7 | **Paragon Power Solutions** | Strong topical fit but explicitly flagged by you for extra diligence before approval |
| 8 | **Filter King** | Best-documented HVAC-filter terms; shelf-ready only if an HVAC vertical is ever built |
| 9 | **Factory Direct Filters** | Same shelf-ready status as Filter King, slightly weaker terms (4% vs 7.5%) |
| 10 | **PlotForge** | The single best-documented commission structure in this whole audit (25–50% recurring, 90-day cookie) — ranked here, not higher, purely because it has zero fit with GridPermit's current content |

Everything else (13 candidates) is **REJECT** — no verifiable program, unverifiable company legitimacy, wrong audience/mechanism, or a confirmed name mismatch. See the candidate-by-candidate section above for the specific reason per company.

---

## Exact owner actions required

1. **Urgent — confirm status of `energysage.com/p/gridpermit/`.** It 404s right now while live production CTAs point at it. Tell me whether to revert to the plain `energysage.com` root link pending EnergySage fixing their end, or whether the page is expected imminently.
2. **Apply to EnergySage's public CJ Affiliate program** ([public.cj.com/signup/publisher?advertiserId=5835771](https://public.cj.com/signup/publisher?advertiserId=5835771)) — requires your own CJ publisher account (business/tax/payment info).
3. **Apply to HomeAdvisor's CJ program** (`signup.cj.com/member/brandedPublisherSignUp.do?air_refmerchantid=2236060`) — can likely reuse the same CJ publisher account as #2.
4. **Email `affiliate@angi.com`** to request Angi's actual partner terms (no self-serve option exists).
5. **Apply to CostToBuildHouse's Rewardful program** ([equin-global-llc.getrewardful.com](https://equin-global-llc.getrewardful.com)) — instant approval, lowest-effort real option in this whole list.
6. **Reach out directly to Profitise** (profitise.com) to get real solar-lead payout terms before deciding.
7. **Do your own extra diligence on Paragon Power Solutions** before applying — confirm the "$1,000/lead" claim's actual structure and general company legitimacy given its small-company profile.
8. Everything else in this document is either **REJECT** (no action needed) or **shelf-ready but intentionally not actioned** (Filter King, Factory Direct Filters, PlotForge, Permit Hub) pending a content vertical that doesn't exist today.

**No code, links, or disclosures were changed to produce this document.** All 6 live production EnergySage CTAs remain exactly as they were at the start of this task — including the currently-broken one flagged above, which I'm surfacing rather than silently fixing per this task's explicit gate on touching production affiliate links.

---

## Application Queue — execution-ready, no CJ/Payoneer dependency

Written 2026-08-15, second pass. This section re-verifies (fresh primary-source checks, not reused from the first pass) every candidate from the audit above that does **not** require CJ Affiliate account activation, filtering specifically for programs GridPermit can act on today. No production changes were made to produce this section — it is planning only.

**Full status re-classification of all 23 candidates under the new 4-way scheme:**

| Program | Status | Why |
|---|---|---|
| Profitise | **CONTACT DIRECTLY** | Real, solar-specific network; no self-serve form found, requires sales conversation |
| MatchBurst | **APPLY NOW** | Real Awin program, solar is a listed vertical, self-serve signup open |
| CostToBuildHouse | **APPLY NOW** | Real, instant-approval Rewardful program, permit-adjacent |
| Angi | **CONTACT DIRECTLY** | Real, but email-inquiry only, no self-serve form |
| Paragon Power Solutions | **CONTACT DIRECTLY** | Real self-serve form exists, but legitimacy flags (PO box HQ, undisclosed payout tiers) mean this needs diligence before submitting, not blind application |
| EnergySage (CJ program) | **WAIT FOR CJ** | Real, self-serve, but gated behind CJ publisher account |
| HomeAdvisor | **WAIT FOR CJ** | Real, self-serve CJ signup, same account as EnergySage |
| Filter King | **REJECT** | Real Awin program, but zero HVAC content on GridPermit today |
| Factory Direct Filters | **REJECT** | Same reasoning as Filter King |
| Roofing4US | **REJECT** | Building-materials retailer, wrong content type, no roofing content |
| PlotForge | **REJECT** | Best-documented terms in the whole audit, but zero fit (new-construction contractors, not homeowners) |
| Permit Hub | **REJECT** | B2B contractor SaaS, no public terms, no homeowner fit |
| Kohler Generators | **REJECT** | No consumer content-affiliate program exists (dealer program only) |
| eLocal | **REJECT** | Pay-per-call model GridPermit has no mechanism for; gated to experienced affiliates |
| Home Services Lead Group | **REJECT** | Unverifiable legitimacy (no BBB, reviews, press, or network listing) |
| Lead Smart | **REJECT** | Mixed/poor trust signals, no solar vertical |
| Current Home | **REJECT** | No verifiable entity found |
| PreConstruct AI | **REJECT** | No verifiable entity found |
| OnCrew | **REJECT** | B2B contractor software, wrong audience |
| JobCloser | **REJECT** | B2B contractor software, wrong audience |
| Jobtable | **REJECT** | B2B contractor software, wrong audience, inconsistent published terms |
| bidyou.ai | **REJECT** | B2B contractor software, wrong audience, terms unconfirmed |
| Atomi Smart | **REJECT** | "Atomi Alliance" is an installer-recruitment network, not a paid affiliate mechanism |

### The 5 viable-today candidates, in full

#### 1. Profitise — CONTACT DIRECTLY
- **Application URL:** profitise.com (on-page "Become an Affiliate" registration section, anchor `#affiliate-registration-block`) — the actual form fields could not be extracted (likely JS-rendered); fallback direct contact confirmed: **sales@profitise.com** or **888-400-4868**.
- **Network/platform:** Direct, in-house (not on CJ/Awin/Impact).
- **Verified commission/payout terms:** **Not published anywhere on the site** — pay-per-lead model stated generally, plus a separately-mentioned 3% sub-affiliate override paid bi-weekly. No cookie window found. Genuinely gated behind a sales conversation.
- **US coverage:** Yes, US-focused.
- **GridPermit fit:** **Strongest fit of any new candidate** — "Solar Affiliate Program" and "Sell Solar Leads" are prominently, explicitly listed verticals, directly on-topic for 341 solar/battery permit pages.
- **Application requirements:** Contact form or phone call; real terms only revealed after that conversation. Requires the owner (business context, eventual payment details).
- **Owner interaction required:** Yes — this cannot be a pure self-serve online form; someone has to have the sales conversation.
- **Recommended positioning/copy:** *"GridPermit (mygridpermit.com) publishes source-verified solar and battery permit guides for [341] U.S. cities across 50 states, reaching homeowners at the exact moment they've confirmed they're moving forward with a solar project and are looking for next steps. We're evaluating solar-lead affiliate partners and would like to understand Profitise's payout structure, cookie window, and lead-qualification criteria before committing traffic."*
- **Status: CONTACT DIRECTLY.**

#### 2. MatchBurst — APPLY NOW
- **Application URL:** Via Awin publisher dashboard — [ui.awin.com/publisher-signup](https://ui.awin.com/publisher-signup/en/awin/step1), then join MatchBurst's program at [merchant profile 114854](https://ui.awin.com/merchant-profile-terms/114854) once inside Awin.
- **Network/platform:** **Awin.** Re-verified directly: Awin publisher signup requires a **refundable £5 (~$6) deposit by card**, reimbursed at first commission payout — a real, small, card-based friction point, distinct from the CJ/Payoneer blocker and not requiring Payoneer specifically.
- **Verified commission/payout terms:** Rate genuinely **not published** — "payouts based on valid leads generated... commission rates and terms may vary by vertical" (quoted directly from Awin's MatchBurst terms page). A valid lead = a homeowner submitting a complete, accurate service request in a serviceable area.
- **US coverage:** Confirmed — "traffic must originate from the United States only."
- **GridPermit fit:** Moderate — solar is one of several verticals (roofing, gutters, plumbing, HVAC, remodel, security also listed); real overlap but not solar-exclusive like Profitise.
- **Application requirements:** Awin publisher account (card for the £5 deposit) + separate program-level application to MatchBurst inside Awin.
- **Prohibited traffic (real, quoted):** No incentivized traffic, no unapproved email traffic, no misleading claims, no bidding on MatchBurst brand terms, no click-to-call without approval, no co-registration/scraping — GridPermit's organic content traffic is naturally compliant with all of these.
- **Owner interaction required:** Yes — Awin account creation needs the owner's business/payment info and card for the deposit.
- **Recommended positioning/copy:** *"GridPermit is a source-verified solar/battery permit-guide network of 341 pages across 50 US states, built on organic search traffic (no incentivized, co-reg, or scraped traffic). We'd like to add MatchBurst's solar-lead vertical as a secondary referral alongside our existing EnergySage relationship."*
- **Status: APPLY NOW** (mechanically ready today; commission terms only become visible after joining).

#### 3. CostToBuildHouse — APPLY NOW
- **Application URL:** **https://equin-global-llc.getrewardful.com** (re-verified directly today — live, confirmed signup destination linked from costtobuildhouse.com's own `/affiliate` page).
- **Network/platform:** **Rewardful.**
- **Verified commission/payout terms (re-confirmed directly, corrected from first-pass figures):** Construction Cost Report — **30%** ($6.00 of $19.99). Permit Intelligence Report — **30%** ($3.00 of $9.99). Contractor Bid Review — **33%** ($10.00 of $29.99). **30-day cookie window.** No stated payout minimum. **Payout via bank transfer or PayPal** — notably, PayPal is a real option that sidesteps both the CJ and Payoneer bottlenecks entirely.
- **US coverage:** Yes, all 50 states (zip-level cost adjustment).
- **GridPermit fit:** Weak-to-moderate — same "homeowner researching permits" audience and a literal "Permit Intelligence Report" product, but it's a new-construction cost-estimation tool, not solar-specific. Best framed as a low-effort test, not a primary revenue driver.
- **Application requirements:** Instant approval stated for "content creators, bloggers, and real estate professionals" — no minimum traffic stated. Still requires the owner's payout details (bank or PayPal) to actually receive money.
- **Owner interaction required:** Yes, to create the Rewardful account and set the PayPal/bank payout method — but this is the lowest-friction of all 5 (instant approval, no card deposit, no sales call).
- **Recommended positioning/copy:** *"GridPermit publishes source-verified, permit-focused guides for homeowners across all 50 states. We'd like to add CostToBuildHouse's Construction Cost Report and Permit Intelligence Report as relevant secondary resources for readers researching their project's full scope."*
- **Status: APPLY NOW** — the single lowest-friction, fastest-to-execute option in this entire audit.

#### 4. Angi — CONTACT DIRECTLY
- **Application URL:** No self-serve form. [angi.com/landing/affiliatepartners](https://www.angi.com/landing/affiliatepartners) directs interested publishers to email **affiliate@angi.com**. (Re-verification attempt this pass was blocked by bot protection on Angi's own page — this finding is carried over from the first pass's successful direct fetch, not re-confirmed today; flagging honestly rather than asserting false certainty.)
- **Network/platform:** Direct, in-house (despite third-party claims of an Impact.com program at "25%," no primary-source confirmation exists for that figure — do not quote it as fact).
- **Verified commission/payout terms:** **Not published** — three engagement models mentioned (phone calls, referral link, lead auctions), no rates.
- **US coverage:** Yes, nationwide, general home services.
- **GridPermit fit:** Weak — general home-improvement leads, not solar-specific; would only work as a generic homepage/footer "other home services" mention, not a dedicated CTA.
- **Application requirements:** Email inquiry; Angi presumably reviews the site before quoting terms.
- **Owner interaction required:** Yes — the entire first step is a manual email from the owner.
- **Recommended positioning/copy:** *"GridPermit (mygridpermit.com) is a source-verified permit-information site with 341 published city guides and organic search traffic across all 50 states. We're interested in Angi's affiliate/referral terms for directing readers to broader home-services search when their need falls outside solar/battery."*
- **Status: CONTACT DIRECTLY.**

#### 5. Paragon Power Solutions — CONTACT DIRECTLY (diligence-first, not a blind application)
- **Application URL:** paragonpowersolutions.com/become-an-affiliate/ — real, live self-serve form (fields: First Name, Last Name, Email, Phone, "Which Best Describes You" — Contractor/Business Owner/Solar Supplier/Other).
- **Network/platform:** Direct, in-house.
- **Verified commission/payout terms:** "Up to $1,000 payout for every closed home solar power lead" — **exact tier structure for reaching that figure is not published anywhere**, re-confirmed on this pass.
- **US coverage:** Company states it wants to "partner with professionals... throughout the United States," but its registered address (re-confirmed this pass) is **"Paragon Power, LLC, PO Box 942, Saint Just, PR 00978-0942"** — a PO box in Puerto Rico. Not disqualifying (PR is a US jurisdiction), but a PO-box-only address for a company advertising four-figure per-lead payouts is a real caution flag worth resolving before committing traffic.
- **GridPermit fit:** Strong on paper (solar-specific), undermined by the unresolved legitimacy questions above.
- **Application requirements:** The form itself is trivial to submit — but per your own standing instruction ("investigate... but do not approve them without direct verification"), the recommended action is a direct conversation (call the listed number, 724-418-8829) requesting the actual payout tier structure and a written agreement, not simply submitting the web form.
- **Owner interaction required:** Yes — and specifically owner-level diligence, not just form-filling.
- **Recommended positioning/copy:** *(for a direct call/email, not the web form)*: *"Before we submit an application, we'd like to understand Paragon Power Solutions' actual commission structure behind the 'up to $1,000 per lead' figure, your payment terms, and a written affiliate agreement — GridPermit sends organic, source-verified solar-permit traffic and wants to confirm partner legitimacy before directing any of it here."*
- **Status: CONTACT DIRECTLY (verify before applying).**

### Ranked — first 5 programs to act on today

Ranked by expected revenue potential × likelihood of acceptance × relevance to GridPermit's existing solar/battery traffic:

| Rank | Program | Revenue potential | Acceptance likelihood | Relevance | Why this rank |
|---|---|---|---|---|---|
| 1 | **Profitise** | Moderate–high (dedicated solar-lead network, sub-affiliate structure implies real volume) | Moderate (sales-gated, but solar content sites are their target) | **High** — solar-specific | Best topical match of any new candidate after EnergySage itself |
| 2 | **MatchBurst** | Moderate (undisclosed CPL rate, but solar is a named vertical with real prohibited-traffic discipline) | Moderate-high (Awin approves quickly; GridPermit's 341 real pages should pass review) | Moderate — solar is one of several verticals | Real, mechanically ready today, second-strongest solar tie |
| 3 | **Angi** | Unknown, but Angi's scale means potentially the largest absolute volume of any candidate here | Unknown (email-gated, no visibility into approval odds) | Low-moderate — general home services, no dedicated placement | Biggest brand/scale, weakest specific fit and least certainty |
| 4 | **CostToBuildHouse** | Low ($3–10/sale) | High (instant approval stated) | Low-moderate — permit-adjacent, not solar-specific | Guaranteed-easy execution, low ceiling — good as a fast first win, not a primary bet |
| 5 | **Paragon Power Solutions** | Potentially high ($1,000/lead claimed) if legitimate | High for the form itself, but **discounted** for unresolved legitimacy risk (PO box HQ, no disclosed tiers) | High — solar-specific | Highest headline number in this batch, but ranked last because the diligence step must happen before the number can be trusted |

### What this section deliberately does not do

- Does not submit any application, email, or form on the owner's behalf — every "Application URL" above is for the owner (or an explicitly authorized future session) to use directly, consistent with the standing rule that no agent creates accounts or enters business/tax/payment information.
- Does not quote a commission figure that isn't directly sourced above (Profitise, Angi, and MatchBurst's exact rates remain genuinely unknown until contact/application — reported as such, not estimated).
- Does not change any production link, disclosure, page, or metadata — this entire section is planning documentation only.

---

## Execution attempt log — 2026-08-15, third pass

You approved the queue and asked me to execute it directly (create accounts, submit applications, send outreach) rather than just hand back instructions. Here's exactly what was attempted, what happened, and — critically — a hard capability/policy boundary that applies to every single item below, stated once here rather than repeated five times: **I do not create accounts on third-party platforms (any flow with a password field) or accept binding legal/agreement terms on your behalf under any circumstances, regardless of authorization, and I have no email-sending or phone-calling tool in this environment** — so "send an email" or "make a call" can only ever produce a ready-to-send draft, not a sent message. These aren't judgment calls made per-program; they're the same two hard limits hit five times.

### 1. CostToBuildHouse — program is now DEAD, not APPLY NOW
Navigated directly to `https://equin-global-llc.getrewardful.com` (the exact signup URL re-verified as live just one research pass ago) and found it now returns: **"Sorry, this affiliate program is no longer active."** Screenshot-confirmed, real Rewardful-hosted page, not a bot-block. This is new information that overturns the prior "APPLY NOW, lowest-friction win" ranking — the program was deactivated between the last research pass and now (or Rewardful's cache was stale before). **No application was possible. Reclassified: REJECTED / FAILED VERIFICATION.**

### 2. Profitise — CONTACT DIRECTLY, draft prepared, not sent
Navigated to profitise.com and clicked through to the actual "AFFILIATE REGISTRATION" section (not visible in the earlier text-only fetch). Found:
- Real registered office: 505 N. Brand Blvd., 16th Floor, Glendale, CA 91203; phone 888-400-4868; email **sales@profitise.com** (all newly confirmed, stronger legitimacy signal than the first pass had).
- The registration form itself requires **checking "I affirm I have read, understand and agree to the Affiliate Agreement, Terms and Conditions, and Privacy Policy"** (binding legal acceptance) **and two-step phone/SMS verification** — both are explicitly owner-only actions I will not complete on your behalf, and the phone verification requires a real phone number I don't have and won't fabricate.
- Because of this, the registration form is not actually a place to just "ask questions" — submitting it commits to affiliate status. The correct channel for the written inquiry you asked for is the plain email address, not this form.
- **Draft prepared below, ready to send from your own email client.** Not sent — no email tool exists in this environment.

### 3. Angi — CONTACT DIRECTLY, draft prepared, not sent
Re-navigated directly to angi.com's affiliate page (bypassed the bot-block that stopped the first-pass re-verification). Confirmed, word for word: **"To learn more, email affiliate@angi.com."** No self-serve form exists — this is genuinely email-only. **Draft prepared below, ready to send.** Not sent — no email tool exists.

### 4. MatchBurst / Awin — confirmed OWNER_ACTION_REQUIRED, stopped at account creation itself (not just the $5 deposit)
Navigated to Awin's publisher signup (`ui.awin.com/publisher-signup`). **Step 1 of 4 ("Account Setup") itself contains Password and Confirm Password fields**, alongside Company Name, Tax Residency, First/Last Name, and Email — i.e., this single screen *is* account creation, not a preamble to it. I did not enter any data into this form, including the "safe" fields, because doing so would mean materially progressing an account-creation flow I categorically don't complete, independent of whether the $5 deposit (which appears later, at the payment step) is ever reached. **Exact screen: `ui.awin.com/publisher-signup`, step "Account Setup," fields Company Name / Tax Residency / First Name / Last Name / Email / Password / Confirm Password / "Next Step."** This needs you, start to finish.

### 5. Paragon Power Solutions — CONTACT DIRECTLY, but no viable path found
Re-navigated to the live application form. Confirmed fields: First Name, Last Name, Email, **Phone Number** (required), "Which Best Describes You," Send. No email address is published anywhere on the site — only this form and the phone number 724-418-8829. Two problems: (a) the form has no free-text field, so it cannot carry your requested questions ("what event earns compensation," written terms, etc.) — submitting it just triggers a generic sales follow-up, not a substantive written inquiry; (b) it requires a phone number, and **I do not have a verified GridPermit phone number anywhere in this repo and will not fabricate one.** Given your own instruction to verify legitimacy before engaging, and the PO-box-only registered address found last pass, **this one has no channel I can meaningfully progress at all** — the only real option is you calling 724-418-8829 directly. Not a refusal of the task; there is genuinely no written-contact mechanism on their site to use.

### Ready-to-send drafts (copy-paste, not sent by me)

**To: sales@profitise.com — Subject: GridPermit — Solar Affiliate Partnership Inquiry**
> Hello,
>
> GridPermit (mygridpermit.com) publishes source-verified, permit-focused solar and battery guides for cities across all 50 US states, with organic search as our primary traffic channel. We're evaluating Profitise's solar affiliate program and would like to understand, before registering:
> - Publisher eligibility criteria for a content/informational site like ours
> - Whether your solar-lead program covers all 50 states or specific state licensing/coverage restrictions
> - Your qualified-lead definition
> - Current payout rate/structure for solar leads
> - Duplicate/rejected-lead handling rules
> - Any restrictions on traffic sources (we are 100% organic search, no paid/incentivized/co-registration traffic)
> - Attribution/tracking method used
> - Payment terms and schedule
>
> We noticed registration requires agreeing to the Affiliate Agreement and completing phone verification, so we wanted to get these specifics in writing first.
>
> Thank you,
> GridPermit

**To: affiliate@angi.com — Subject: GridPermit — Affiliate Partnership Inquiry**
> Hello,
>
> GridPermit (mygridpermit.com) is a source-verified permit-information site publishing 341 city guides across all 50 US states, built on organic search traffic. We're interested in your affiliate/referral program and would like to know:
> - Publisher terms and commission structure
> - Eligible traffic sources
> - Payout model
> - Geographic coverage
> - Tracking/attribution method
>
> Please let us know the best next step.
>
> Thank you,
> GridPermit

**Note on sender address:** you asked me to use support@mygridpermit.com, but the address actually published on the live site (`src/pages/contact.astro`) is **support@gridpermit.com** (the apex domain, not the www one the site is hosted at) — I used a generic "GridPermit" sign-off above rather than guess which is correct. This exact ambiguity was flagged once before in `docs/MONETIZATION_READINESS.md` as needing your confirmation before any partner-facing use — worth resolving before either address goes out to a real company.

---

## New candidate discovery batch — 2026-08-15, fourth pass

19 candidates researched/re-verified from primary sources (four parallel research passes plus my own direct re-verification of Kohler and live-browser checks on the strongest new leads). No production changes made. Same hard limits as the prior execution pass apply throughout: I do not create accounts on any platform with a password field, and I do not fabricate legal entity name, business address, or phone number to complete a form that requires them.

### Correction: the Kohler claim does not hold up

You asked me to re-verify a specific claim: that Kohler's official site "now explicitly advertises a 'Kohler Generators Affiliate Program'" letting publishers earn revenue promoting home standby generators. I re-checked this directly and **the claim isn't substantiated by what exists today:**
- A real Kohler affiliate program does exist — via FlexOffers, **2.4% commission, 30-day cookie** ([flexoffers.com/affiliate-programs/kohler-affiliate-program](https://www.flexoffers.com/affiliate-programs/kohler-affiliate-program/), directly fetched and quoted). But its own page describes coverage as "faucets, sinks, toilets, and opulent bathwater" plus general home-improvement products — **generators are not mentioned**, and nothing found ties this program to Kohler's generator/home-energy line.
- Kohler's generator-specific "Become a Kohler Partner" page (kohlerhomeenergy.rehlko.com) — re-confirmed unchanged from the first audit pass — remains a **B2B dealer/reseller partner network** (training, technical support, parts discounts for businesses), not a commission-based content-affiliate program.
- **Net finding: no verified generator-specific affiliate program exists for content publishers.** The real Kohler affiliate program that does exist is for bath/kitchen fixtures — a vertical with zero relevance to GridPermit regardless. **Classification stays REJECTED**, for a different and more precise reason than the original pass (wrong product line confirmed, not just "no program found").

### Full findings — all 19 candidates

| Candidate | Real & active? | Solar/relevant vertical? | Application mechanism | Status |
|---|---|---|---|---|
| **homeyou** (homeyou.com/affiliates) | Yes | **Yes — confirmed live Solar Energy directory category** (homeyou.com/directory/solar-energy/...) | "Apply Now" button paired with "Already a member? Login" — strongly implies account creation; could not confirm exact fields (page didn't fully render on click) | **OWNER ACTION REQUIRED** — best solar-vertical fit of this entire batch |
| **Advertising Results Inc.** (advertisingresults.com) | Yes — BBB A+, Billings MT | **Yes — "Solar" is an explicit checkbox vertical**, content/review-site traffic explicitly welcomed | Detailed business-application form (no password) — re-verified directly via browser. Requires: Legal Name (for agreements), Type of Entity, Business Phone, Street/City/State/Zip — **all data I don't have verified for GridPermit and won't fabricate** | **OWNER ACTION REQUIRED** — strong candidate, blocked purely on missing business data, not a technical/legal barrier |
| **Bark.com US** (via Awin, merchant 58887) | Yes, public company network | Yes — confirmed solar, roofing, HVAC, electrical categories in the US marketplace | Awin publisher account (same password-gated flow documented for MatchBurst) | **OWNER ACTION REQUIRED** — best-documented terms of the whole batch (up to $100/lead, 30-day cookie, $50 payout threshold), same Awin account blocker |
| **Signature Solar** (signaturesolar.com) | Yes | Yes — solar panels/batteries/inverters/backup power, direct match to "batteries/backup power" vertical | Application form; payout via bill.com (implies business/tax onboarding). Page didn't fully render for exact field confirmation — noting rather than guessing | **OWNER ACTION REQUIRED** — real, documented (up to 9% commission, 7-day cookie), but a product-affiliate (equipment sales) model, not a lead-referral model like the rest of the pipeline |
| **Aragon Advertising** (aragon-advertising.com) | Yes — #1-ranked pay-per-call network per mThink, NY-based | Unconfirmed — home services (roofing, pest control, HVAC) listed; solar/battery not found on pages reviewed | Detailed application + mandatory arbitration/class-action-waiver acceptance; Tipalti payment setup within 6 months | **OWNER ACTION REQUIRED** — legitimate network, but solar vertical needs direct confirmation via publishers@aragon-advertising.com before applying |
| **Modernize** (QuinStreet, Nasdaq: QNST) | Yes, public-company brand | Yes — solar listed alongside roofing/HVAC/windows/siding | Inquiry/approval-based via modernize.com/affiliates; terms not public | **OWNER ACTION REQUIRED** — most established/credible parent company in this batch, terms opaque until you apply |
| **Fixr.com** | Yes | Yes — solar explicitly included alongside roofing/kitchens/bathrooms | Login-gated affiliate portal (affiliates.fixr.com) — likely requires account creation, unconfirmed | **OWNER ACTION REQUIRED** — real solar-relevant program, least transparent of the batch |
| **Polyares** (polyares.com) | Yes | **No — 20+ general trade categories, no solar/battery found** | app.polyares.com/register — email/name/Google sign-in + legal acceptance (real account creation) | **REJECTED (no fit)** |
| **DOPPCALL** (doppcall.com) | Yes | **No solar mention found anywhere** | doppcall.com/publisher/signup — account + password required | **REJECTED (no fit)** |
| **LeadBank / Home Alliance** (leadbank.homealliance.com) | Yes | **No solar/battery vertical found** — general trades only | Contact form (`/contact?role=affiliate`) | **REJECTED (no fit)** |
| **Networx** (networx.com) | Yes | Weak — solar appears only via individual contractor listings, no dedicated solar category | Manual phone/email intake, no self-serve portal | **REJECTED (weak fit, opaque terms)** |
| **Inquirly** (inquirly.com) | Yes, real lead-buying agency | No — 35+ categories, **solar not listed at all** | No confirmed publisher/affiliate program exists | **REJECTED (no program)** |
| **CallX** (callx.com) | Yes — name collision with unrelated callx.io confirmed and avoided | **No — confirmed life-insurance-only** on the primary source | publisher.callx.com signup | **REJECTED (wrong vertical)** |
| **Callvanta** (callvanta.pro) | Unconfirmed — callvanta.pro returned 403; callvanta.com is a different, unrelated AI-automation company | Unknown — could not verify | Could not access | **REJECTED (unverifiable)** |
| **Lead Smart Inc** (leadsmartinc.com) — re-verified | Yes, mixed trust | No solar, unchanged | New negative signal found: an unresolved **$6,326 withheld-payment dispute** over a retroactively-invoked "Marketplace" clause (affpaying.com) | **REJECTED — reinforced**, not softened |
| **Home Services Lead Group** — re-verified | Unverifiable (still no BBB/press/address/phone/network listing) | **Changed: Solar is now explicitly listed** as a vertical | Contact form only | **REJECTED — unchanged reason (legitimacy), narrower now that vertical fit is no longer the blocker** |
| **Permit Hub** — re-verified | Yes, real B2B SaaS | No change — still contractors/businesses only, no published terms | Application-only, privately negotiated | **REJECTED — confirmed unchanged** |
| **Jobtable** — re-verified | Yes, real B2B SaaS | No change — still B2B, wrong audience | 20%/30% commission inconsistency **still present** in their own published terms | **REJECTED — confirmed unchanged** |
| **Kohler Generators** — re-verified per your specific request | See correction above | N/A — real program found is for bath/kitchen fixtures, not generators | N/A | **REJECTED — claim not substantiated** |

### What I did NOT do, and why

- **Did not create any account** — every "Apply Now," "Register," or "Sign Up" flow that reached a password field (Polyares, DOPPCALL, Awin/Bark, likely homeyou and Fixr) was stopped at that exact point, not partway through with "safe" fields pre-filled.
- **Did not submit the Advertising Results Inc. business-application form** — it requires GridPermit's legal entity name, registered street address, and business phone number. None of these exist anywhere in this repo or in anything you've told me, and I won't invent them. This is a clean, real, well-matched opportunity (solar explicitly listed, BBB A+, content-site-friendly) that's genuinely one step away — it just needs those three facts from you.
- **Did not send any inquiry** — no email-sending tool exists in this environment, same limitation as the prior execution pass.

---

## Tracker (per your requested categories)

**APPLYING:** none — nothing is mid-submission.

**CONTACTED:** none — no send capability exists; see the two ready-to-send drafts (Profitise, Angi) from the prior execution pass, still unsent.

**OWNER ACTION REQUIRED (8):** homeyou, Advertising Results Inc., Bark.com (via Awin), Signature Solar, Aragon Advertising, Modernize, Fixr.com — plus, carried over from the prior pass: Profitise, Angi, MatchBurst/Awin, Paragon Power Solutions.

**WAITING FOR CJ (2, unchanged):** EnergySage's paid CJ program, HomeAdvisor.

**PENDING:** none.

**APPROVED:** none.

**REJECTED (this pass, 12):** Kohler Generators (claim not substantiated — see correction), Polyares, DOPPCALL, LeadBank/Home Alliance, Networx, Inquirly, CallX, Callvanta, Lead Smart (reinforced), Home Services Lead Group (confirmed unchanged), Permit Hub (confirmed unchanged), Jobtable (confirmed unchanged).

**TRACKING LINK RECEIVED:** none.

### Honest tally against the "20 legitimate partners" target

Across all research passes to date: **12 real, verified, OWNER-ACTION-READY opportunities** exist in the pipeline (this pass's 7 new + the prior pass's 5 minus CostToBuildHouse, which died). That's the actual number of legitimate, primary-source-verified programs GridPermit could realistically pursue right now — short of 20 not because research stopped, but because roughly two-thirds of everything investigated across both batches (29 companies total) turned out to have no solar/battery-relevant vertical, no real program, unverifiable legitimacy, or the wrong audience. Padding this list further would mean either re-including rejected candidates without new justification or inventing new companies — I did neither.

---

## Fifth pass — 2026-08-15: BigBattery/Power Queen/PVBAT/Docan Power/Digital Master Media batch + reopens

**Operational note on Profitise and Angi:** per your report, ChatGPT already sent these two inquiries. I have not independently verified this (no sent-mail confirmation reviewed, no email tool to check) — recording as **CONTACTED (per your report, not independently verified by me)** and not sending duplicates.

Three parallel research passes verified every claim supplied in your brief against primary sources rather than accepting them — two claims needed correcting, one couldn't be substantiated at all (see SUNcheck below). No production changes made.

### Tier 1 — full results

**1. BigBattery — OWNER ACTION REQUIRED, closest to submittable in the entire pipeline**
All five of your supplied claims confirmed verbatim from bigbattery.com/partners/: free to join, 5% flat commission, ACH payout, lower-48-only, content creators/bloggers explicitly eligible. Application form re-verified live: **only Full Name and Contact Email are required** — no password, no payment info, no CAPTAI. Every other field (social handles, follower/subscriber counts, view counts) is "fill in all that apply," genuinely optional, and correctly left blank for GridPermit (a content/SEO site, not a social-media channel) — that's an honest "N/A," not a fabrication risk. The **only** thing stopping submission: a real contact name to attribute the application to, plus confirming which support email to use (the same `support@gridpermit.com` vs `support@mygridpermit.com` ambiguity flagged twice already). Give me those two facts and this one is submittable in the same session.

**2. Power Queen — WAITING FOR AWIN (consolidated) / OWNER ACTION REQUIRED, with two corrections**
- **Correction:** your brief said "commission on qualifying sales" without a figure; the real published rate is **5.5% base** ("up to 6%" marketing ceiling), not a flat 5%.
- **Correction/addition:** Awin merchant ID 118441 is real — independently confirmed via `ui.awin.com/merchant-profile/118441` ("Merchant Name: Power Queen"). But **Awin is not the only path** — a direct, non-Awin route exists via GoAffPro (`ipowerqueen.goaffpro.com`), not identified in your brief. Per your instruction to consolidate rather than duplicate: the Awin route is now the **same blocker already tracked for MatchBurst** (password-gated publisher account, `ui.awin.com/publisher-signup`) — no new owner action beyond what's already logged. The GoAffPro route is a separate, not-yet-explored dashboard signup that likely also requires account creation (unconfirmed) — flagging as a secondary path worth a quick owner look, not re-litigating the Awin blocker twice.

**3. Docan Power — OWNER ACTION REQUIRED, hard stop, exactly as your brief anticipated**
Re-verified every commission figure and payout term from docanpower.com/affiliate — confirmed accurate (1.5%/2.5%/3%/4% tiers, $50 minimum, monthly payout, PayPal/bank transfer), with one correction: the site also lists Germany/Poland warehouses alongside the US one, which your brief didn't mention. **Signup form field order re-confirmed directly:** Customer Group → Name → Email → Phone → Company → Website → **Tax ID** → **Payment Method with bank/PayPal detail fields** → **Password/Confirm Password** → **CAPTCHA** → agreement checkbox — all in the first and only step. Exactly the combination you told me not to touch. **No progress possible; this needs you, start to finish.**

**4. PVBAT — OWNER ACTION REQUIRED**
Confirmed: free to join, up to 5% commission, US-based (City of Industry, CA), no product limits — all verbatim. Application (a separate URL, pvbat.com/affiliate-program/, not the partner-program page itself) is a direct form: Name, Email, Website/Social, Audience Type (has a "DIY Solar/Off-grid" option — good fit), **Monthly Traffic/Followers**, Promotion Plan. No password. **Blocker: "Monthly Traffic/Followers" is a required field and I have no verified GridPermit traffic number** — no GA4 API access exists in this environment (same gap noted in the original monetization audit). Cookie window and payout method aren't published anywhere on the site either — flagging as unconfirmed, not assumed.

**5. Digital Master Media — REJECTED (operational incompatibility, not a form blocker)**
Every payout figure in your brief confirmed exactly ($53 solar / $178 roofing / $94 HVAC / $57 electrical, $50 minimum, Payoneer/Wise/ACH) — and one correction in your favor: **the government-ID requirement does not exist.** A full search of the /apply page for ID/KYC/document-upload language found nothing; the actual gate is a compliance-acknowledgment + typed digital signature, not a document upload. However, the application itself asks for a **call-tracking platform** and **estimated daily call volume** — this is a pay-per-call network, and GridPermit is a static content site with **no click-to-call or dynamic-number-insertion mechanism at all**. This isn't a missing-field problem; it's that the underlying business model doesn't fit the product as it exists today. Building call infrastructure would be a real engineering project (and would touch the site during the SEO freeze) — **not recommended to pursue until/unless that infrastructure exists.** One more discrepancy worth noting: the site's own homepage advertises "weekly Net 7-10" while the application page states "monthly Net 10" — the network's own terms disagree with each other, a minor trust flag independent of the fit issue.

### Reopen / reverify

**6. Permit Hub — REJECTED, reopen confirmed no change**
Already re-verified fresh this same day in the prior pass. permithub.com/partners still has no published commission %, cookie window, or eligibility terms ("Earn commissions by referring contractors and businesses..." — application-only, privately negotiated), and the audience is still explicitly "contractors and businesses," not homeowners. **Why this stays rejected even after reopening: the audience mismatch is the real disqualifier, not just missing terms** — even a fully-published commission structure wouldn't fix that GridPermit's traffic is homeowners, not contractors shopping for permit software.

**7. First Call Solutions — OWNER ACTION REQUIRED, weak priority**
Real company (firstcallsolutionsllc.com, Houston TX), live application form, no password/payment required. Solar has its own dedicated page, but **roofing/HVAC/electrical are not named verticals anywhere on the site** — only generic "home services/home improvement." No payout figures published. Same traffic-stats-field gap as PVBAT likely applies. Lower priority than BigBattery/Power Queen given weaker vertical specificity and zero published terms.

**8. BuyTheCalls — REJECTED (operational incompatibility, same reason as Digital Master Media)**
Real, and the strongest-documented pay-per-call terms found this pass: SEO/organic traffic explicitly welcomed ("If you run traffic — search, social, SEO sites... BuyTheCalls is a buyer for your volume"), solar ($40–90/call), HVAC ($20–80/call), and roofing ($25–75/call) all named with real payout ranges stated directly on their own site. **Same structural problem as #5: this is a pay-per-call marketplace, and GridPermit generates zero phone calls today.** Genuinely good terms, wrong business model for GridPermit as currently built.

**9. SUNcheck / SUNcheck Inc. — REJECTED, claim could not be substantiated at all**
This is the most important finding of this pass: **the "$1,000 per sale, 365-day attribution" figure could not be verified anywhere** — not on SUNcheck's own domains (suncheck.com, battery.suncheck.com), not via a public Awin merchant-ID search, and not even on any aggregator site (OfferVault, mThink, affpaying all returned nothing for SUNcheck). SUNcheck's own sites don't mention an affiliate/publisher program **at all** — the only dollar figure found is an unrelated **customer** rebate ("$5,000+ check from SunCheck" for homeowners who complete an install), not a commission structure. **Recommend treating this as a claim with no traceable origin, not a pending-verification item** — there may be no real program here to verify.

### Secondary verify — aggregator caution

**eLocal, Inquirly, DOPPCALL, Lead Smart** — unchanged from prior passes. All four were already verified from primary sources (not aggregator listings) in earlier rounds of this audit — re-confirmed no new evidence surfaced. Status stays REJECTED for the reasons already on record (structural pay-per-call mismatch for eLocal; no publisher program found for Inquirly; no solar vertical for DOPPCALL; reinforced trust concerns for Lead Smart, including a newly-found unresolved $6,326 payment dispute from the prior pass).

**OnCore Leads — OWNER ACTION REQUIRED, new candidate, good fit**
Real (oncoreleads.com, Folsom CA), active, with a dedicated Home Services Leads vertical explicitly listing **Solar, Electricians, HVAC Contractors, and Roofers** — the best multi-vertical match found in this entire pass. Application is a "Marketing Partner Form" (contact/intake style); no password or payment info evidence found, though exact fields weren't fully itemized. No payout figures published anywhere — genuinely unconfirmed, not aggregator-sourced.

---

## Tracker (this pass's categories)

**CONTACTED (2):** Profitise, Angi — per your report (ChatGPT sent these); not independently verified by me.

**APPLICATION STARTED:** none — no form was submitted.

**OWNER ACTION REQUIRED (6 new):** BigBattery *(closest — needs only a contact name + confirmed support email)*, PVBAT *(needs a real traffic/followers figure)*, Docan Power *(hard stop: password+payment+TaxID+CAPTCHA)*, First Call Solutions, OnCore Leads, Power Queen's GoAffPro route (secondary path, unconfirmed).

**WAITING FOR AWIN (consolidated, 2):** Power Queen (merchant 118441, confirmed real), MatchBurst — same underlying Awin publisher-account blocker, tracked once, not duplicated.

**WAITING FOR CJ (2, unchanged):** EnergySage's paid CJ program, HomeAdvisor.

**PENDING APPROVAL:** none.

**APPROVED:** none.

**TRACKING LINK RECEIVED:** none.

**REJECTED (5 this pass):** Digital Master Media (pay-per-call model incompatible with GridPermit's zero call-generation infrastructure — not a form blocker), BuyTheCalls (same operational incompatibility), SUNcheck (claimed terms could not be traced to any real source — likely no program exists), Permit Hub (reopened, confirmed unchanged — audience mismatch, not missing terms), eLocal/Inquirly/DOPPCALL/Lead Smart (unchanged, already primary-source-verified).

**NEEDS VERIFICATION:** none this pass — every candidate reached either a confirmed classification or a specific, named blocker.

### Two corrections made to your supplied brief, for the record
1. **Power Queen's commission is 5.5% base ("up to 6%"), not a flat 5%** — and Awin is not the only signup path (GoAffPro direct route also exists).
2. **Digital Master Media's application does not require a government-issued ID** — that specific claim didn't hold up on direct verification of the /apply page; the real gate is a compliance acknowledgment and typed signature.

---

## Sixth pass — 2026-08-15: BigBattery resume, DMM/BuyTheCalls re-evaluation

**Profitise and Angi:** updated per your report to **CONTACTED / EMAIL SENT** (ChatGPT sent both via the connected Gmail account). Still not something I independently witnessed — recording your report as the basis for this status, not a confirmation I verified myself.

### BigBattery — blocked by this environment's own safety layer, not by BigBattery

With the contact name and email you supplied (Eyal Haimovich / support@mygridpermit.com), I navigated back into the live 4-step application and confirmed step 1 exactly as before: every social-media field (YouTube/Instagram/Facebook/Twitter/TikTok/Reddit/LinkedIn/Pinterest — handles, follower counts, and view counts) is genuinely blank for GridPermit — no fabrication, just an honest "not applicable" for a site with no social presence. The one truthful, applicable field is the niche checkbox "Solar - Off Grid - Battery Backup."

When I attempted to actually check that box, **this environment's own auto-mode permission layer denied the action** ("Blocked by classifier... let the user decide how to proceed") — this is independent of anything BigBattery requires; it's a guardrail in the tool I'm running in that stopped me from filling in a live third-party web form, which is the right kind of thing for it to catch given how much of this task involves real external submissions. I did not attempt to route around it, per its own instructions.

**Practical effect: I could not reach step 4 (Affiliate Contact Information) myself, so I can't show you the platform's own final review screen.** But I can give you everything needed to complete this in under two minutes yourself — here's the exact, complete submission payload, built entirely from verified information:

| Field | Value | Basis |
|---|---|---|
| YouTube / Instagram / Facebook / Twitter / TikTok / Reddit / LinkedIn / Pinterest (handles) | *(leave blank)* | GridPermit has no verified social media presence |
| Subscriber/follower counts (all platforms) | *(leave blank)* | Same — no fabricated numbers |
| Video view counts (all platforms) | *(leave blank)* | Same |
| Content niche | ✅ **Solar - Off Grid - Battery Backup** | Direct, truthful match — GridPermit publishes solar/battery permit guides |
| Full Name | **Eyal Haimovich** | As you supplied |
| Contact Email | **support@mygridpermit.com** | As you supplied |
| Website | **https://mygridpermit.com** | Verified, live production URL |

Steps 2 ("Content & Promotion Strategy") and 3 ("Additional YouTube Information") were never reached, so their exact fields are unconfirmed — based on the step titles, step 3 is almost certainly skippable (no YouTube channel exists), and step 2 likely asks how you plan to promote BigBattery, which should be answered truthfully (e.g., "organic content on solar/battery permit guides across 341 US city pages") rather than guessed at here. **Agreement/terms:** the application page itself carries only the general statement "by submitting this form you agree that we may contact you about the affiliate program" — no separate checkbox or binding-terms acceptance was found on step 1; I could not confirm whether steps 2–4 introduce one, since I didn't reach them.

### Digital Master Media & BuyTheCalls — reclassified to NEEDS ECONOMIC/TECHNICAL EVALUATION, evaluation below

Your reasoning is fair — "no infrastructure today" is a "not yet," not a permanent disqualifier. Here's the evaluation, built only from already-verified facts plus labeled engineering judgment (tagged **FACT** = primary-sourced this session, **ASSUMPTION** = industry-typical/my own analysis, **GAP** = data this evaluation genuinely can't produce without more information):

| Factor | Digital Master Media | BuyTheCalls |
|---|---|---|
| **Payout per qualified call** (FACT) | Solar up to $53, Roofing up to $178, HVAC up to $94, Electrician up to $57 | Solar $40–90, HVAC $20–80, Roofing $25–75 |
| **Qualification requirements** (FACT, partial) | Compliance-acknowledgment gate confirmed; exact call-duration/intent thresholds not found in prior research — **GAP** | Minimum call duration (60–120s by vertical), correct geo, "real person, real intent," delivered within business hours/caps — confirmed on their own site |
| **Available relevant GridPermit traffic** | **GAP — cannot be filled.** No GA4 API access exists in this environment (the same gap flagged throughout this entire engagement's monetization work). Any revenue estimate below is structurally incomplete without this. | Same gap |
| **Conversion assumptions** (ASSUMPTION) | Web-to-call conversion is a fundamentally higher-friction action than a click-through (the EnergySage/CTA model) — industry-typical call-conversion rates from content pages run well under 1% of page views, often a fraction of that, since it requires a reader to place an actual phone call rather than click a link. No GridPermit-specific data exists to replace this industry assumption. | Same reasoning applies |
| **Technical effort to add tracked click-to-call** (ASSUMPTION, my analysis) | Requires Dynamic Number Insertion (DNI): a network-provided or third-party-service (e.g. CallRail/Invoca-style) tracking number swapped in per traffic source, plus a new CTA component analogous in shape to the existing `InstallerCTA.astro` — a moderate, contained addition, not a rebuild. The real complexity is call-compliance handling (see below), not the swap-a-phone-number mechanic itself. | Same shape of work |
| **Geographic routing requirements** (FACT + analysis) | Both networks require correct geo-targeting for a call to qualify. GridPermit's architecture is naturally well-suited to this — every locality guide page already knows its own city/state, so routing could map directly onto existing page structure rather than requiring new geo-detection logic. | Same |
| **Compliance requirements** (FACT + analysis) | Confirmed compliance-acknowledgment gate at application; adding real click-to-call means GridPermit takes on call-recording/TCPA-style consent obligations it has zero infrastructure or policy for today — a genuine new legal-surface-area, not just an engineering one. | BuyTheCalls' publisher base includes traffic from India/Philippines/Pakistan/Bangladesh alongside the US ("US traffic commands premium pricing") — a milder vetting bar than a US-focused network; not disqualifying, but worth noting as a lighter-diligence network relative to Digital Master Media. |
| **New/thin SEO content required?** | **No — and none should be built.** If ever implemented, this would be a CTA/component addition to the 341 already-existing, already-verified locality pages (the same pattern as `InstallerCTA.astro`), not new pages. This satisfies your explicit instruction without any design compromise. | Same |

**Bottom line:** both are directionally plausible — solid published payouts, a technically contained (if nontrivial) build, and GridPermit's page structure is a natural fit for geo-routing. But the evaluation can't produce an actual expected-revenue number without the one input that's missing everywhere in this engagement: real GridPermit traffic data. **Recommended next step if this gets prioritized: resolve GA4 API access first** (the same recommendation already on record from the original monetization audit) — that single number turns this from a plausible-sounding opportunity into an actual go/no-go decision. Per your instruction, **no click-to-call infrastructure was built or planned in code this pass.**

### Rest of the pipeline

The same permission-layer block that stopped BigBattery's checkbox would apply identically to any further live-form interaction on First Call Solutions or OnCore Leads, so I did not attempt those this pass — their status is unchanged from the fifth pass (both OWNER ACTION REQUIRED, real programs, no new fields checked). PVBAT (needs a real traffic/followers figure), Docan Power (hard password/payment/CAPTCHA stop), and Power Queen (Awin, consolidated with MatchBurst) are all unchanged — no new information this pass.

## Tracker update (sixth pass)

**CONTACTED / EMAIL SENT (2):** Profitise, Angi — per your report.

**APPLICATION STARTED (1):** BigBattery — step 1 reviewed and confirmed fully completable with zero fabrication; blocked from reaching submission by this environment's permission layer, not by BigBattery. Exact payload above, ready for you (or a future session with the right permission) to finish in under two minutes.

**NEEDS ECONOMIC/TECHNICAL EVALUATION (2):** Digital Master Media, BuyTheCalls — reclassified per your instruction; evaluation above; blocked on one missing input (real GridPermit traffic data) that also blocks several other open items in this engagement.

**Unchanged:** OWNER ACTION REQUIRED (PVBAT, Docan Power, First Call Solutions, OnCore Leads), WAITING FOR AWIN (Power Queen, MatchBurst), WAITING FOR CJ (EnergySage, HomeAdvisor), REJECTED (SUNcheck, Permit Hub, eLocal, Inquirly, DOPPCALL, Lead Smart).

---

## Seventh pass — 2026-08-15: 10-hour war-room batch

**Honesty note on session mechanics:** I don't run unattended for 10 literal hours — I did one large, thorough batch of work in this session. Everything below is real (verified via actual tool calls, not simulated), but "10-hour autonomous execution" isn't how this environment works, and I'm not going to write a report implying otherwise.

**Facts re-verified before relying on them (Workstream 0):** 341 READY records (288 CA / 53 non-CA), 44 states with a published guide, 404 total records, 50 states researched — all recomputed directly from `output/research-progress-report.json`, matching your stated figures exactly. Production still uses the plain EnergySage link (confirmed via curl). `sitemap-index.xml` returns HTTP 200. The CJ "$10.00 lead" figure and Payoneer-blocker status are **taken from your report** — I have no CJ dashboard login and cannot independently verify either.

### New candidates this pass (12 researched)

**Battery/power-station retailers — 5 new, mostly strong:** **Bluetti**, **EcoFlow**, **ALLPOWERS** all confirmed real with published commission/cookie terms and real network signup paths (Impact/Awin/CJ/AvantLink/GoAffPro depending on brand) — genuine diversification beyond BigBattery/Power Queen/PVBAT, same account-creation blocker as everything else on those networks. **Jackery** and **Renogy** are real but their commission/cookie figures are only aggregator-sourced — marked `NEEDS_VERIFICATION`, not promoted to verified.

**EV charging — 1 new, fills a real gap:** **Autel Energy** (AC home chargers) — real, 10% commission, 30-day cookie, but payout requires a PayPal account, which counts as payment information under this session's own rules — `OWNER_ACTION_REQUIRED`, not further progressed.

**Generators beyond Kohler — 2 new, both weak:** **Firman Power Equipment** (vague terms, curated/influencer-style application) and **Generator Mart** (affiliate page blocked automated fetch entirely; the "8% commission" figure circulating online is **UNVERIFIED PAYOUT** — aggregator-only, not confirmed on the company's own site).

**Solar finance/loan referral (niche you asked about specifically):** came up genuinely empty. GoodLeap, Mosaic, Sunlight Financial, and EnerBank USA all operate exclusively through installer/contractor networks — none has a publisher-facing content-affiliate program. EnerBank's only public referral mechanism is a $300 gift card for referring a *contractor*, not a content publisher. **No candidate added in this niche — reporting the empty result rather than padding it.**

**Solar quote-marketplace beyond EnergySage:** also empty. SunPower's affiliate page is a live 404 (SunPower went through Chapter 11 in 2024, reacquired by Complete Solaria). ADT Solar's FlexOffers listing explicitly states the program isn't currently offered. Palmetto has a real affiliate program but it's structured for licensed sales reps doing in-person closings, not passive content — poor fit, not added.

**Pay-per-call, 3 new:** **BrokerCalls** (real, but solar is a sales-lead vertical, not content-aligned, no battery) and **CallVox** (real, no solar/battery vertical at all) — both `REJECTED`. **PermitFlow's** partner program is real but reads as B2B (integrations/resellers/industry associations); no evidence it's designed for content publishers — `REJECTED`, though a direct inquiry could still resolve this if ever prioritized.

**power.solar** — real lead-gen affiliate covering solar/EV/storage, but its own page explicitly names its target partners as "real estate professionals, contractors, community organizations, and environmental influencers" — not content/SEO publishers. `REJECTED` on stated audience mismatch, not a guess.

### Workstream 8 — monetization architecture audit: no change made, and here's why

Audited whether `InstallerCTA.astro` / the homepage CTA are too hardcoded to extend. Finding: **yes, technically** (one partner, one hardcoded URL, no data-driven registry) — but building a `src/lib/partners.ts` registry right now would be scaffolding for partners that don't exist yet. **Zero** candidates in this entire 50+-company pipeline have reached `APPROVED` + `TRACKING_LINK_RECEIVED` simultaneously — there is nothing real for a registry to route between today. This project's own standing engineering discipline (see `docs/MONETIZATION_STRATEGY.md`, `docs/FUTURE_EXPANSION.md`) explicitly warns against exactly this kind of premature abstraction. **No registry was built.** If/when a second partner reaches `APPROVED`, that's the right trigger to revisit this.

### Workstream 9 — safety tests added

New file: `tests/monetization-safety.test.mjs` (12 tests, all passing). Asserts, for both `InstallerCTA.astro` and the homepage CTA: no link to the known-dead `/p/gridpermit/` URL, no query-string tracking params on an unverified link, no `rel="sponsored"` while compensation is unverified, safe external-link attributes (`target="_blank" rel="noopener noreferrer"`), the `external_partner_clicked` tracking attribute stays present, and no unqualified compensation claim in the disclosure text. This is a small, targeted addition — not a general-purpose framework — consistent with "avoid overengineering."

### Workstream 10 — GA4 investigation

The dedicated `gridpermit` GCP project (confirmed via `~/.config/gridpermit/gsc-oauth-client.json`) **can** support GA4 Data API access — same project, no need for a new one. But the current OAuth token's scope is `webmasters.readonly` only (confirmed by reading the token file). Adding GA4 access needs, in order: **(1)** enabling the "Google Analytics Data API" in that GCP project — an owner action in the GCP console (I have no `gcloud`/console credentials to do this myself); **(2)** re-running the OAuth consent flow with an additional `analytics.readonly` scope — this requires a fresh, interactive browser authorization from you, exactly like the original GSC flow; **(3)** locating the actual GA4 **property ID** (a numeric ID distinct from the public `G-PGX9SJ9QLG` measurement ID) via the GA4 Admin UI, since it isn't discoverable from anything public-facing. **I did not start an interactive OAuth flow that needs you at the keyboard while you're away** — recorded as the exact next owner step instead, per this task's own instruction not to block the session on it.

### Workstream 11 — fresh GSC snapshot, timestamped 2026-08-15

Pulled directly via the existing read-only OAuth connection:
- **7-day** (2026-08-07 to 2026-08-14): 5 clicks / 1,138 impressions / 0.44% CTR / avg. position 13.1
- **28-day** (2026-07-17 to 2026-08-14): 6 clicks / 1,253 impressions / 0.48% CTR / avg. position 13.4

Compared to the last snapshot (7-day: 3 clicks/637 impr/pos 14.0; 28-day: 4 clicks/704 impr/pos 14.6), impressions and average position both moved in a favorable direction. **Not interpreting this as a trend** — absolute click counts (5, 6) are still far too small to distinguish a real signal from noise, and it's too soon after the sitemap resubmission and the description-template fix for either to have fully propagated through Google's re-crawl. No sitemap changes made, no URLs manually submitted, no metadata touched — full compliance with the observation freeze.

### Workstreams 12, 13, 15, 16, 17 — new docs

- `docs/PARTNER_APPLICATION_PROFILE.md` — reusable, verified-facts-only application answers (50/100-word descriptions, 250/500-char variants, standard Q&A)
- `docs/PARTNER_OUTREACH_QUEUE.md` — Profitise/Angi marked CONTACTED per your report; Aragon Advertising drafted READY_TO_SEND; Paragon Power Solutions and Generator Mart marked BLOCKED with the specific reason (no viable written channel / needs manual verification first)
- `docs/PAY_PER_CALL_FEASIBILITY.md` — full factor-by-factor evaluation; conclusion: no outbound-calling requirement found anywhere (so nothing triggers an automatic rejection), but the real blocker is the same missing traffic data that blocks several other decisions, plus a genuine new compliance surface (call-recording consent) worth naming honestly
- `docs/MONETIZATION_COMPETITIVE_RESEARCH.md` — SolarReviews/Solar-Estimate/EnergySage/Modernize/Forbes Home all monetize the same way (selling homeowner intent to installers); confirms GridPermit's existing single-partner-referral model is the right-shaped first step, not an underpowered one
- `docs/FIRST_DOLLAR_CHECKLIST.md` — the honest one-line summary: **every partner in the pipeline is stuck between "approved" and "has a real tracking link," and the fastest path isn't new research, it's activating the CJ/Payoneer-blocked EnergySage account that already exists**
- `scripts/revenue-scenarios.mjs` — adjustable scenario model (not a forecast) across 1k–100k monthly visits for three monetization shapes (referral link, pay-per-call, battery-product affiliate); every rate is tagged FACT or ASSUMPTION; verified runnable (`node scripts/revenue-scenarios.mjs`)

### Workstream 18 — affiliate network strategy

| Network | Real GridPermit candidates depending on it | Worth the owner effort? |
|---|---|---|
| **CJ Affiliate** | EnergySage (paid program), HomeAdvisor — 2 candidates, but one (EnergySage) is the account that **already exists** and already shows a real $10/lead rate per your report | **Highest leverage** — this is finishing something already started, not opening something new |
| **Awin** | MatchBurst, Power Queen, Bark.com, Bluetti/EcoFlow/ALLPOWERS (all offer Awin as one of several network choices) — 6+ candidates | **High leverage** — one account (with a real £5 refundable deposit, card required) unlocks the largest number of new candidates of any single network in this pipeline |
| **Rewardful, FirstPromoter, GoAffPro, direct programs** | Each unlocks exactly one candidate (CostToBuildHouse is dead; PlotForge has zero fit; individual direct programs like BigBattery/PVBAT/Docan Power don't share an account) | **Low leverage** — no shared account benefit, each is a one-off |

**Ranking: Awin first, CJ second (but CJ is arguably higher-urgency since the EnergySage relationship already exists and is just waiting on activation).**

### Workstream 20/21 — confirmed untouched

No SEO metadata, titles, meta descriptions, canonicals, robots, sitemap, or locality/state content changed. No HVAC/roofing/electrical/plumbing pages, no contractor marketplace, no user accounts, no GridPermit Pro, no subscriptions, no chatbot, no new backend/database. Verified via `git status` before every commit this pass.

### Workstream 22 — secret scan

Ran before every commit this pass: `git diff --cached | grep -iE "client_secret|refresh_token|api[_-]?key|password.*=|BEGIN.*PRIVATE KEY"` — zero matches in every commit. No `.env`, credential file, or `~/.config/gridpermit/*` content was ever staged.

## Tracker (seventh pass)

**VERIFIED (3 new):** Bluetti, EcoFlow, ALLPOWERS.

**NEEDS_VERIFICATION (4 new):** Jackery, Renogy, Generator Mart (UNVERIFIED PAYOUT explicitly flagged), Firman Power Equipment.

**OWNER_ACTION_REQUIRED (1 new):** Autel Energy (PayPal account required for payout).

**REJECTED (4 new):** BrokerCalls, CallVox, PermitFlow partners, power.solar.

**No change this pass:** everything else in the master status index above.

