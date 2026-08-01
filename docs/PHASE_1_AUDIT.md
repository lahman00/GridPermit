# Phase 1 Audit — Unsupported Claims & Broken Content

Date: 2026-08-01
Scope: every page/file that ships to production (`src/`, `public/`), reviewed against the rule "do not claim data, coverage, or accuracy the product does not actually have."

Each item: **file:location** → **problem** → **proposed correction**. Corrections are implemented in the commit that follows this audit; nothing below has been changed yet at the time this file is written.

---

## ⚠️ OPEN TODO — NOT FIXED, NEEDS YOUR DECISION

**Contact email domain mismatch:** [contact.astro:25](../src/pages/contact.astro#L25) lists `support@gridpermit.com` and `privacy@gridpermit.com`, but the site's actual live domain everywhere else — `astro.config.mjs` (`site:`), `robots.txt`, GA property, canonical URLs — is `mygridpermit.com` (with "my"). These are two different registrable domains. Per explicit instruction, this has **not** been changed. If `gridpermit.com` mail is not actually configured and monitored, these are silently broken contact addresses on a legal/privacy-disclosure page — a real risk for a site that includes CCPA/privacy-rights language directing users to email for requests. **Action needed:** confirm which domain actually receives mail, then update `contact.astro` (and `privacy.astro`, which references the same addresses) accordingly.

---

## A. Nationwide / "50 states" / fake regional-data claims

| # | File:Location | Problem | Correction |
|---|---|---|---|
| A1 | [index.astro:18-19](../src/pages/index.astro#L18) | `<title>` and meta description claim "US Solar & Battery Savings Calculator," "across all 50 US states." No such coverage exists — the JS behind it is a ZIP-digit heuristic, not per-state data. | Rewrite to California-specific title/description. |
| A2 | [index.astro:27](../src/pages/index.astro#L27) | Top banner: "across all 50 states." | Rewrite to "across California." |
| A3 | [index.astro:51-53](../src/pages/index.astro#L51) | Badge/H1/lead copy: "Independent US Solar & Battery Savings Estimator," "In Any State." | Rewrite to California framing. |
| A4 | [index.astro:55-59](../src/pages/index.astro#L55) | Hero stats: "50 States / US Coverage," "Regional / Rate Averages" — both claim data coverage that doesn't exist. | Replace with honest CA-scoped stats (e.g., "California / Coverage Area," "3 Major IOUs / PG&E, SCE, SDG&E named", "Illustrative / Not Utility-Specific"). |
| A5 | [index.astro:61-63](../src/pages/index.astro#L61) | "Our estimates use publicly available regional electricity pricing, solar-production assumptions, and standardized system-cost inputs" — implies a real regional pricing dataset backs the tool. None exists; the JS uses one hardcoded multiplier. | Rewrite to state plainly that a single statewide placeholder assumption is used, not utility-specific or regional data. |
| A6 | [index.astro:75](../src/pages/index.astro#L75) | ZIP placeholder examples include `75001` (TX) and `33101` (FL) on a form that (per this phase) only supports California. | Replace with CA-only examples (e.g., 90210, 94103, 92101). |
| A7 | [index.astro:76, 187-198](../src/pages/index.astro#L76) | "Utility Zone Detected" pill claims to identify the user's grid/utility from ZIP. The JS only buckets the *first digit* of ZIP into one of 5 fake US "regions" (`Northeast Regional Grid`, `Southeast / Atlantic Grid`, `Midwest Energy Zone`, `Southwest / ERCOT Zone`, `Pacific / West Utility Zone`) — none of which is a real utility and most of which aren't in California at all. | Remove regional branching entirely. Replace with a plain California ZIP-range check (structural, not a utility lookup) and copy that says utility-specific detection (PG&E/SCE/SDG&E) is not yet available. |
| A8 | [index.astro:89](../src/pages/index.astro#L89) | Loading text: "Modeling regional utility rate averages..." | Reword to "Applying statewide placeholder assumptions..." |
| A9 | [index.astro:101-109](../src/pages/index.astro#L101) | Confidence box states "Estimate Confidence: Medium," "✓ Calculated using ZIP rate baseline & regional energy pricing," "✓ Modeled with peak time-of-use (TOU) battery dispatch." **All three are false** — there is no ZIP rate baseline, no regional pricing data, and no TOU dispatch model anywhere in the code; the JS is a single multiplier times the entered bill. | Replace with an honest label ("Illustrative Only — Not Utility-Specific") and remove the false capability claims. State plainly what is and isn't modeled. |
| A10 | [index.astro:177-249](../src/pages/index.astro#L177) | The entire calculation: `rateMultiplier` selected by ZIP's first digit, feeding invented-looking but fabricated system size, battery size, payback years, and 20-year savings. This is the core "fake ZIP-first-digit calculator" named in the task. | Replace per Section 3 of this audit (below) with an honest CA-only MVP. |
| A11 | [about.astro:24](../src/pages/about.astro#L24) | "help US homeowners understand ... across all 50 states." | Rewrite to California. |
| A12 | [about.astro:27](../src/pages/about.astro#L27) | "based on publicly available electricity pricing data, regional solar yield baselines" — same unsupported regional-data claim as A5. | Rewrite to match the honest methodology (Section 3). |
| A13 | [about.astro:9 meta description](../src/pages/about.astro#L9) | "US solar and battery storage economics." | Rewrite to California. |
| A14 | [methodology.astro (whole page)](../src/pages/methodology.astro) | Describes "regional US electricity pricing baselines," "standardized regional solar production factors ranging from 1,300 to 1,600 kWh per installed kW annually," "TOU energy offset models" — none of this exists in the code. This is the most directly false page in the repo: it documents a system that was never built. | Full rewrite: describe the actual (simple, single-assumption) calculation honestly, state California-only scope, and label the placeholder assumption as a placeholder. |
| A15 | [how-it-works.astro:29](../src/pages/how-it-works.astro#L29) | "Enter a US ZIP code" | Change to "California ZIP code." |
| A16 | [terms.astro:25](../src/pages/terms.astro#L25) | "preliminary financial and sizing estimates based on standardized regional inputs" — same unsupported "regional" framing. | Reword to "standardized, illustrative assumptions (not utility-specific or regional data)." |
| A17 | [BaseHead.astro / consts.ts](../src/consts.ts) | Sitewide fallback `SITE_TITLE = 'Astro Blog'`, `SITE_DESCRIPTION = 'Welcome to my website!'` — these are the unmodified Astro starter defaults. They render as the `<title>`/description on `/blog`, every `/blog/{post}` page (content-collection posts), and the RSS feed (`rss.xml.js` imports them directly). Search engines and RSS readers currently see "Astro Blog / Welcome to my website!" for 5 of the site's blog posts. | Set to real GridPermit title/description. |

## B. Component branding that doesn't describe GridPermit at all

| # | File:Location | Problem | Correction |
|---|---|---|---|
| B1 | [Header.astro](../src/components/Header.astro) | Used by `/blog` and every `/blog/{slug}` content-collection post. Renders Astro-the-framework's own Mastodon/Twitter/GitHub social links (`m.webtoo.ls/@astro`, `twitter.com/astrodotbuild`, `github.com/withastro/astro`) on GridPermit pages — these are unrelated third-party accounts, not GridPermit's. | Remove Astro's social links; align nav with the main site (Home, Blog, About). |
| B2 | [Footer.astro](../src/components/Footer.astro) | Same file family: footer copyright reads "© {year} **Your name here**. All rights reserved." — the literal unedited starter placeholder — plus the same Astro social links, on live GridPermit blog pages. | Replace with real GridPermit copyright + affiliate disclosure consistent with the homepage footer. |

This means the 5 content-collection blog posts (`pge-nem3-calculator.md`, `sce-guide.md`, `sdge-guide.md`, `sgip-battery-rebates-california.md`, `tesla-powerwall-3-vs-enphase-iq5p.md`) currently render, live, with the wrong site name, wrong description, "Your name here" copyright, and links to Astro's own social media. This is a direct violation of "homepage, methodology, about, ... describe the same actual product" (item 8) even though these files weren't named explicitly — they're reachable, indexed-content pages of the same product.

## C. Broken / placeholder commercial links

| # | File:Location | Problem | Correction |
|---|---|---|---|
| C1 | [pge-nem3-calculator.md:41](../src/content/blog/pge-nem3-calculator.md#L41) | Link target is the literal placeholder `https://YOUR-AFFILIATE-LINK-HERE.com` — not a real domain, will not resolve. | Point to the same real, working destination already used on the homepage (`https://www.energysage.com`, `rel="sponsored noopener"`), for consistency. |
| C2 | [sgip-battery-rebates-california.md:33](../src/content/blog/sgip-battery-rebates-california.md#L33) | Same placeholder domain. | Same correction. |
| C3 | [tesla-powerwall-3-vs-enphase-iq5p.md:37](../src/content/blog/tesla-powerwall-3-vs-enphase-iq5p.md#L37) | Same placeholder domain. | Same correction. |
| C4 (risk, not changing) | [index.astro:152-153](../src/pages/index.astro#L152) | The homepage's EnergySage link is real and resolves, but carries no affiliate tracking parameter, while the adjacent copy states "GridPermit may earn compensation if you use this link." There's also a `<!-- TODO: Replace with the approved affiliate tracking URL before launch -->` comment confirming this is known to be incomplete. | **Not fixed in this pass** — I don't have a real tracking ID/URL to insert, and fabricating one would recreate exactly the "fake commercial link" problem this phase is trying to remove. Flagged as an open item for you to supply (see final report). |

## D. Corrupted file content

| # | File:Location | Problem | Correction |
|---|---|---|---|
| D1 | [sdge-guide.md](../src/content/blog/sdge-guide.md) (113 lines) | The file contains **three copies** of the same article pasted back-to-back, interleaved with literal leftover shell commands (`git add .`, `git commit -m "..."`, `git push origin main`, `cat << 'EOF' > ...`) that appear to have been accidentally saved into the markdown content instead of being run in a terminal. This is not a claim issue — it's corrupted content, but it also means the live page currently renders duplicated text and literal `git` command lines in the article body. | Keep only the final, clean version (lines 75–113) and delete the duplicated/corrupted content above it. |

## E. Unverifiable specific statistics in existing blog content (flagged, not rewritten in this pass)

These files assert specific rate/dollar figures attributed to named sources (CPUC filings, utility tariff schedules) that I have no way to verify against a primary source right now, and rewriting them correctly requires the same kind of sourced `data/` layer described in `docs/MASTER_PLAN.md` Section 5 (Phase 2/3 work), not a copy edit:

- [pge-rate-hikes-2026.astro](../src/pages/blog/pge-rate-hikes-2026.astro) — "35% increase 2021–2026," "$0.55/kWh," "~$0.05/kWh" export.
- [sdge-battery-roi-guide.astro](../src/pages/blog/sdge-battery-roi-guide.astro), [sdge-guide.md](../src/content/blog/sdge-guide.md) — "$0.62–$0.68/kWh," "$0.42–$0.48/kWh," "$0.24–$0.28/kWh" TOU-DR1 breakdown.
- [solar-battery-payback-nem3.astro](../src/pages/blog/solar-battery-payback-nem3.astro) — "CPUC Decision D.22-12-056," payback-year table.
- [pge-nem3-calculator.md](../src/content/blog/pge-nem3-calculator.md) — net investment/payback table ($13,500 / $21,000, 9.0 / 5.0 years).

**Proposed correction for this phase:** add one short, consistent disclosure line to each ("Figures above are illustrative examples based on publicly reported rate ranges, not a live lookup of your bill — confirm current rates with your utility before making a decision") rather than deleting or rewriting the substantive content. Full verification against primary tariff filings is out of scope for Phase 1 and belongs with the data layer work.

## F. Technical SEO inconsistency

| # | File:Location | Problem | Correction |
|---|---|---|---|
| F1 | [astro.config.mjs:10](../src/../astro.config.mjs#L10) vs [public/sitemap.xml](../public/sitemap.xml) vs [public/robots.txt](../public/robots.txt) | `@astrojs/sitemap` is a configured integration, so Astro auto-generates a real sitemap (`sitemap-index.xml` / `sitemap-0.xml`) covering every actual page at build time. But `public/sitemap.xml` is a separate, hand-written, stale file that lists only 6 URLs (missing `/about`, `/how-it-works`, `/methodology`, `/contact`, `/blog`, and all 5 content-collection posts), and `robots.txt` points crawlers at that stale hand-written file instead of the auto-generated one. | Delete the stale `public/sitemap.xml` and point `robots.txt` at the integration's generated `sitemap-index.xml`, so the sitemap actually reflects the site's real pages. Verify by inspecting `dist/` after build. |

## G. Risk noted, not changed (needs your input, not a guess)

| # | Item | Why I'm not fixing it silently |
|---|---|---|
| G1 | [contact.astro:25](../src/pages/contact.astro#L25) — contact emails are `support@gridpermit.com` / `privacy@gridpermit.com`, but the site's actual domain everywhere else (`astro.config.mjs`, `robots.txt`, GA) is `mygridpermit.com`. I can't tell from the repo whether `gridpermit.com` mail is actually live, so I'm not changing it — but if that inbox doesn't exist, these are silently broken contact addresses on a legal/privacy page. Please confirm which domain actually receives mail. |

---

## Summary count

- **17** unsupported-claim / false-capability items (Section A)
- **2** component-level branding items affecting 5 published pages (Section B)
- **3** broken placeholder commercial links + 1 flagged-but-unchanged (Section C)
- **1** corrupted content file (Section D)
- **4** blog files with unverified specific statistics, disclosure-only fix proposed (Section E)
- **1** sitemap/robots inconsistency (Section F)
- **1** open risk requiring your input (Section G)

Proceeding to implement corrections for A, B, C1–C3, D, E, and F now. C4 and G1 are left for your decision.
