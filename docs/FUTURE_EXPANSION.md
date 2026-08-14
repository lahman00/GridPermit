# GridPermit Future Expansion Ideas

Written 2026-08-15, during the GridPermit 2.0 national-platform build. This document exists so that attractive ideas encountered while building the solar/battery permit wedge are recorded and evaluated later, on evidence — not built now, and not forgotten either. See `docs/NATIONAL_PRODUCT_STRATEGY.md` for why the wedge stays narrow today.

**Rule for every entry below:** an idea moves from this document into a real build only when its expansion gate is met with observed evidence, not because it "seems like the obvious next step" mid-session. Where a specific numeric threshold can't yet be justified from data GridPermit actually has, the gate says what evidence must be collected first instead of inventing a number.

---

## 1. Electrical permits (non-solar)

- **User problem:** A homeowner doing a panel upgrade, EV charger install, or general electrical work wants the same kind of source-linked permit guide GridPermit provides for solar.
- **Why potentially valuable:** Electrical permitting shares an AHJ (building/electrical department) with solar in most cities — some research overlap exists (permit authority, inspection process structure).
- **Evidence observed:** None collected. GridPermit has never surfaced electrical-permit search queries, has no electrical-permit content, and has not measured demand for it.
- **Prerequisite:** Solar/battery guide coverage and monetization must be demonstrably working first — this is explicitly the wedge GridPermit is trying to win before considering an adjacent one.
- **Expansion gate:** Before building, collect: (a) a meaningful share of `/search` queries containing non-solar-permit terms (e.g. "electrical panel," "EV charger permit") that return no useful result, sustained over a real measurement window, and (b) confirmation that the solar wedge itself has hit its own "10 things excellent" bar from `docs/NATIONAL_PRODUCT_STRATEGY.md`. No query-volume threshold is set here yet — GridPermit doesn't have the search-analytics history to justify one.

## 2. HVAC permits

- **User problem:** Homeowner installing a heat pump or AC system needs permit guidance; heat pumps in particular overlap with the electrification/solar audience.
- **Why potentially valuable:** Heat-pump buyers are adjacent to the solar-buyer demographic; some cross-sell potential exists.
- **Evidence observed:** None. No HVAC content or query data exists on the site today.
- **Prerequisite:** Same as electrical — solar wedge dominance first.
- **Expansion gate:** Sustained, observed `/search` demand for HVAC/heat-pump permit queries with no matching result, plus a specific decision that GridPermit's data-collection pipeline (the same one used for solar records) can be pointed at HVAC AHJ rules without diluting solar research velocity.

## 3. Roofing permits

- **User problem:** Homeowner researching a roof replacement (often bundled with solar installs) wants permit information for that step too.
- **Why potentially valuable:** Roof work frequently precedes or accompanies a solar install — real adjacency to the current user journey.
- **Evidence observed:** None measured. No roofing content exists; no query data collected.
- **Prerequisite:** Same as above.
- **Expansion gate:** Observed evidence that a meaningful share of GridPermit's actual solar-guide readers also ask about roofing permitting (e.g., via a future on-page prompt or support/contact inquiries), not just a general assumption that the audiences overlap.

## 4. Plumbing permits

- **User problem:** Distinct home-improvement permit need with no natural overlap to solar/battery beyond "same city government."
- **Why potentially valuable:** Low — no clear connection to GridPermit's current user or data asset.
- **Evidence observed:** None. No signal at all that GridPermit's audience wants this.
- **Prerequisite:** All higher-adjacency verticals (electrical, HVAC, roofing) would need to be validated and built first, since plumbing has the weakest connection to solar.
- **Expansion gate:** Not a near-term candidate. Would need its own independent demand validation, unconnected to solar-guide traffic, before consideration.

## 5. General building-permit platform (all permit types, all trades)

- **User problem:** "One place for every permit in my city," not just solar.
- **Why potentially valuable:** Much larger total addressable market than solar alone.
- **Evidence observed:** None — and this is explicitly the outcome `docs/NATIONAL_PRODUCT_STRATEGY.md` says GridPermit is *not* trying to become right now.
- **Prerequisite:** Each individual vertical (electrical, HVAC, roofing, etc.) would need its own validated demand and its own verified dataset — a general platform built by breadth-first expansion before any one vertical is deep risks the "inaccurate, thin, page-count-chasing" failure mode the mission explicitly warns against.
- **Expansion gate:** Only after at least one additional vertical beyond solar has independently reached the same verification and coverage bar solar guides use today (READY/LIMITED discipline, source-linked facts) — not before.

## 6. Contractor / installer marketplace (two-sided)

- **User problem:** Installers want qualified leads; homeowners want to compare multiple installer quotes in one place, not just one referral link.
- **Why potentially valuable:** Marketplaces typically monetize far better per-user than a single affiliate link.
- **Evidence observed:** None. Current monetization (`InstallerCTA.astro`) is a single-partner (EnergySage) referral link, deliberately narrow, and has not yet been measured for click-through or conversion at scale.
- **Prerequisite:** The narrow single-partner referral model must first be proven (real click and conversion data, not just being live) before adding the complexity of a multi-party marketplace (installer onboarding, lead routing, quality control, payments).
- **Expansion gate:** A sustained, measured InstallerCTA click-through rate and enough conversion signal (from EnergySage or a future partner) to justify the operational complexity of onboarding multiple installers directly — plus explicit evidence that a single-partner model is capped in a way a marketplace would fix. No specific CTR number is set here; GridPermit doesn't yet have a full traffic history to benchmark against.

## 7. AI permit assistant / chatbot

- **User problem:** "Just tell me what I need for my specific address," conversationally, instead of reading a guide page.
- **Why potentially valuable:** Could reduce friction for complex or ambiguous cases (e.g., unusual jurisdiction overlaps).
- **Evidence observed:** None. This is explicitly excluded from tonight's build and from the product's core identity in `docs/NATIONAL_PRODUCT_STRATEGY.md` ("Not... an AI assistant").
- **Prerequisite:** GridPermit's core value proposition is *source-linked, verifiable, human-checked* facts — an AI assistant that generates conversational answers risks undermining exactly that trust position unless it's built to cite the same verified records with zero hallucination risk, which is a nontrivial engineering and QA investment.
- **Expansion gate:** Would require (a) the underlying verified dataset to be far more complete than today's 33/50-published-states state, and (b) a specific, tested method for grounding any AI answer strictly in verified records with visible citations — not a general-purpose chatbot. No timeline or number is set; this is gated on both data maturity and a trust-preserving technical design, not demand alone.

## 8. User accounts

- **User problem:** Save progress, revisit guides, track multiple properties.
- **Why potentially valuable:** Enables personalization, saved searches, and stickier repeat usage.
- **Evidence observed:** None. No account system exists; no user has ever been asked whether they'd want one.
- **Prerequisite:** Explicitly deferred by this mission (Phase 11: "Do NOT build GridPermit Pro tonight... no subscriptions/accounts/Stripe/auth/dashboards"). `/pro` exists today purely as a free interest-validation page.
- **Expansion gate:** A measured, meaningful volume of `/pro` interest-clicks (the `pro_interest_clicked` or equivalent analytics event) sustained over time, indicating real demand for a persistent/paid product — before any accounts infrastructure is built. The specific volume threshold isn't set here because GridPermit hasn't yet run `/pro` live long enough to have a baseline to compare against.

## 9. Permit tracking (status monitoring for an in-progress application)

- **User problem:** "I submitted my permit — tell me when it's approved," instead of manually checking the city portal.
- **Why potentially valuable:** High-frequency, high-utility feature if it worked reliably — but requires integration with each city's own permit-tracking system (hundreds of different systems, many with no public API).
- **Evidence observed:** None. Not requested by any user; not technically scoped.
- **Prerequisite:** Would require per-jurisdiction integration work at a scale far beyond GridPermit's current one-time research-and-verify model — a fundamentally different (and much larger) engineering investment.
- **Expansion gate:** Not a near-term candidate under any current evidence. Would need dedicated demand validation (e.g., direct user requests via `/contact`) plus a feasibility study on which jurisdictions even expose trackable permit status data before scoping.

## 10. Document generation (auto-filled permit applications)

- **User problem:** "Fill out my permit application form for me" instead of just describing what's required.
- **Why potentially valuable:** Saves real time for a homeowner or installer once they know what's required.
- **Evidence observed:** None directly, though the print-checklist feature (Phase 9, `docs/PERMIT_CHECKLIST.md`) is a deliberately minimal, non-generative "print what's already on the page" tool — explicitly *not* this. Its usage (once analytics accumulate) is a natural first signal to watch.
- **Prerequisite:** Explicitly excluded from tonight's build ("no... complex generators"). Would require per-jurisdiction form templates and legal/liability review for generating filed documents.
- **Expansion gate:** Sustained, observed usage of the existing print-checklist feature (the `print_checklist_used` event or equivalent) as a leading indicator of demand for something more structured — plus a specific decision that the liability profile of *generating* application documents (versus just describing requirements) is acceptable.

## 11. Permit data APIs (B2B data licensing)

- **User problem:** A software vendor, PropTech company, or research firm wants programmatic access to GridPermit's verified permit dataset.
- **Why potentially valuable:** A B2B data-licensing model monetizes the core data asset itself, independent of consumer traffic.
- **Evidence observed:** None. No inbound interest has been recorded (no inquiry channel exists to even capture this today).
- **Prerequisite:** Dataset breadth/depth (currently 404 records, 328 READY) would likely need to be substantially larger and more consistently fresh before it's a credible commercial data product; also needs legal/licensing terms defined.
- **Expansion gate:** At least one unsolicited inbound inquiry (via `/contact` or elsewhere) asking for API or bulk-data access — real demand signal — before investing in API infrastructure, authentication, rate limiting, and licensing terms.

## 12. Municipality-facing SaaS (permit-processing software for AHJs)

- **User problem:** Small cities/counties often run permitting on outdated or paper-based systems and might want modern software.
- **Why potentially valuable:** Completely different business model (B2G SaaS) with potentially large per-customer value — but also completely different sales motion, security/compliance requirements, and product.
- **Evidence observed:** None whatsoever. No municipality has been contacted about this; it is unrelated to GridPermit's current information-product identity.
- **Prerequisite:** This is a different company, not a GridPermit feature — would require dedicated validation independent of anything in the current product.
- **Expansion gate:** Not evaluated as a near-term GridPermit expansion at all; would need its own independent business case, not a threshold on GridPermit's existing metrics.

## 13. Installer-facing SaaS (paid tool for solar installers/permit specialists)

- **User problem:** An installer wants a paid tool — beyond a free lookup — to manage AHJ requirements across many cities they work in (e.g., bulk lookups, alerts on rule changes, team accounts).
- **Why potentially valuable:** This is the most directly adjacent paid-product idea to GridPermit's actual secondary user (see `docs/NATIONAL_PRODUCT_STRATEGY.md`'s "Secondary user"), and `/pro` already exists as a free interest-validation page aimed at exactly this audience.
- **Evidence observed:** `/pro` exists and is live, but as of this session no interest-click volume has been reported or reviewed in this document — see Phase 11's explicit instruction not to build a paid product from this page tonight.
- **Prerequisite:** Real, sustained `/pro` interest-click data over a meaningful period.
- **Expansion gate:** A meaningful, sustained rate of `/pro` interest-clicks (the specific analytics event already wired up) relative to installer-relevant traffic (locality guide views, `permit_guide_clicked` events) — reviewed explicitly before any paid tier, auth system, or dashboard is scoped. No specific number is set here; the next session that revisits this page should pull the real `/pro` click data from GA4 first and record it in this document, then decide whether a threshold is now justifiable.

---

## How to use this document

Before building any idea above: re-read its "Evidence observed" line. If it still says "None," the idea is not ready — go collect the evidence the "Expansion gate" describes, don't build around it. When real evidence does show up (an analytics number, an inbound inquiry, a support request), update this document's "Evidence observed" field with the actual observation and date, so the gate can be evaluated honestly next time.
