# GridPermit

An Astro static site: an independent, California-only educational resource for residential solar and battery permitting and savings estimates. Deployed to Netlify at [mygridpermit.com](https://mygridpermit.com).

## Project structure

```
src/pages/                          top-level pages (index, about, methodology, how-it-works, contact, privacy, terms)
src/pages/blog/                     blog posts
src/pages/california/               locality guide pages + the guide index
src/layouts/LocalityGuideLayout.astro   shared layout every locality guide page renders through
src/lib/locality-guide.ts           data-shaping helpers behind the locality layout (trust rules, schema builders, etc.)
data/schema.json                    JSON Schema for a locality record
data/localities/                    verified locality records (one per city/utility pair)
data/pilot-targets.json             the original 5-city pilot batch definition
data/next-batch-targets.json        the next proposed batch (not yet collected)
scripts/                            collection, validation, evaluation, and page-generation CLIs (see below)
docs/                               architecture and process documentation
output/                             generated reports (validation reports, pilot evaluation, rendered summaries)
tests/                              node:test suites for scripts/ and src/lib/
```

## Key docs

- [docs/DATA_ARCHITECTURE.md](docs/DATA_ARCHITECTURE.md) — the locality record schema and its rules (confidence scoring, null-vs-empty-array semantics, "coverage is binary, not blended").
- [docs/PILOT_EVALUATION.md](docs/PILOT_EVALUATION.md) — the decision report for the first 5-city pilot and what's safe to show publicly.
- [docs/LOCALITY_PAGE_FACTORY.md](docs/LOCALITY_PAGE_FACTORY.md) — how `scripts/generate-locality-pages.mjs` turns a `READY` locality record into a public page.
- [docs/PILOT_RUNBOOK.md](docs/PILOT_RUNBOOK.md) — the operating procedure for `scripts/collect-pilot.mjs`, including the target-validity guard.
- [docs/NEXT_BATCH_PLAN.md](docs/NEXT_BATCH_PLAN.md) — the next proposed collection batch and why each target was chosen.

## Commands

| Command | Action |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start the local dev server at `localhost:4321` |
| `npm run build` | Build the production site to `./dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run the `node:test` suite (`tests/*.test.mjs`) |
| `node scripts/collect-pilot.mjs --dry-run` | Preview what a collection run would do, without writing anything |
| `node scripts/evaluate-pilot.mjs` | Regenerate `output/pilot-evaluation.json` from the current locality records |
| `node scripts/generate-locality-pages.mjs --dry-run` | Preview which locality pages would be generated/skipped |
| `node scripts/validate-record.mjs <path-to-locality.json>` | Validate one locality record against `data/schema.json` |

## Working principles

- Every fact shown on a locality page comes from its JSON record, with a confidence score and source link — never hardcoded, never inferred.
- A city only gets a public page once its record's readiness is `READY` (see `output/pilot-evaluation.json` and `docs/PILOT_EVALUATION.md`).
- The homepage calculator intentionally does not yet consume locality data — see `docs/DATA_ARCHITECTURE.md` Section 6.
