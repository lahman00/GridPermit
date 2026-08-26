# GridPermit Monetization Research Queue

Last reconciled: 2026-08-26

## Purpose

This file is a **non-production research queue** for monetization routes that have been verified enough to investigate but have **not** cleared GridPermit's canonical approval/tracking/launch gates.

It does not override `docs/MONETIZATION_CANONICAL_STATE.md` or `src/lib/partners.ts`.

A prospect belongs here when the public program or direct outreach is real, but one or more of these are still missing: GridPermit eligibility, live binding-term review, advertiser approval, exact account economics, attributable tracking, payment/tax onboarding, promotional restrictions, or deliberate production enablement.

No entry in this file is evidence that GridPermit is approved or earning from that partner.

## Portable-power / battery wave

| Partner | Research status | Verified route / public context | Current next step | Issue |
|---|---|---|---|---|
| EBL | `AWAITING_RESPONSE` | Official UpPromote + ShareASale routes; 5% published for portable power stations, solar panels and solar-generator kits | Await marketing reply on international eligibility, UpPromote, cookie, restrictions and payment/tax | #35 |
| PECRON | `AWAITING_RESPONSE` | Publishers/bloggers accepted; public 5%-10% range; 15-day cookie | Await affiliate/business reply for exact GridPermit rate, platform, eligibility and restrictions | #36 |
| OUPES | `AWAITING_RESPONSE` | Official GoAffPro + Awin; public 5%; 60-day attribution | Await reply on international eligibility and whether GoAffPro is GridPermit's preferred route | #37 |
| VTOMAN | `VERIFIED / OUTREACH_SCHEDULED` | Official Impact/Awin/ShareASale; 10% public; content sites/bloggers invited | Send qualification inquiry in recipient-safe local-time window; prefer Impact if accepted | #38 |
| Duracell Portable Power Stations | `OWNER_TERMS_REVIEW_NEEDED` | Official Impact campaign; publishers/bloggers invited; at least 5% public | Work/owner reviews live Impact advertiser terms before any application | #39 |
| Yoshino Power US | `AWAITING_RESPONSE` | Live U.S. affiliate page; 5% public; solid-state stations/solar | Await U.S. affiliate-team route, cookie, international eligibility and restrictions | #40 |
| Mango Power | `AWAITING_RESPONSE / ROUTE_CONFLICT` | Public 6%, but current page still points to closed ShareASale platform | Await current post-ShareASale platform and a non-Awin route | #41 |
| Lion Energy | `AWAITING_RESPONSE` | Direct branded portal; 5% public; $20 payout minimum; PayPal field | Await content-publisher/international eligibility, cookie, payout cadence and restrictions | #42 |
| Hysolis | `AWAITING_RESPONSE` | Direct affiliate page; unique links; monthly commissions | Await rate, cookie, international eligibility, platform and payment terms | #43 |
| Dabbsson | `AWAITING_RESPONSE / AWIN_BLOCKED` | U.S. page: 5%, 30 days, Awin merchant 39474 | Await direct/Impact/non-Awin alternate | #44 |
| RUNHOOD | `AWAITING_RESPONSE / ROUTE_CONFLICT` | Public 5%, but signup still points to closed ShareASale | Await current platform and non-Awin option | #45 |
| AFERIY | `AWAITING_RESPONSE` | Worldwide partner terms; content/review/comparison/home-energy sites explicit; 15-day cookie; $100 threshold; PayPal/Payoneer/bank may be supported | Safe-time follow-up for exact rate, platform, product exclusions and owner-country tax/payment | #46 |
| Dakota Lithium | `AWAITING_RESPONSE / ROUTE_CONFLICT` | Public 7%, 30 days, but page still describes ShareASale | Await current platform and non-Awin route | #47 |
| Timeusb | `AWAITING_RESPONSE / AWIN_BLOCKED` | Existing Awin discovery; current non-Awin route unknown | Await direct/Impact/GoAffPro/UpPromote alternate and current economics | #48 |
| ALLWEI | `VERIFIED / OUTREACH_SCHEDULED` | GoAffPro, PartnerBoost, Shopify Collective; partnership page also exposes Impact; published rate reverts to 10%; AOV about $900 | Safe-time qualification for international eligibility, preferred route, cookie and exact starting rate | #49 |
| BigBlue | `VERIFIED / OUTREACH_SCHEDULED` | U.S. store links directly to branded GoAffPro; high-ticket CellPowa power stations + solar | Safe-time qualification for eligibility, commission, cookie, restrictions and payment/tax | #50 |
| WEIZE | `AWAITING_RESPONSE` | U.S. store links directly to branded GoAffPro; high-ticket off-grid/home-backup solar and LiFePO4 products | Await affiliate-team response on eligibility, rate, cookie and non-U.S. payment/tax | #51 |

## Routes deliberately not promoted to owner action

- **ShareASale-only/stale pages:** ShareASale closed on 2025-10-06 and active programs were migrated to Awin. A stale ShareASale button is not treated as a usable independent route. This currently affects Mango Power, RUNHOOD and Dakota Lithium until the advertiser supplies a current route.
- **Awin-only routes:** GridPermit currently cannot complete Awin publisher tax-residency onboarding with the owner's actual country through the available UI. Do not ask the owner to falsify residency. Seek a real alternate network/direct route instead.
- **Social-only ambassador programs:** Do not distort GridPermit into a social-influencer profile when the real traffic model is editorial/organic search. Newpowa was screened out on this basis.
- **Dealer-only programs:** Do not treat wholesale/dealer/OEM relationships as publisher affiliate programs. Epoch Batteries was screened out after its dealer-only transition.
- **Non-cash reward programs:** Do not prioritize programs whose current publisher compensation is only store credit rather than cash unless a cash route is directly confirmed. DJI is parked for this reason.

## Research-to-production promotion rule

A route moves out of this queue only when the new evidence is reconciled into the canonical state and machine-readable registry in the same change. Production remains fail-closed until approval, tracking, placement eligibility and launch state all agree.
