# Organic Growth Engine 2.0

Status: first vertical slice, pending owner approval. Nothing here is pushed, merged or deployed.

## Why
Evidence from the baseline build: the PTO / interconnection articles (`/blog/pge-no-pto-installer-closed/`,
`/blog/pge-zero-export-solar-battery-interconnection/`, `/blog/sce-add-battery-existing-solar/`) were linked from no
locality guide and no utility hub. `relatedPostsForUtility` matches a post's category to the utility short name, and these
posts are categorised "Permitting & PTO", so they could never match. The same private Search Console export shows demand for
these topics. The slice links them from the pages whose own facts match, and links back.

## What it does
- `data/content-links/registry.json` is the single declarative source of every relationship. Each resource declares a
  scope (state, utility, city, or a record flag) and an evidence note. `rollout` lists the only pages that render links.
- `src/lib/content-links.ts` is a pure, deterministic selector. A resource shows only if the page's own facts satisfy its scope.
  Ranking is city > utility > record topic > general, then id. Maximum 3 links per locality page. The article's own title is the
  anchor (site-name suffix removed). Reason lines come from a fixed table. A missing article drops the link instead of
  rendering a dead one. A link already on the page is never repeated.
- Rendering: inside the existing "Permit & inspection" and "Interconnection & PTO" cards of rolled-out locality guides
  (`ContentLinkList.astro`), a "PG&E / SCE interconnection and PTO guides" section on the two utility hubs, and a
  "Where this applies" panel at the end of the four rolled-out articles. The CTA, partner slot and all existing sections are
  unchanged in position.
- Analytics: one new closed-list event, `internal_resource_clicked` (stage ORGANIC_SESSION, no params, not partner-reportable).

## Slice
10 locality guides (PG&E: San Mateo, Santa Cruz, Livermore, Mountain View, Vallejo, Los Gatos; SCE: Visalia, Moorpark, Irvine,
Ventura), hubs `pg-e` and `sce`, and four articles. Excluded by test: every quick-answer pilot, commercial SEO profile and
reviewed permit-pathway record.

## Extend
1. Add a resource to the registry with scope and evidence. `tests/content-links.test.mjs` checks that a utility-scoped
   article's title and body name that utility.
2. Add the page URL to `rollout` (cap `max_locality_pages`). Never add a pilot or experiment page.
3. `node scripts/organic-engine-qa.mjs compare` must pass.

## QA
```
npm test && npm run astro -- check && npm run build && npm run seo-check
node --experimental-strip-types scripts/partner-health.mjs --out <private dir> && node scripts/release-preservation-check.mjs
node scripts/organic-engine-qa.mjs snapshot dist <head.json>        # also on the base commit's dist -> <base.json>
node scripts/organic-engine-qa.mjs compare <base.json> <head.json>
```
`compare` fails unless canonical, robots, title, JSON-LD, sitemap and partner/outbound links are byte-identical on every page,
all differences are additive internal links on rollout pages, targets are built, indexable and in the sitemap, and each rollout
page really changed. Revert the build-mutated `data/commercial/destination-health.json` and `output/site-inventory.json`
before committing.

## Distribution preparation (no posting)
`node scripts/build-distribution-queue.mjs --snapshot <head.json> --out <dir> --today YYYY-MM-DD` reads
`data/distribution/candidates.json` and the topic ledger, re-validates each draft (page built, indexable and in the sitemap;
every claim has a source with a check date no older than 7 days and an evidence date no older than 180 days; exact UTM URL;
duplicate topic or near-duplicate text; length, hashtags, hype and commercial language), and writes a human-review queue.
Every item is `DRAFT_ONLY`, `owner_approval_required`, `publish_allowed:false`. The tool never opens a network connection or an account.

## Measurement
`node scripts/build-organic-report.mjs --base <base.json> --head <head.json> --out <dir> [--metrics-before f --metrics-after f]`.
The link-graph section is measured from the built site. Behaviour needs private aggregate exports (kept outside the repo);
a metric not exported is UNKNOWN, never 0. Funnel stages (session, internal navigation, partner outbound) stay separate;
leads, installs, commission and cash are never inferred from clicks. Under 100 entrances per group or period gives INSUFFICIENT_DATA.

## Rollback
Everything is additive. Revert the PR, or empty `rollout.locality_pages`, `rollout.utility_hubs` and `rollout.articles` in the
registry to turn every link off without touching code.

## Expected impact (hypotheses, not guarantees)
More internal paths from location pages to PTO guides may raise engagement and the share of visitors who reach the PTO answer
they came for; more inbound internal links may help those articles be crawled and understood in context. Neither is measured yet.
