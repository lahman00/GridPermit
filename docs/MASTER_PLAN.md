# GridPermit Master Plan

**Status:** Draft for approval — reflects repository state as of 2026-08-01, commit `98a65d7`.
**Do not build against this plan until it is explicitly approved.**

---

## 0. Where the repo actually is today

This section exists so the rest of the plan is read as *next steps from current state*, not aspiration.

- **Stack:** Astro 7 static site (`astro.config.mjs`, `package.json`), deployed to Netlify (`netlify.toml`, `npm run build` → `dist/`), source on GitHub at `lahman00/GridPermit`.
- **Pages:** One real product surface — [index.astro](../src/pages/index.astro) — a single-page hero + "calculator." Supporting pages: [how-it-works.astro](../src/pages/how-it-works.astro), [methodology.astro](../src/pages/methodology.astro), `about.astro`, `contact.astro`, `privacy.astro`, `terms.astro`.
- **The "calculator" is not a decision engine yet.** The math in `index.astro` is inline client-side JS: a `rateMultiplier` derived from the first digit of the ZIP code, multiplied against the entered monthly bill. There is no utility lookup, no rate schedule, no NEM3 modeling, no permitting logic. `methodology.astro` describes "regional rate baselines" and "solar-yield assumptions" that don't exist anywhere in the code — the methodology page is currently describing a system that isn't built.
- **Content is CA-specific; site copy is not.** All 5 blog posts under [src/content/blog/](../src/content/blog/) are California-only: PG&E NEM3, SCE guide, SDGE guide, SGIP rebates, Tesla Powerwall vs Enphase. But `index.astro`'s hero copy claims "50 States," "US ZIP Code," regional grids ("Northeast Regional Grid," "ERCOT Zone," etc.). Git history confirms this was deliberate: commit `e73ae56` "Expand GridPermit to full US-wide calculator." **This is the central strategic tension this plan resolves** — the domain name, the content, and the incentive programs (SGIP is CA-only) all point to California; the current homepage dilutes that into a generic 50-state claim with no data behind it.
- **Monetization:** Outbound affiliate link to EnergySage on the homepage (commit `4fbfb34` replaced a lead form with a direct outbound button). Blog posts contain placeholder affiliate links (`https://YOUR-AFFILIATE-LINK-HERE.com` in `sgip-battery-rebates-california.md`) that were never wired up.
- **SEO infrastructure that exists:** GA4 (`G-PGX9SJ9QLG`), Google Search Console verification (meta tag + `googlea5625ff69127162c.html`), `sitemap.xml`, `robots.txt`.
- **What doesn't exist yet:** any structured data layer, any agent/automation, any permitting content or logic (despite "Permit" being the product name), any template system for scaling pages, any tests.
- **This session's change:** created empty `agents/`, `prompts/`, `templates/`, `data/`, `output/` directories alongside the existing `docs/` directory, and this file. No other files were touched.

---

## 1. Vision

GridPermit becomes the decision platform Californians use before they buy solar, add a battery, or file a permit — not another lead-gen calculator page that happens to rank.

Scope is deliberately **California-only**, reversing the direction of commit `e73ae56`. The reasoning: every asset that currently has real value in this repo (SGIP content, PG&E/SCE/SDGE guides, NEM3 coverage) is CA-specific and non-trivial to replicate for other states. A 50-state calculator with a ZIP-digit heuristic competes with EnergySage's own calculator and loses; a California tool with real utility rate schedules, real NEM3 export math, and real per-AHJ (Authority Having Jurisdiction) permit rules is defensible and matches the domain name.

"Permit" is currently unaddressed in the product. Permitting — timelines, fees, inspection requirements, HOA/AHJ quirks by city/county — is the wedge that's genuinely differentiated from every other solar-savings calculator, because no generic competitor is going to build 58-county-level permit data.

## 2. Business model

Revenue stays affiliate/referral-based in the near term — that's already the working model (EnergySage outbound link) and changing it isn't part of this plan.

- **Primary, near-term:** Outbound referral to installer marketplaces (EnergySage today). Revenue depends on traffic volume × click-through × their payout, none of which GridPointmit controls directly, which is why quality/relevance of the estimate matters — a visitor who trusts the number is more likely to click through.
- **Secondary, once the Decision Engine (Section 6) is real:** Direct installer/permit-expediter referral relationships, priced on lead quality rather than a flat marketplace click — possible specifically because CA-hyper-local + permit-aware data lets GridPermit qualify leads (jurisdiction, utility, rate schedule) before handoff, which a generic calculator can't.
- **Not in scope:** subscriptions, SaaS tooling for installers, or a marketplace product. Those would be a different company; nothing in the current repo points that direction, and CLAUDE.md's instruction not to invent new features rules it out unless it's added here explicitly later.
- **First fix required for the model to be honest:** replace the placeholder affiliate URLs (`YOUR-AFFILIATE-LINK-HERE`) in blog content before any of this content is promoted further — those links currently earn nothing.

## 3. Weekly production workflow

There is no automation today — every `.astro` and `.md` file was written by hand and pushed to `main`, which Netlify auto-builds. The workflow below is the minimum viable structure to move off pure hand-authoring without pretending a large agent pipeline already exists.

Weekly cycle:

1. **Target selection** — pick a small batch (start at 3–5) of hyper-local targets from the keyword/AHJ backlog (Section 5): a city/county × utility × topic combination (e.g., "solar permit Fresno County," "SDGE NEM3 export credit").
2. **Data check** — before any page is drafted, confirm the underlying facts exist in `data/` (utility rate, AHJ permit rule, rebate tier). If the data doesn't exist yet, the task is "add the data," not "write the page." This ordering is the whole point of Section 8 (tool-first) — content is never written ahead of the facts it depends on.
3. **Draft** — page generated from a template in `templates/` populated from `data/`, using a prompt in `prompts/` if an agent is doing the drafting; otherwise hand-written following the same template for consistency.
4. **Fact-check pass** — every number in the draft is traced back to a `data/` source before publishing. No number in a published page should exist only in the draft text.
5. **Publish** — commit, push to `main`, Netlify builds and deploys automatically (already working — no change needed to deploy mechanics).
6. **Track** — GA4 + Search Console (both already wired) checked weekly for the new pages: impressions, clicks, and affiliate outbound clicks per page.

This is a small, human-in-the-loop cycle first. Section 4's agents are introduced to remove manual steps from this cycle one at a time, not to replace it wholesale on day one.

## 4. AI agent architecture

`agents/` is currently empty. Proposed roles, each scoped to one job so failures are traceable to one agent instead of a black-box pipeline:

- **Data Agent** — populates and maintains `data/` (utility rate schedules, NEM3 terms, SGIP tiers, per-AHJ permit rules). Sources facts from primary sources (utility tariff filings, CPUC/CEC/city planning department pages) and records the source URL and retrieval date alongside every fact. This agent's output is the only thing later agents are allowed to treat as ground truth.
- **Content Agent** — drafts hyper-local pages from `templates/` + `data/`, using prompts in `prompts/`. Never invents a number; if `data/` doesn't have the fact, the agent stops and flags a Data Agent task instead of estimating.
- **Fact-Check Agent** — diffs a draft against `data/`, flagging any number in the draft that doesn't trace to a data file. This is the enforcement mechanism for the tool-first rule in Section 8, not a style check.
- **Publishing Agent** — mechanical step: commit, push, confirm Netlify build succeeded, submit new URLs to Search Console. No content judgment.

None of these exist yet. Build order should follow the workflow bottleneck: Data Agent first (there's no data layer at all right now), then Fact-Check Agent (so nothing ships that isn't grounded), then Content Agent (drafting is already the cheapest part of the current manual process), then Publishing Agent last (deploy already works fine by hand).

## 5. Data architecture

`data/` is currently empty. Proposed structure, one file per fact domain so the Fact-Check Agent can point at a specific source per number:

```
data/
  utilities/          # one file per CA IOU/muni: PG&E, SCE, SDGE, LADWP, SMUD, ...
    pge.json           # rate schedules, NEM3 export credit structure, TOU periods
    sce.json
    sdge.json
  incentives/
    sgip.json          # tiers, $/kWh rates, equity/equity-resiliency eligibility rules
    federal_itc.json
  permitting/
    counties/           # one file per CA county or city AHJ actually covered
      fresno.json        # permit fee, typical timeline, inspection requirements, HOA notes
  solar_yield/
    ca_regions.json     # kWh/kW/year by CA climate zone, replacing the current hardcoded assumption
```

The current hardcoded logic in `index.astro` (ZIP-first-digit → `rateMultiplier`) gets replaced by a real lookup against `data/utilities/*.json` keyed by ZIP-to-utility-territory mapping. That mapping itself is a data file, not more inline JS.

## 6. Hyper-local SEO strategy

Reverse the 50-state dilution. Target CA-specific long-tail queries where the site can actually be correct, not just present:

- **City/county + utility + topic** patterns: "PG&E NEM3 calculator," "solar permit cost San Diego County," "SGIP rebate eligibility [county]." These match the blog content that already exists and extend it systematically rather than one-off.
- **Permit-intent queries** are the differentiated wedge — "how long does a solar permit take in [city]," "[county] AHJ solar inspection requirements" — nobody else in this space is building this because it doesn't scale without real per-jurisdiction data, which is exactly what Section 5's `data/permitting/` is for.
- **Existing blog posts are the seed set**, not a finished corpus — [pge-nem3-calculator.md](../src/content/blog/pge-nem3-calculator.md), [sce-guide.md](../src/content/blog/sce-guide.md), [sdge-guide.md](../src/content/blog/sdge-guide.md) map to the three major CA IOUs; extend the same pattern to munis (LADWP, SMUD) and then to counties for permit content.
- Programmatic generation only from `data/` + `templates/` (Section 5/7) — no page ships describing a jurisdiction or utility that doesn't have a corresponding data file, to avoid the exact mismatch that exists today between `methodology.astro`'s claims and the actual (nonexistent) backing data.

## 7. Decision Engine strategy

"Decision Engine" = the thing that currently doesn't exist behind `methodology.astro`'s claims. Concretely: replace the ZIP-digit heuristic in `index.astro` with a real pipeline:

1. ZIP code → utility territory + AHJ (city/county) via a data-backed lookup.
2. Utility → real rate schedule and NEM3 export terms from `data/utilities/`.
3. Monthly bill + rate schedule → system size (kWh/kW yield from `data/solar_yield/`, not a flat 28 assumption).
4. Incentive stack (federal ITC + SGIP if applicable) from `data/incentives/`.
5. AHJ → permit cost/timeline from `data/permitting/` where covered, with an honest "not yet covered" state where it isn't — never silently falling back to a guess.

The engine should be able to say *why* it produced a number (which data file, which rate schedule) — that's what makes it a decision engine instead of a calculator, and it's the direct fix for the current gap between `methodology.astro`'s narrative and the actual math.

## 8. Tool-first philosophy

No LLM call ever produces a number that lands on the site. Rates, rebate tiers, permit fees, and yield assumptions live in `data/` as the single source of truth, populated and updated by the Data Agent from primary sources with citations. LLM/agent involvement is scoped to *writing* (Content Agent drafting prose around the numbers) and *verification* (Fact-Check Agent), never to *computing or estimating* a figure that ends up in front of a user. This is the same principle CLAUDE.md's parent-repo sibling project applies to itself — deterministic tools compute, agents draft and check — applied here because permit fees and utility rates are exactly the kind of fact an LLM will plausibly hallucinate if asked to estimate them directly.

## 9. Success metrics

Tracked against infrastructure that already exists (GA4 + Search Console) — no new analytics tooling needed to start:

- Indexed hyper-local CA pages (count, growing weekly per Section 3's cycle).
- Organic impressions/clicks on hyper-local queries specifically (city/county + utility + permit terms), not aggregate traffic — aggregate traffic can hide the fact that generic 50-state pages are doing the work instead of the CA-specific strategy.
- Affiliate outbound click rate on pages with real Decision Engine output vs. the current heuristic, once Section 7 ships — this is the number that validates or kills the "accuracy drives conversion" thesis underlying Section 2's business model.
- Permit-data coverage: number of CA AHJs with a real `data/permitting/` file vs. total CA counties (58), as a direct measure of the differentiation claimed in Section 1.

## 10. Future roadmap

Phased, each phase gated on the previous one actually shipping — not a parallel wishlist:

- **Phase 1 (current):** Manual content, heuristic-only calculator, US-wide copy. This plan's baseline.
- **Phase 2:** Re-scope homepage copy to California only; build `data/utilities/` for the three major IOUs (PG&E, SCE, SDGE) already covered in blog content; replace the ZIP-digit heuristic with a real lookup against that data.
- **Phase 3:** Build `data/permitting/` for a first batch of CA counties; ship permit-timeline content — the differentiated wedge from Section 1.
- **Phase 4:** Stand up the agent pipeline (Section 4) in build order (Data → Fact-Check → Content → Publishing) to scale hyper-local page production beyond hand-authoring.
- **Phase 5:** Only after CA coverage and the Decision Engine are real and measurably converting (Section 9) — consider direct installer/permit-expediter referral relationships (Section 2's secondary revenue line). Re-expanding beyond California is explicitly out of scope until then; that expansion is what diluted the site the first time.

---

**This plan is a draft. Per CLAUDE.md, no further implementation proceeds until it's approved.**
