# GridPermit Monetization — Canonical Current State

Last reconciled: 2026-09-30

## Current release and evidence precedence (2026-09-30)

The production router reads `data/commercial/partners/` plus reviewed verification, canonical locality and utility records. `src/lib/partners.ts` is retained as a legacy compatibility registry; its city helper alone is NOT proof that a page exists or a production CTA is eligible.

Aaron's written answer on 2026-09-29, message `1a0ef13f175fb849`, confirms commercial coverage of the exact 14 cities in request `1a0eed725339af3f`. It does not override utility, locality-record or release gates. Norwalk, Orange and Victorville have verified canonical records and active locality routes. Corona is held because its utility territory is split. Cathedral City, Indian Wells, Indio, Lancaster, Long Beach, Palm Desert, Palm Springs, Palmdale, Rancho Mirage and Santa Clarita remain held because the release source lacks their canonical locality records. Mission Viejo remains utility-blocked.

The reconciled release source contains 63 new-solar placements and one separately qualified battery-retrofit placement on `/blog/sdge-battery-roi-guide/`. Actual production identity must be checked in `/gridpermit-release.json` and the Netlify published deployment, not inferred from source configuration. The prior stable production deployment was restored on 2026-09-30 after stale `main` documentation commits unintentionally removed newer production features. The release build now checks route, disclosure, tracking, utility-safety and backend preservation.

CSP uses the approved direct quote destination `https://www.comparesolarprices.net/#quote`, preserving `ref=GridPermit` and a fresh anonymous CID. A qualified quote requires contact verification, an electricity bill and confirmation the homeowner has or will receive the quote report. Aaron reports on Fridays when requests occurred. An outbound record is not a partner referral or payable lead. The later installation payment remains a separate event. No new partner is activated without independently verified written approval and tracking.

The August ledger below is historical unless confirmed by the current machine registry and current written evidence; old city deep-link and staging descriptions do not describe the current runtime contract.

## Purpose

This is the human-readable reconciliation companion for GridPermit monetization partners and routes. Historical monetization documents remain evidence/history, but this file wins whenever an older document conflicts with current status.

The machine-readable partner mirror lives in `src/lib/partners.ts`. Current commercial facts, approval state, tracking state and production gates must stay consistent between the two. Do not enable a production partner from documentation alone.

## Non-negotiable gates

- No production affiliate/CPL link without a real approval or direct commercial relationship plus a real attributable tracking mechanism.
- No production pay-per-call CTA without campaign approval, a real tracking number and final campaign/compliance terms.
- No fabricated traffic, audience, revenue, company/entity, tax, payment, customer, conversion or social figures.
- No contract, network/publisher agreement, advertiser-specific agreement, tax certification, bank/payment change, identity verification, exclusivity, deposit or paid subscription without explicit owner approval.
- No monetization-driven SEO title/meta/H1/canonical/robots/sitemap/locality-architecture changes.
- No fake quote requests, fake calls or fake homeowner submissions for tracking tests.
- Production placements must fail closed when geography, tracking or partner eligibility is uncertain.

## Canonical partner ledger

| Partner / route | Channel | Status | Current verified commercial state | Current blocker / next executable action |
|---|---|---|---|---|
| **CompareSolarPrices** | CPL + installation conversion | `PRODUCTION_ACTIVE` | Directly confirmed: $25 qualified quote request, $200 funded installation conversion, Southern California, 30-day click-to-quote attribution; once attached, install conversion has no stated time limit. Dedicated `ref=GridPermit` + fresh non-PII `cid` per click is the approved tracking mechanism. PayPal selected; Aaron confirmed Israel/PayPal are accepted, received the PayPal-account email, and explicitly cleared GridPermit to put the referral link live. External production verification completed 2026-08-26: the eligible Irvine page returned HTTP 200 and rendered the paid CTA/disclosure; one real outbound click produced the correct city deep link, `ref=GridPermit`, and a valid 24-character non-PII CID without form submission; the noneligible Oakland page returned HTTP 200, did not render CompareSolarPrices, and retained one plain untracked EnergySage fallback. | Production routing remains limited to the verified Southern California locality allowlist. On 2026-09-29 Aaron explicitly confirmed in writing that GridPermit may service the requested 14-city batch: Cathedral City, Corona, Indian Wells, Indio, Lancaster, Long Beach, Norwalk, Orange, Palm Desert, Palm Springs, Palmdale, Rancho Mirage, Santa Clarita, and Victorville (\"Yes, we service those areas. 100%\"). On 2026-09-30 he also explicitly confirmed Duarte, Norco, Brea, Inglewood, Baldwin Park, Fountain Valley, and Del Mar and clarified that a qualified request must come from the homeowner; GridPermit now requires homeowner self-attestation before creating a CSP locality outbound request, while CompareSolarPrices performs its downstream verification. Reconcile real partner reporting and payouts as genuine traffic converts. W-8BEN remains a separate nonblocking tax-file follow-up. Issue #5 is complete and closed. |
| **EnergySage via CJ** | CPL (solar) | `OWNER_ACTION_REQUIRED` | CJ publisher account is activated. EnergySage advertiser ID 5835771. No advertiser approval or CJ tracking link yet. | Owner opens current advertiser terms in CJ and submits Apply/Join only after reviewing the live binding terms. Issue #3. |
| **EnergySage via FlexOffers** | CPL (solar) | `REJECTED` / reconsideration requested | FlexOffers support had confirmed non-U.S. publishers and EnergySage availability, but GridPermit account #1558079 and its verified organic/editorial traffic source were both declined with only a generic policy/current-needs reason. | Reconsideration request already sent asking for the specific reason. Do not wait on this route; prioritize CJ. |
| **EnergySage direct partner form** | CPL (solar) | `DISCOVERED` | Direct partner-registration fallback exists; terms not accepted. | Keep as fallback if CJ stalls. |
| **Digital Master Media (DMM)** | Pay-per-call (solar) | `OWNER_ACTION_REQUIRED` | Direct fit confirmed. Organic SEO/content accepted. Nationwide U.S. Public offer advertises up to $53/qualified call, not a GridPermit-approved rate. Mon-Fri 8AM-8PM EST. First qualified call only. Calls recorded. Buffer varies by traffic source; exact SEO buffer appears in application/campaign. Abid clarified that the India/Pakistan wording is intended to exclude fraudulent non-U.S. callers pretending to be U.S. consumers, not legitimate U.S. homeowners by ethnicity or national origin. | Owner reviews/signs formal Publisher Application only if acceptable. After approval still require GridPermit-specific payout, tracking number, exact buffer/IVR, ZIP guidance and disclosure/setup instructions. Issue #1. |
| **BigBattery** | Hardware affiliate | `PENDING_APPROVAL` | Application submitted; public 5% commission. | Wait for decision; do not resubmit. |
| **Profitise** | Solar PPL | `AWAITING_RESPONSE` | Official current solar publisher program pays per qualified/sold lead, supports affiliate links/forms, has no published minimum traffic requirement, $100 public payout threshold. Public pages conflict on weekly vs bi-weekly payout cadence. | Existing inquiry/follow-up pending. Need exact GridPermit payout, hosted click-out/low-PII model, geo, duplicates/reversals, international eligibility/payment and current agreement. Issue #14. |
| **EnergyPal** | Solar/home-battery publisher | `AWAITING_RESPONSE` | Current Marketing Partner route and Publisher Agreement verified. Agreement contains heavy lead-gen obligations; GridPermit asked whether a tracking-link-only hosted-form model receives lighter requirements. | Wait for response on payout, tracking, international eligibility, TrustedForm/Jornaya and insurance requirements. Do not accept agreement. Issue #10. |
| **Solar.com / Pick My Solar** | Solar marketplace affiliate | `AWAITING_RESPONSE` | Official legacy publisher affiliate page found; current platform/terms under Electrum/Solar.com not yet confirmed. | Existing direct inquiry to listed affiliate manager is pending. Do not use legacy application until current route confirmed. Issue #11. |
| **Modernize** | Solar PPL | `AWAITING_RESPONSE` | Current official affiliate page explicitly pays per lead for Solar and other trades, provides links/creative, requires approval and Terms acceptance. Current consent architecture uses affiliate consent tooling / TrustedForm records. A duplicate-checked nonbinding GridPermit inquiry was sent 2026-08-26 asking for international eligibility, exact Solar economics, hosted/click-out low-PII routing, attribution/rejection/reversal rules, consent obligations and non-U.S. payment terms. | Await publisher-team response. No application, terms, tax/payment setup or homeowner data was submitted. Issue #12. |
| **Home Services Lead Group** | Solar/home-services PPL/PPC | `AWAITING_RESPONSE` | Current affiliate program supports solar, SEO/organic/content, real-time tracking, PPL/PPC models and campaign-specific rules. Existing outreach already sent. | Wait for exact solar campaign payout, geo, qualification, tracking, payment and agreement details. Issue #13. |
| **Lead Smart** | Solar pay-per-call | `AWAITING_RESPONSE` | Seth directly confirmed GridPermit fit, non-U.S. publisher eligibility for U.S. homeowner calls, SEO/local-search traffic, and consumer-initiated inbound-call requirements. Payout can be duration-based or qualified-lead based; W-8 required. | Follow-up sent asking for current states/ZIP coverage, hours, payout/rate, minimum billable duration and key disqualifiers before tax onboarding. Do not send W-8 until campaign economics are concrete enough to evaluate. Issue #15. |
| **SolarReviews** | Solar CPL | `AWAITING_RESPONSE` | Major demand-gen business; its own privacy policy references marketing-partner/affiliate data sources. No publisher program terms confirmed yet. | Nonbinding inquiry sent 2026-08-26 to sales@solarreviews.com. Issue #16. |
| **Callflowmarket** | Solar pay-per-call | `AWAITING_RESPONSE` | Active pay-per-call network; Home Services vertical explicitly lists Solar and SEO/local content. Current applicable publisher agreement not reliably retrievable yet. | Nonbinding inquiry sent 2026-08-26. Must review the actual current agreement before onboarding. Issue #17. |
| **BettrDeal** | Solar pay-per-call/PPL | `AWAITING_RESPONSE` | Affiliate program focused on U.S. solar leads via tracking links or phone numbers; no longer buys form-only leads. Site terms include binding arbitration/class-action waiver. | Nonbinding inquiry sent 2026-08-26. International eligibility and low-PII model unconfirmed. Issue #18. |
| **Service Direct** | Solar pay-per-call | `AWAITING_RESPONSE` | Established (2006) pay-per-call program; Solar explicit; no-code Easy Earn static-DID model fits GridPermit's low-PII preference. Only an automated ack received so far. | Nonbinding inquiry sent 2026-08-26. Publisher quality rules (no 'free'/superlative/guarantee claims) must be reflected in future copy. Issue #19. |
| **RidgeRise Media** | Solar CPL/pay-per-call | `AWAITING_RESPONSE` | U.S.-focused network buying/selling qualified calls and CPL leads; Solar explicitly listed. GridPermit-specific terms unconfirmed. | Nonbinding inquiry sent 2026-08-26 to info@ridgerisemedia.com. Issue #20. |
| **Voax Media** | Solar pay-per-call | `AWAITING_RESPONSE` | Early-stage global network; Solar explicitly active. Compliance policy includes audit rights and payout reversals/withholding, requiring careful terms review. | Nonbinding inquiry sent 2026-08-26 to the founder's published contact. Issue #21. |
| **Revenue Click Media** | Solar CPL/pay-per-call | `AWAITING_RESPONSE` | Global network (Everflow/TrackDrive); Solar/HVAC listed. Signup flow requests legal-entity and tax ID/VAT/SSN, so it is a binding owner-only gate. | Nonbinding inquiry sent 2026-08-26. Not submitted. Issue #22. |
| **Marketcall** | Solar pay-per-call | `AWAITING_RESPONSE` | Large global network (165 countries); third-party listings show active U.S. Solar inbound campaigns, not yet GridPermit-confirmed. A separate $84 GMB-traffic listing must not be used as GridPermit economics. | Nonbinding inquiry sent 2026-08-26 to affiliate@marketcall.com. Issue #23. |
| **RingPartner / Buyerlink** | Solar pay-per-call/CPL | `AWAITING_RESPONSE` | RingPartner now part of Buyerlink, which acquired solar-CPL business FiveStrata; no GridPermit-specific offer confirmed. Live application requests ad-spend/performance history that must not be fabricated. | Nonbinding inquiry sent 2026-08-26 to contact@ringpartner.com. Issue #24. |
| **PX (Solar)** | Solar CPL | `AWAITING_RESPONSE` | Large marketplace with active Solar vertical; 'common publisher' PX-hosted-form model preferred over API lead-posting for GridPermit's low-PII preference. | Nonbinding inquiry sent 2026-08-26 to hello@px.com. Issue #25. |
| **Renogy** | Hardware affiliate | `OWNER_ACTION_REQUIRED` | Direct-confirmed GridPermit fit, international publisher with U.S. audience accepted, organic/editorial accepted, 6% U.S. rate, 27-day attribution, no Renogy brand-term paid search. Official Impact application link received. | Owner reviews live Impact/network + advertiser terms and submits. Notify Yuna immediately after submission as she requested. Issue #6. |
| **BougeRV** | Hardware affiliate | `OWNER_ACTION_REQUIRED` | Direct-confirmed independent content publishers and organic/editorial accepted, contextual solar/battery/home-energy links accepted, standard U.S. 7% commission. Official Impact application link received. | Owner reviews live Impact/network + advertiser terms and submits. Issue #6. |
| **ALLPOWERS** | Hardware affiliate | `OWNER_ACTION_REQUIRED` | Direct-confirmed international publisher with primarily U.S. organic traffic eligible; current U.S. terms 5%, 30 days. ALLPOWERS is transitioning the affiliate program to third-party networks. CJ advertiser ID 7797916 was supplied directly, and Bei Li confirmed she handles the manual approval. | Review the live CJ advertiser terms, submit the application, then reply to Bei so she can match/process it. No tracking link exists yet. Issue #7. |
| **Goal Zero** | Hardware affiliate | `OWNER_ACTION_REQUIRED` | Official direct program: up to 10%, 30-day cookie, Partnerize-managed, dedicated business application. Form includes Israel, U.S. customer reach and Content promotion. | Owner must review/accept binding Partnerize agreement and provide payment/tax fields. No tracking link yet. Issue #8. |
| **BLUETTI** | Hardware affiliate | `AWAITING_RESPONSE` | Published up to 10%, 30 days; Impact route exists. | Wait for direct reply/approval route. |
| **EcoFlow** | Hardware affiliate | `AWAITING_RESPONSE` | Impact route exists. U.S.-specific payout/cookie not yet directly confirmed; regional terms must not be imported. | Wait for U.S.-specific reply. |
| **Power Queen** | Hardware affiliate | `AWAITING_RESPONSE` | GoAffPro route verified; published 5.5% base, 30 days. | Wait for direct fit/current-terms reply. |
| **Redodo** | Hardware affiliate | `AWAITING_RESPONSE` | GoAffPro route exists. | Wait for direct current terms. |
| **EASUNPOWER** | Hardware affiliate | `AWAITING_RESPONSE` | Official direct email program; published 5% on confirmed orders. | Wait for cookie/payment/eligibility clarification. |
| **Vatrer Power** | Hardware affiliate | `AWAITING_RESPONSE` | Official UpPromote program; website/blog/newsletter promotion supported. | Wait for U.S. commission/cookie/payment confirmation. |
| **LiTime** | Hardware affiliate | `OWNER_ACTION_REQUIRED` | LiTime U.S. Marketing directly confirmed GridPermit fit, Impact as the preferred U.S. route, 5% starting commission per qualified sale, 30-day cookie, and acceptance of editorial/SEO content plus contextual product links. Strong-performing partners may become eligible for 8–10% based on sales volume/performance, but that higher tier is not guaranteed. | Owner reviews live Impact/network + advertiser terms and submits. After submission, send Elena the exact publisher/account name so LiTime can look out for the application. No approval or tracking link exists yet. Issue #6. |
| **RICH SOLAR** | Hardware affiliate | `AWAITING_RESPONSE` | Content-site fit indicated publicly. Auto-ack only; no substantive affiliate reply yet. | Wait for human response. |
| **Anker SOLIX** | Hardware affiliate | `AWAITING_RESPONSE` | Published 5%, 30 days; Impact/LinkShare route. | Wait for reply. |
| **Signature Solar** | Hardware affiliate | `AWAITING_RESPONSE` | Direct program; published up to 9%, 7-day cookie; international referrals described as compensable. | Wait for response or owner direct application. |
| **Nature's Generator** | Hardware affiliate | `AWAITING_RESPONSE` | Published 5%; official page has ShareASale/Awin route ambiguity. | Wait for current preferred route and cookie. |
| **SunGoldPower** | Hardware affiliate | `AWAITING_RESPONSE` | Published 6%; ShareASale route. | Wait for reply/current cookie. |
| **Zendure** | Hardware affiliate | `AWAITING_RESPONSE` | Impact route; official page conflicts between up to 5% and up to 10%; 30-day cookie. | Wait for exact current rate. |
| **Growatt** | Hardware affiliate | `AWAITING_RESPONSE` | Official page accepts publishers/content creators; published 15%-20% on qualifying sales; multiple routes including PartnerBoost. | Wait for GridPermit-specific route/terms. |
| **ECO-WORTHY** | Hardware affiliate | `AWAITING_RESPONSE` | Official U.S. page lists Impact/Awin, published 5%, 30 days. | Wait for GridPermit/Impact confirmation. |
| **Powerness** | Hardware affiliate | `AWAITING_RESPONSE` | Published 5%; official page conflicts on 45 vs 30-day cookie. | Wait for attribution clarification. |
| **ACOPOWER** | Hardware affiliate | `AWAITING_RESPONSE` | Official pages conflict on network, 6% vs 8% and payout model. | Do not apply until conflicts resolved. |
| **WattCycle** | Hardware affiliate | `AWAITING_RESPONSE` | Official affiliate page exists; public commercial terms not exposed. | Wait for reply. |
| **SOK Battery** | Hardware affiliate | `AWAITING_RESPONSE` | Official affiliate navigation exists; terms not exposed. | Wait for reply. |
| **ShopSolar** | Hardware affiliate / solar kits | `AWAITING_RESPONSE` | Official Affiliate Program redirects to ShopSolar-branded GoAffPro. | Wait for eligibility/current rate/cookie/restrictions. |
| **Jackery** | Hardware affiliate | `AWAITING_RESPONSE` | Current official U.S. affiliate page explicitly invites creators, bloggers and publishers, publishes 5% commission / at least 5% on qualifying purchases, and lists Impact, CJ and AvantLink among available networks. GridPermit already sent a nonbinding marketing inquiry on 2026-08-24. | Await reply on international eligibility, preferred network, attribution window, restrictions and non-U.S. payment/tax. Do not duplicate immediately. Issue #32. |
| **Segway portable power** | Hardware affiliate | `VERIFIED` | Official U.S. store exposes an Affiliate Program route and currently sells Lumina 500 and Cube 1000/2000 portable power stations. U.S. affiliate economics and portable-power commissionability are not exposed in accessible primary-source text. Mexico-program 3–10%/30-day terms are not U.S. evidence and are intentionally excluded. | Ask the U.S. affiliate team whether GridPermit/international U.S.-traffic publishers are eligible and whether portable-power SKUs are commissionable before any application. Issue #33. |
| **Oukitel Power** | Hardware affiliate | `REJECTED` | Awin-only route found. | Closed unless a non-Awin route surfaces. |
| **Battle Born Batteries** | Hardware affiliate | `REJECTED` | No current live affiliate page confirmed. | Closed unless a live program surfaces. |
| **Mighty Max Battery** | Hardware affiliate | `REJECTED` | Current affiliate URLs unverifiable/404. | Closed unless a live program surfaces. |
| **ADT Solar** | General referral | `REJECTED` | Consumer refer-a-friend structure, not a publisher channel. | Closed. |
| **MatchBurst** | Solar CPL | `BLOCKED` | Awin blocked; no verified alternate. | Park. |
| **Bark.com** | Home-services referral | `BLOCKED` | Awin-dependent; no verified non-Awin publisher route. | Park. |
| **Angi** | Home-services referral | `REJECTED` | Angi Affiliate Team directly said it does not accept solar leads from affiliate partners. | Closed. |
| **Current Connected** | Hardware affiliate | `REJECTED` | Applicant residency restricted to U.S./Canada residents. | Closed unless eligibility changes. |
| **SUNcheck** | Solar CPL | `REJECTED` | No real current affiliate program verified; old payout/cookie claim invalidated. | Closed. |
| **Awin network** | Network | `BLOCKED` | Israel unavailable in Awin Tax Residency dropdown. | Use per-program alternatives. |

## Production-ready status

**CompareSolarPrices is the first production-active monetization partner.** The live route remains deliberately narrow: only explicitly supported Southern California locality pages can render the paid CompareSolarPrices CTA. The referral destination is generated dynamically on each click with `ref=GridPermit` and a fresh compliant non-PII CID; no static tracked URL is fabricated in the registry.

The existing EnergySage fallback remains a plain, untracked destination and must not be described as an earning link. Outside the verified CompareSolarPrices geography, production behavior continues to fall back safely. A one-time GitHub-hosted Playwright smoke test completed on 2026-08-26 and evidenced the eligible CTA/disclosure, correct outbound city/ref/CID contract, no form submission, and the noneligible plain fallback.

## Status vocabulary

`DISCOVERED` · `VERIFIED` · `CONTACTED` · `AWAITING_RESPONSE` · `APPLICATION_STARTED` · `OWNER_ACTION_REQUIRED` · `PENDING_APPROVAL` · `APPROVED` · `TRACKING_RECEIVED` · `READY_FOR_PRODUCTION` · `PRODUCTION_ACTIVE` · `REJECTED` · `BLOCKED`

## First-revenue priority

1. **CompareSolarPrices** — production-active and externally verified on 2026-08-26 with one real outbound click and no form submission. Reconcile actual partner reporting and payouts as genuine traffic arrives.
2. **EnergySage via CJ** — CJ network account is already activated; advertiser-level owner application is the remaining commercial gate.
3. **DMM pay-per-call** — strong revenue potential but requires owner acceptance of the publisher application and then real campaign/tracking assets.
4. **Renogy / BougeRV / ALLPOWERS / LiTime / Goal Zero** — strong battery/backup-power diversification; binding network/advertiser joins are the main remaining gates.
5. **Profitise / Modernize / Home Services Lead Group / EnergyPal / Solar.com / Lead Smart** — parallel solar diversification routes under qualification; do not accept heavier lead-gen agreements or submit tax documents until the economics and integration model justify it.

## Placement and attribution policy

The detailed placement rules live in `docs/MONETIZATION_PLACEMENT_MAP.md`.

Core rules:
- one commercial CTA per page
- service-area eligibility before payout optimization
- no CompareSolarPrices placement outside explicitly supported Southern California locality pages
- no partner/sub-ID/CID analytics containing PII
- no monetized CTA above the primary informational content
- no fake leads/calls for testing
- no production switch until real approval/tracking/compliance gates are complete

## Owner-only queue

These steps are intentionally not automated because they can create binding/tax/payment obligations:

- CompareSolarPrices: W-8BEN remains a later tax-file follow-up requested by Aaron; it is not a launch blocker.
- EnergySage: advertiser join in CJ after live-term review.
- ALLPOWERS: advertiser join in CJ for advertiser ID 7797916 after live-term review; then notify Bei for manual matching/approval.
- Renogy, BougeRV and LiTime: Impact applications after live-term review; after LiTime submission, send Elena the exact publisher/account name.
- DMM: Publisher Application/agreement after owner review.
- Goal Zero: Partnerize business application/agreement plus payment/tax setup after owner review.

Everything else should continue through nonbinding research, inbox management, follow-up and staging without owner interruption unless a materially new decision is required.
