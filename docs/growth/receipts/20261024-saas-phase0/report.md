# SaaS phase 0: assessment of three AI strategy briefs and what was done

Date: 2026-10-24. Branch: `claude/saas-phase0-20261024` (local, based on production `26640c6`). Nothing pushed, deployed, published or sent. No partner, price, route or tracking file changed.

## 1. What the three briefs asked for
- **Brief A (phase 0 toward SaaS):** read and summarize, verify event firing, produce a money-path table and a config change to make more pages use the paid partner, a title/description CTR test, research of missing core facts in priority cities, a paid-pilot demand test for GridPermit Pro (documents only), and one monetized next step for the Permit Path checker.
- **Brief B (master mission):** ten phases from search-intent audit to a 30-day roadmap, including a GO/REVISE/NO-GO call on Pro, partner opportunity matrix, Agensi readiness and organic distribution.
- **Brief C (analytics check):** review `analytics-events.ts` and `InstallerCTA.astro`; verify `calculator_completed`, `external_partner_clicked`, `cpl_cta_clicked`, `pro_interest_clicked`; no new GA4 setup, no new lead forms, keep the geographic partner matching exactly as is.

## 2. My assessment (what is right, what is not)
| Proposal | Verdict | Why |
|---|---|---|
| Treat Pro as something to validate, not build | **Right** | The only demand signal is a notify-me button with no recorded signups. A prepaid manual pilot tests willingness to pay at near-zero build cost. Done as documents: `docs/pro-validation/`. |
| "Make the sites SaaS" now | **Not supported** | No evidence yet that installers pay. Revenue-by-channel is not even measurable today. Recommendation: REVISE (run the 14-day pilot gate first). |
| Switch pages to the paid partner | **Already the system's behavior; nothing to switch** | Of 353 pages with a quote CTA, 85 locality pages already use the paid CompareSolarPrices route; 0 are eligible but unpaid (`money-path.csv`). The 267 EnergySage pages are untracked because the only paid partner covers a Southern California city list, so they are not eligible. The lever is partner coverage (new written approvals), not routing. |
| CTR test on positions 4 to 10 | **Not testable** | Only two unlocked pages qualify and each has well under 100 impressions in 28 days; no 28-day test can show an effect. Drafts provided as a wording improvement only. |
| Research LA, San Diego, San Jose, SF facts | **Right, in progress** | Two research agents collect official-source values; nothing is written to data without your approval (section 7). |
| "14 priority cities with every core field Not yet verified" | **Premise not reproducible** | No READY record has all four core fields empty. 68 READY records lack both fee and timeline; LA and San Jose lack both, San Diego and SF city lack timeline only. |
| A single analytics fix | **No bug found** | See section 4. |

## 3. Step 0: current state (verified 2026-10-24)
- Production: `26640c6` (merged PR #142: engine 3.0 clean history, Denver/Honolulu size-basis fix, fee re-checks, measurement converter, distribution plan). Release marker confirms it.
- Open PRs: #143 (fee updates for Rancho Santa Margarita and Monte Sereno, draft), #134 (old distribution report, draft). #141 and #144 are closed; #144 was a redundant duplicate of #142 that I opened by mistake and closed.
- Quote CTA selection: `InstallerCTA.astro` uses the fail-closed route: California locality + city on the CompareSolarPrices served list + verified single utility + partner launch-ready, else the generic EnergySage resource CTA (or the reviewed-intent partner CTA for specific pages). I did not change it.
- Referral click logging: the `/go/` redirect writes anonymous records to the private Netlify store, read only by the operator export (`scripts/outbound-export.mjs`); `scripts/build-growth-command-center.mjs --outbound` turns an export into per-page counts. No export was supplied, so clicks per page are UNKNOWN.
- Tests: full suite last run 1,045 tests, 0 failures; the analytics tests for this review pass (18 run, 17 pass, 1 skipped).

## 4. Step 1 and brief C: do the four events work?
| Event | Where it fires | How | Present in built pages | Verified |
|---|---|---|---|---|
| `calculator_completed` | `src/pages/index.astro` (homepage estimator) | `trackEvent` after the form submit and a 2.4 s placeholder animation; non-California ZIPs return before `calculator_started` | homepage | Code and build: yes. Reaches GA4: UNKNOWN |
| `external_partner_clicked` | `InstallerCTA.astro` (EnergySage resource CTA) and the homepage estimator link | `data-track-click` attribute plus one document click listener in `Analytics.astro` | 267 locality pages and the homepage | Code and build: yes. Carries no parameters. Reaches GA4: UNKNOWN |
| `cpl_cta_clicked` | `CompareSolarPricesCTA.astro` | `trackEvent("cpl_cta_clicked", {state, city, referral_cid, ...})` in a try/catch before navigation; `cpl_cta_viewed` and `cpl_cta_exposed` fire on render and at 25% visibility | the 85 paid locality pages | Code and build: yes. Reaches GA4: UNKNOWN |
| `pro_interest_clicked` | `src/pages/pro.astro` | `data-track-click` on a mailto link | `/pro/` | Code and build: yes. Reaches GA4: UNKNOWN |

Findings:
- All four are in the closed event list and wired to markup that exists in the production build. gtag loads only on `mygridpermit.com` and `www.mygridpermit.com` (preview hosts are stubbed on purpose), and the production homepage response has no Content-Security-Policy header that could block it.
- I could not check GA4 receipt, because there is no GA4 access here, so "reaches production analytics" is UNKNOWN, not yes. `generate_lead` does not exist anywhere in the code; if GA4 shows it, it is a console-configured key event and its parameters are unverified.
- Not bugs, but worth knowing: `external_partner_clicked` has no partner parameter, so partners are only distinguishable by page; `calculator_completed` counts completions of an illustrative placeholder estimate; the generic channel in `src/lib/commercial/events.ts` emits `commercial_cta_*` names through `window.gtag` directly, outside the closed list in `analytics-events.ts`; clicks blocked by ad blockers are not counted. None of these prevents the four requested events from firing.
- To verify in GA4 DebugView (unverified procedure): open the live site with Google Tag Assistant or the GA Debugger browser extension attached, click each CTA, and watch the event and its parameters appear in Admin > DebugView. Do not use a preview URL: it is stubbed.

## 5. Step 2: money path
`money-path.csv` (353 rows): per page, partner, paid or untracked, manifest membership and the eligibility rule that explains it. Summary: 85 paid, 267 EnergySage untracked (212 California cities outside the served list, 53 non-California, 1 utility not verified single-utility, 1 homepage), 1 generic partner CTA on a reviewed battery article. Zero pages are eligible but unpaid. The report script is read-only: `scripts/money-path-report.mjs`.
Baseline referral clicks and leads (28 days): UNKNOWN. Success/failure written before any change, if a new partner is ever approved for more pages: at least 10 paid referral clicks and 1 partner-confirmed lead in 28 days is success; 0 leads after 60 days with 30 or more clicks is failure. No config change was prepared because none is possible without new partner approval for the uncovered cities.

## 6. Steps 3, 5, 6
- EXP-03: `exp03-title-meta-proposal.md` (two drafts, honest statistical limit). Private baseline is outside the repo.
- Pro validation: `docs/pro-validation/` (offer, list criteria, interview script, gate, page proposal). GO = 3 prepaid pilots in 14 days, STOP = 0 payments after 12 conversations. No outreach, no code.
- Permit Path: `permit-path-next-step-proposal.md`.

## 7. Step 4: missing core facts (research, nothing applied)
Findings for Los Angeles, San Jose, San Diego and San Francisco are being collected from official sources into `saas-phase0-20261024/research/` (outside git) and will be listed here for your approval before any record is edited. Status at the end of this document.

## 8. Brief B items not repeated here
Search-intent classification, engine 2.0/3.0 and distribution were completed earlier this week (see `docs/GROWTH_COMMAND_CENTER.md`). Agensi: current local candidates are Research Skill v0.2.5 (`8b059b08…`), PTO Tracker v0.1.1 and Permit Package Gap Checker v0.1.1; none is uploaded or submitted, the seller account was never verified by me, and the price is unconfirmed ($19 versus $19.99). Partner registry (read 2026-10-24): CompareSolarPrices is the only ACTIVE/VERIFIED partner. EnergySage, Modernize, Profitise, EnergyAid, OC Solar, NorCal Solar Repair, GreenLancer, PermitDesign and Solar.com are all SHADOW/UNVERIFIED: no approval, commission or program terms are verified, none was contacted, and plan-set providers such as GreenLancer are only registry entries until an official program page and written terms exist.

## 9. Decisions waiting for you
1. Whether to run the Pro pilot (approve `offer.md`, the list criteria and a payment method), or skip it.
2. Whether to pursue another partner with written approval for NorCal and non-California cities (that is the only way to make the 267 untracked pages tracked).
3. Whether to apply the two EXP-03 wording drafts (low impact, no test possible).
4. Approve or reject the LA, San Jose, San Diego and San Francisco proposed values (section 7).
5. Whether to wire a next step into the Permit Path checker.
