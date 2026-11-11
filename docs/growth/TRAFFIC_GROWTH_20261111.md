# Traffic growth pass, 2026-11-11

Status: branch `claude/traffic-growth-20261111` on production `2e3ae4f`. Not merged or deployed without explicit owner approval.

## Why
Private Search Console and GA4 exports (kept outside this repository) show the same picture as the 2026-11-06 diagnosis: impressions are spread thinly across hundreds of city guides, most city guides share one generic search description, and Search Console reports no external links. On-site copy alone cannot fix the missing links, so this pass adds one citable asset and sharpens the snippets of guides that are not under measurement.

## What changes
1. **California permit data page** (`/california/solar-permit-data/`) and **CSV** (`/california/solar-permit-data.csv`). One row per published California guide: permit office, recorded automated path (SolarAPP+, Symbium or another platform, using the same rule as the Permit Path checker), interconnection utility, published fee amounts (fee field confidence at least 0.7, sourced, numeric), last-verified date, guide link and official permit page. Counts are computed at build time from the same rows. Dataset JSON-LD (for Google Dataset Search), CC BY 4.0 reuse terms, a citation line, filters that work without a page reload, and a closed-list `permit_data_downloaded` event. The CSV gets `X-Robots-Tag: noindex` and a download filename; the page is the one to index.
2. **Fact-bearing search descriptions** for guides outside every measurement window (`src/lib/guide-snippet.ts`). The sentence names the sourced permit office, a recorded SolarAPP+/Symbium/automated path, whether published fees are on file, the interconnection utility when it is unambiguous, and the month the record was checked. It never states a fact the record does not, never exceeds 160 characters, and falls back to the old sentence when the record cannot support it. Titles are unchanged.
3. **Internal links** to the data page from the homepage "Start locally" list, the California hub, the California guides index and the timeline page.

## What does not change
Titles, canonicals, robots, JSON-LD on existing pages, page bodies of city guides, partner routes and disclosures, prices, checkout, refund wording, records and their dates. Every guide inside a measurement or observation window keeps its page byte-identical: commercial SEO profiles, quick-answer pilots, reviewed pathway records, content-link rollout pages, the Santa Clara balanced slice and its Riverside control pages, and the three lead-sprint guides (50 guides in the 2026-11-11 build).

## Verification (local, against the production base)
- Differential build with the same synthetic health input for base and branch: 2 new files (page, CSV); 301 guides differ only in their three description tags; 3 hubs and the homepage differ only by the new link; every held guide is byte-identical; sitemap adds only the new URL. Outbound manifest unchanged (86 routes, SHA-256 `29c025df824a4a0fef6439c162e4b09ec272587ececb683405f6591e21b3f9e3`); release preservation OK.
- `npm test`, `astro check`, `npm run seo-check`; axe WCAG 2.2 AA on the new page, homepage, California hub, guides index and one changed guide (desktop and mobile, light and dark): 0 violations; no horizontal page overflow at 390/834/1440; filters and CSV checked in a headless browser.

## Pre-registered measurement (decide before looking at "after")
- **Snippets.** Treatment: the guides whose description changed. Comparison: the held guides. Windows: 28 days ending the day before deploy versus 28 days starting 7 days after deploy (recrawl allowance), US web search, from authenticated final-state Search Console exports. Metric: CTR and clicks per group. Under 500 impressions in either group or window: INSUFFICIENT_DATA. Keep if treatment CTR rises by at least 30% relative while the comparison group does not move the same way; revert if it falls by 30% or more. Not randomized, so a result is evidence, not proof.
- **Data page.** Leading indicators: referring domains in the Search Console links report, Google Dataset Search listing, `permit_data_downloaded` events, impressions for SolarAPP+/Symbium/permit-data queries. Links are expected only if the owner approves the prepared outreach; none was sent.

## Rollback
Revert the PR. To turn off only the descriptions, return `null` from `buildFactDescription` (every guide then uses the old sentence); to drop the data page, delete the two route files and the links.
