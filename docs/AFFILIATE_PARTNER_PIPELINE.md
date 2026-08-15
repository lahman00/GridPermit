# Affiliate Partner Pipeline — Full Audit

Written 2026-08-15. This document supersedes the narrower `docs/AFFILIATE_PIPELINE.md` (single-program EnergySage tracker) as the canonical partner pipeline. It records grounded, primary-source verification of 23 named candidates against GridPermit's actual current state: **341 live locality pages, 100% solar/battery permit content, zero HVAC/roofing/electrical/general-home-services/contractor-software content** (confirmed via `docs/FUTURE_EXPANSION.md` — none of those verticals has been built, and none is in scope right now).

**No production monetization changes were made while producing this document.** Every finding below was verified via live web research (WebSearch/WebFetch/curl against primary sources — company sites, network advertiser pages, or the company's own affiliate/partner page) on 2026-08-15. Where a fact could not be verified from a primary source, it is marked **NOT FOUND** — nothing here is guessed or extrapolated from a similar-sounding company.

---

## 🚨 Urgent finding, unrelated to new candidates: the live EnergySage CTA is currently broken

While verifying EnergySage as part of this audit, I re-checked `https://www.energysage.com/p/gridpermit/` — the partner landing page that production CTAs were pointed at in the prior session — and found it **returns a genuine HTTP 404 "Page not found | EnergySage"** from EnergySage's own server (confirmed independently via `curl` with multiple user agents, not a bot-block: real EnergySage headers/cookies, a real branded 404 page, reproducible on repeated checks at 2026-08-15 16:21 UTC).

Production (`mygridpermit.com`) currently sends every "Compare quotes from solar installers" / "Visit EnergySage" click to this dead page — worse than the prior plain, working `energysage.com` root link. This task's own instruction ("do not change any production affiliate link unless...") stops me from silently reverting this without telling you first, so I'm flagging it here rather than fixing it. **Recommended action: tell me to revert the CTA to the plain `https://www.energysage.com` root link (confirmed live, HTTP 200) until EnergySage confirms the partner page is actually published, or confirm the URL is expected to come online shortly and this is just a timing gap.**

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
