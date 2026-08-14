# Competitive Intelligence — Solar/Home-Improvement Permitting & Lead Landscape

Written 2026-08-15 as part of an overnight product audit. Public-web research only — no accounts created, no products purchased, no pricing verified beyond what each vendor publishes. **Evidence is separated from inference throughout**: a claim tagged EVIDENCE came directly from a cited source; INFERENCE is this document's own reasoning from that evidence, not a claim the source itself makes.

## 1. Automated/instant permitting platforms (the closest functional adjacency)

### SolarAPP+ (NREL / U.S. DOE)
- EVIDENCE: Free to jurisdictions and installers, funded by the U.S. Department of Energy and built by NREL. As of early 2026, 450+ AHJs have adopted it. Jurisdictions using it can issue qualifying residential solar permits automatically, within hours.
- INFERENCE: This is not a competitor to GridPermit's informational content — it automates the *submission/approval* step for jurisdictions that opt in, which is downstream of "which utility, which documents, which fees" (GridPermit's actual content). It narrows the addressable pain only for the ~450 AHJs that have adopted it, out of an estimated 36,000+ AHJs nationwide (see Symbium/AHJ.wiki figures below) — the vast majority of U.S. jurisdictions still have no automated path.

### Symbium
- EVIDENCE: An AI platform that checks permit eligibility against building, zoning, and energy codes and can submit code-compliant applications in minutes, in 271+ participating jurisdictions. Charges $25 per application to the contractor. Purpose-built to support California's SB379 mandate for automated instant permitting of residential solar. Integrates into existing municipal permit-tracking systems (Accela, Tyler Technologies, CentralSquare).
- INFERENCE: Symbium is a transaction-layer product (it *files* the permit) targeting installers/contractors directly, priced per-application. It does not appear to publish free, public, city-by-city informational content the way GridPermit does — its public-facing surface is oriented around the instant-permitting workflow itself, not pre-decision research. A homeowner researching "do I need a permit and what will it cost" before hiring anyone is not Symbium's audience.

### PermitFlow
- EVIDENCE: Full-service permit automation for developers/contractors — proprietary nationwide code database, AI-assisted application prep, real-time AHJ tracking, inspection scheduling, closeout management. Integrates with Autodesk Construction Cloud and Procore. Custom/quote-based pricing (not published). Markets a "reduces approval times by over 50%" claim.
- INFERENCE: This is an enterprise/mid-market B2B tool for construction permitting broadly (not solar-specific), sold to developers and larger contractors via sales-assisted custom quotes — a different buyer, price point, and sales motion than anything GridPermit could realistically pursue as a solo-founder product today.

## 2. Municipal-side permit portals (not competitors — the systems GridPermit's own sources come from)

### OpenGov, Accela, Tyler EnerGov
- EVIDENCE: These are B2G (business-to-government) systems that cities/counties license to run their own permitting back-office and public-facing citizen portals. Accela is positioned as the deep-customization enterprise choice; OpenGov emphasizes modern UX and citizen self-service; Tyler EnerGov emphasizes guided public-service workflows.
- INFERENCE: These are not competitors to GridPermit — they *are* several of the primary sources GridPermit's own locality records cite (e.g., a city's own Accela-powered "Citizen Access" permit portal is exactly the kind of official source a GridPermit record links to). Worth noting for the data-architecture angle: a meaningful share of U.S. cities run one of these three platforms, which means their permit-portal URL structure and public data presentation are somewhat predictable — a potential angle for semi-automated source discovery in future data-collection work (not attempted tonight).

## 3. Contractor lead-generation marketplaces (the actual competitive set for GridPermit's current monetization model)

### Angi / HomeAdvisor
- EVIDENCE: Annual membership ~$288–300 plus $15–85 per lead depending on trade (roofing/HVAC/remodeling at the higher end). Reported cost per *booked job* around $542 — the highest of the three platforms compared here.

### Thumbtack
- EVIDENCE: Credit-based bidding model (contractors buy credits to quote a job, not to receive an exclusive lead — the same request goes to 5+ contractors). Reported cost per booked job in the $150–400 range.

### Google Local Services Ads (LSA)
- EVIDENCE: Reported as the lowest cost-per-booked-job of the compared channels, around $168, for licensed home-service contractors.

### EnergySage (already GridPermit's one active referral partner — see docs/MONETIZATION_STRATEGY.md)
- EVIDENCE (already verified in a prior session): publishes a self-serve CJ Affiliate program at $9.60 per verified lead — a *pay-per-referred-lead-to-EnergySage's-own-marketplace* model, not a pay-per-booked-job model like Angi/Thumbtack.
- INFERENCE: GridPermit's current model — referring a homeowner into EnergySage's marketplace — sidesteps having to build lead-qualification, lead-delivery, or dispute-resolution infrastructure that a direct-to-contractor lead model (Angi/Thumbtack-style) would require. This is a real, structural reason to stay with the marketplace-referral model rather than build a direct contractor-lead product in the near term — see Section 8 below.

## 4. The direct "AHJ intelligence" competitive set (most relevant long-term)

### Aurora Solar's AHJ Database
- EVIDENCE (previously verified): bundled free into Aurora's paid solar design software, covering 25,000+ AHJs across seven categories of requirement.
- INFERENCE: The strongest existing incumbent threat to any plan to sell "AHJ data" as a standalone product — Aurora doesn't need to sell it separately because it's a retention feature of a much larger paid platform.

### AHJ.wiki
- EVIDENCE (previously verified, re-confirmed still pre-launch as of this session): "Permitting Intelligence for Distributed Clean Energy" — a free public lookup + paid team tier, explicitly citing 36,177 AHJs that may receive a solar/interconnection request nationwide, and framing the problem exactly as "every installer is maintaining their own database, why not share one." Still waitlist-only, no live product, no published pricing at last check.
- INFERENCE: This remains the single most direct positioning match to what GridPermit's data model could become — and GridPermit is still ahead of it (328 live, publicly indexed pages vs. zero live product), which is a time-limited advantage, not a permanent one.

## 5. What GridPermit lacks relative to this landscape

1. **No instant-permitting/submission capability** (SolarAPP+, Symbium, PermitFlow all have this). Not a gap worth closing — building a real permit-submission product is a different, much larger company than an informational site, and duplicates infrastructure (SolarAPP+, in particular) that's free and already gaining adoption.
2. **No depth-per-metro** — GridPermit's 404 records are almost entirely one-or-two-localities-per-state outside California. Aurora's 25,000+ AHJ database and AHJ.wiki's stated 36,177-AHJ universe make clear how far "comprehensive" actually is; GridPermit is not attempting to compete on raw coverage breadth today, and shouldn't — see docs/MONETIZATION_STRATEGY.md's explicit rejection of the standalone-data-product model until the dataset is materially deeper.
3. **No project-type breadth** — every competitor surveyed here (SolarAPP+, Symbium, PermitFlow, and the municipal portals themselves) handles multiple permit types (electrical, HVAC, roofing, general building), while GridPermit is solar-only. This is a genuine content-moat opportunity discussed further in Section 6 of the overnight audit's main report (search-intent taxonomy) — not attempted as new data collection tonight, since it would require a second full research-and-verification pipeline per project type, which is a multi-week undertaking, not an overnight one.
4. **No structured "trust mechanism" comparable to a platform-level accreditation** — Symbium's SB379-compliance framing and SolarAPP+'s NREL/DOE backing both function as institutional trust signals GridPermit can't claim (it's an independent research site, not a government-endorsed platform). GridPermit's actual trust mechanism — per-fact source links, confidence scores, last-verified dates — is a different but legitimate kind of trust signal, and should be leaned into rather than imitating institutional credibility it doesn't have.

## 6. What this changes about tonight's priorities

- Confirms Model A (EnergySage referral) over a direct-contractor-lead model (Angi/Thumbtack-style): building lead-qualification/delivery infrastructure to compete with $150–542-per-booked-job platforms is a much bigger, riskier build than staying a well-placed referral into an existing marketplace.
- Confirms the AHJ-data-API rejection from docs/MONETIZATION_STRATEGY.md remains correct: Aurora's free-bundled 25,000+ AHJ database is a real ceiling on standalone willingness-to-pay, and AHJ.wiki is still the one competitor actually racing GridPermit for this exact positioning.
- Adds one new, concrete signal: AHJ.wiki was **still pre-launch** as of this session (same as last time it was checked) — the head-start window is still open but not indefinite.
