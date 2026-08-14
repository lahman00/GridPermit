# GridPermit

An Astro static site: an independent educational resource publishing source-linked, confidence-scored residential solar permitting guides for cities across all 50 U.S. states, plus a California-only solar & battery savings estimator. Deployed to Netlify at [mygridpermit.com](https://mygridpermit.com).

The core product is the locality guide dataset (`data/localities/`) — one verified record per city/utility pair, each fact traced to an official government or utility source with a confidence score and last-verified date. The homepage calculator (California ZIP codes only) is a separate, smaller tool; see [docs/DATA_ARCHITECTURE.md](docs/DATA_ARCHITECTURE.md) Section 6 for why it doesn't yet consume locality data.

## Project structure

```
src/pages/                          top-level pages (index, about, methodology, how-it-works, contact, privacy, terms, pro, 404)
src/pages/blog/                     California-focused rate/battery blog posts
src/pages/[state]/                  per-state guide index (dynamic route, all 50 states)
src/pages/<state-slug>/<city-slug>/ generated locality guide pages (e.g. src/pages/texas/austin/)
src/pages/california/county/        California county discovery hub pages (dynamic route)
src/pages/california/utility/       California utility discovery hub pages (dynamic route)
src/layouts/LocalityGuideLayout.astro   shared layout every locality guide page renders through
src/components/InstallerCTA.astro   the one monetization surface: a plain, disclosed EnergySage referral link on every locality page
src/lib/locality-guide.ts           data-shaping helpers behind the locality layout (trust rules, schema builders, etc.)
src/lib/state-meta.ts               canonical registry of every represented state (code, name, slug)
src/lib/analytics-events.ts         the approved GA4 event allowlist — every conversion event must be listed here
data/schema.json                    JSON Schema for a locality record
data/localities/                    verified locality records, one per city/utility pair, across all 50 states
scripts/                            collection, validation, evaluation, and page-generation CLIs (see below)
docs/                               architecture, process, and strategy documentation
output/                             generated reports (validation reports, batch evaluations, site inventory, coverage reports)
tests/                              node:test suites for scripts/ and src/lib/
```

## Key docs

- [docs/DATA_ARCHITECTURE.md](docs/DATA_ARCHITECTURE.md) — the locality record schema and its rules (confidence scoring, null-vs-empty-array semantics, "coverage is binary, not blended").
- [docs/PILOT_EVALUATION.md](docs/PILOT_EVALUATION.md) — the decision report for the original 5-city pilot and what's safe to show publicly (the readiness framework it defines — READY / LIMITED / NOT_READY — is still how every state's records are classified today).
- [docs/LOCALITY_PAGE_FACTORY.md](docs/LOCALITY_PAGE_FACTORY.md) — how `scripts/generate-locality-pages.mjs` turns a `READY` locality record into a public page.
- [docs/MONETIZATION_STRATEGY.md](docs/MONETIZATION_STRATEGY.md) — the current monetization model, target customer, and what's deliberately not built yet.

## Commands

| Command | Action |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start the local dev server at `localhost:4321` |
| `npm run build` | Build the production site to `./dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run the `node:test` suite (`tests/*.test.mjs`) |
| `npm run seo-check` | Run `scripts/site-inventory.mjs --check` — sitemap/canonical/redirect/thin-page defects |
| `node scripts/validate-record.mjs <path-to-locality.json>` | Validate one locality record against `data/schema.json` |
| `node scripts/evaluate-state-batch.mjs <STATE_CODE> --all-in-state` | Re-classify every locality record for a state as READY / LIMITED / NOT_READY |
| `node scripts/generate-locality-pages.mjs --dry-run` | Preview which locality pages would be generated/skipped |

## Working principles

- Every fact shown on a locality page comes from its JSON record, with a confidence score and source link — never hardcoded, never inferred.
- A city only gets a public page once its record's readiness is `READY`. Never invent, guess, or infer a regulatory fact to push a record to READY — `LIMITED` is a legitimate, honest outcome.
- Adding a new state requires registering it identically in four places: `src/lib/state-meta.ts`, `scripts/evaluate-state-batch.mjs`, `scripts/generate-locality-pages.mjs`, and `tests/all-batches-published.test.mjs`.
- The homepage calculator intentionally does not yet consume locality data and covers California only — see `docs/DATA_ARCHITECTURE.md` Section 6.
