# Revenue Opportunity Map

Last reconciled: 2026-08-26

Practical internal prioritization of GridPermit's existing content inventory against its actual partner pipeline. Opportunity levels are relative and qualitative only (very high / high / medium / low) — no dollar figures, conversion rates, or traffic numbers are estimated anywhere in this document. See `docs/MONETIZATION_CANONICAL_STATE.md` for the underlying partner evidence and `docs/MONETIZATION_PLACEMENT_MAP.md` for what each page type is allowed to carry.

## Opportunity by page group

| Page group | Count | Visitor intent | Opportunity | Best current candidate | Fallback candidate | Current blocker | Implementation readiness |
|---|---|---|---|---|---|---|---|
| Southern California locality guides (CompareSolarPrices' 75-city allowlist) | ~75 of 341 | Very high (mid-permit-research, city-specific, existing tracked CTA slot) | Very high | CompareSolarPrices | EnergySage (once CJ clears) | Aaron's exact PayPal setup detail + owner W-8BEN completion; PR #9 not yet merged | High — fully staged, tested, documented; needs the routing engine (this session's new work) to let it override EnergySage only for this subset |
| All other locality guides (nationwide, 341 total minus the SoCal subset) | ~266 | High (same as above, city-specific) | High | EnergySage via CJ | FlexOffers (declined), direct partner form | CJ advertiser-level approval + real tracking link | High — `InstallerCTA.astro` already renders the (untracked) link on every one of these pages; activation is a data change, not new engineering |
| Homepage | 1 | High (right after the illustrative ROI calculator's output) | High | EnergySage via CJ | CompareSolarPrices (if the visitor is in a served city) | Same CJ blocker as above | High — same CPL state machine already wired |
| State/county/utility hub pages | ~50+ | Medium (directory-level, one step removed from a single city) | Medium | EnergySage via CJ | — | Same CJ blocker; also not yet wired at all (no CTA placed today) | Medium — components exist, placement not yet built |
| Battery/backup-power blog posts (`tesla-powerwall-3-vs-enphase-iq5p`, `sgip-battery-rebates-california`, `sdge-battery-roi-guide`, and related NEM3/rate posts) | 5 posts | Medium-high (product/decision research) | Medium | Renogy or BougeRV (Impact) | ALLPOWERS (CJ/GoAffPro) | Impact/GoAffPro application + advertiser-specific terms review (owner-only) | High — `ProductAffiliateCTA.astro` ready |
| Pay-per-call across high-intent locality guides (contained subset, per DMM's gate) | Subset of the 341 | Very high (a caller is asking for help right now) | High | Digital Master Media | Lead Smart, Service Direct (both `AWAITING_RESPONSE`) | Owner-only binding Publisher Application acceptance, then tracking number | High — `PayPerCallCTA.astro` ready, disclosure/ZIP-gating built |
| Trust/legal/informational pages (about, privacy, terms, contact, methodology, 404) | 6 | None | None (by design) | — | — | — | N/A — intentionally excluded |

## Execution priority queue

Ranked by "what exact partner approval would create the most immediately usable monetization inventory on the current site," not by estimated payout:

1. **EnergySage via CJ (issue #3).** The single highest-leverage approval available. `InstallerCTA.astro` and `index.astro` already render EnergySage's link on all 341 locality pages plus the homepage today — activation is a `partners.ts` data change (real tracking URL + `launchEnabled: true`), not new engineering. This is the only route where approval alone, with zero new component work, converts already-existing production placements from untracked to tracked.
2. **CompareSolarPrices (issue #5, PR #9).** The most commercially certain route (a real direct deal with confirmed dollar terms, already staged, tested, and hardened), but narrower in reach (75 of 341 localities) and requires the new `partner-routing.ts` engine to be wired in so it can override EnergySage for that subset without creating two competing CPL CTAs on the same page. Blocked on payment/tax completion, not engineering.
3. **Digital Master Media pay-per-call (issue #1).** High per-conversion potential and the component is ready, but requires an owner-only binding Publisher Application signature before any tracking number can even be requested.
4. **Hardware-affiliate cluster (Renogy/BougeRV/ALLPOWERS, issues #6-#7).** Narrower inventory (5 posts) but three parallel, direct-confirmed candidates increase the odds one approves soon; `ProductAffiliateCTA.astro` is ready for whichever lands first.
5. **Everything else in the pipeline** (Lead Smart, Callflowmarket, Service Direct, RidgeRise, Voax, Revenue Click Media, Marketcall, RingPartner/Buyerlink, PX, SolarReviews, Modernize, EnergyPal, HSLG, Profitise, Solar.com, and the remaining hardware-affiliate candidates) — all `AWAITING_RESPONSE` or `DISCOVERED`, no GridPermit-specific terms confirmed yet. None currently outranks 1-4.

## What this map deliberately does not do

- It does not estimate revenue, conversion rate, or traffic for any page group.
- It does not recommend activating anything; every route above remains gated exactly as `docs/MONETIZATION_CANONICAL_STATE.md` and `src/lib/partners.ts` describe.
- It does not treat "highest opportunity" as "highest payout" — CompareSolarPrices' narrower reach ranks below EnergySage's leverage precisely because leverage (existing wired inventory) is being prioritized over payout size.
