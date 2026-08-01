# Locality Page Factory

`scripts/generate-locality-pages.mjs` turns a `READY` locality JSON record in
[data/localities/](../data/localities/) into a thin Astro page wrapper around
[src/layouts/LocalityGuideLayout.astro](../src/layouts/LocalityGuideLayout.astro)
— the same reusable layout Oakland's hand-written page
([src/pages/california/oakland/solar-permit-guide.astro](../src/pages/california/oakland/solar-permit-guide.astro))
already uses. It never writes a locality fact into the generated file itself;
every fact still flows from the JSON record at Astro build time. See
[LOCALITY_GUIDE_TEMPLATE hardening](../src/lib/locality-guide.ts) for the
data-shaping rules the layout enforces (trust rules, missing-value handling,
etc.) — this generator only decides *which* records get a page and *where*.

## Inputs

1. **`data/localities/*.json`** — every locality record on disk.
2. **`output/pilot-evaluation.json`** — specifically each record's
   `readiness` field (`READY` / `LIMITED` / `NOT_READY`), produced by
   `node scripts/evaluate-pilot.mjs`. Only `readiness === "READY"` records are
   eligible for a generated page. See
   [PILOT_EVALUATION.md](PILOT_EVALUATION.md) for what readiness means and how
   it's computed.

A record's city slug (used for both the route and its output directory) is
derived from `record.city.value` using the same slugify algorithm as
`scripts/collect-pilot.mjs` (lowercase, diacritics stripped, non-alphanumeric
runs collapsed to a single hyphen) — not read from `data/pilot-targets.json`,
so this generator has no dependency on the pilot-collection pipeline.

## Output

For a `READY` record with city slug `<city-slug>`, the generator writes:

```
src/pages/california/<city-slug>/solar-permit-guide.astro
```

The generated file is always this shape (nothing else):

```astro
---
// This page consumes data/localities/<record_id>.json directly at build
// time via LocalityGuideLayout — no locality fact is hardcoded here. ...
import LocalityGuideLayout from "../../../layouts/LocalityGuideLayout.astro";
import record from "../../../../data/localities/<record_id>.json";

const PAGE_PATH = "/california/<city-slug>/solar-permit-guide/";
const CITY_PATH = "/california/<city-slug>/";
---

<LocalityGuideLayout record={record} pagePath={PAGE_PATH} cityPath={CITY_PATH} />
```

Both import paths are computed from actual file locations (`path.relative`),
not from a hardcoded directory-depth assumption — so the generator keeps
working if the pages/layout/localities directories are ever reorganized.

## Usage

```bash
node scripts/generate-locality-pages.mjs                 # same as --dry-run
node scripts/generate-locality-pages.mjs --dry-run        # print the plan, write nothing
node scripts/generate-locality-pages.mjs --write           # generate eligible pages for real
node scripts/generate-locality-pages.mjs --write --force <record_id>   # regenerate exactly one existing page
```

- **No flags, or `--dry-run`**: prints, for every locality record, its
  readiness, its target page file, whether that file already exists, and the
  planned outcome. Writes nothing, ever.
- **`--write`**: performs the plan. A record is generated only if its
  readiness is `READY` **and** (its page doesn't exist yet, **or** `--force`
  names that exact `record_id`).
- **`--force <record_id>`**: the *only* way to overwrite an existing page, and
  only for that one record — every other existing page in the same run is
  always left untouched. `--force` does **not** bypass the readiness gate: a
  `LIMITED`/`NOT_READY` record is never generated, forced or not.
- An unrecognized `--force <record_id>` (one that matches no locality record
  on disk) is a **CONFIG_ERROR**: exits 1 under `--write`, or prints a
  warning and exits 0 under `--dry-run` (consistent with
  `scripts/collect-pilot.mjs`'s own `--force` convention).
- `--force` with no following value (or one that looks like another flag) is
  a usage error, exit 1 — there is no "force everything" mode.

## Test isolation

Four environment variables let tests point the generator at fixture
directories instead of the real repo, mirroring
`scripts/collect-pilot.mjs`'s `PILOT_TARGETS_PATH` / `PILOT_RUNS_DIR`
pattern. Real usage never needs to set any of these:

- `LOCALITY_PAGES_LOCALITIES_DIR` (default `data/localities/`)
- `LOCALITY_PAGES_EVALUATION_PATH` (default `output/pilot-evaluation.json`)
- `LOCALITY_PAGES_OUTPUT_ROOT` (default `src/pages/california/`)
- `LOCALITY_PAGES_LAYOUT_PATH` (default `src/layouts/LocalityGuideLayout.astro`)

See `tests/generate-locality-pages.test.mjs`.

## First run (2026-08-01)

Applied against the 5-record pilot set:

| Record | Readiness | Outcome |
|---|---|---|
| `ca-alameda-fremont-pge` | READY | generated — `src/pages/california/fremont/solar-permit-guide.astro` |
| `ca-alameda-oakland-pge` | READY | **skipped** — page already existed (hand-written, predates this generator) |
| `ca-los-angeles-pasadena-pwp` | READY | generated — `src/pages/california/pasadena/solar-permit-guide.astro` |
| `ca-san-diego-san-diego-sdge` | READY | generated — `src/pages/california/san-diego/solar-permit-guide.astro` |
| `ca-santa-clara-san-jose-pge` | LIMITED | **skipped** — not READY (predates the current schema shape; see PILOT_EVALUATION.md) |

## What this generator deliberately does not do

- It does not collect, research, or modify any locality data.
- It does not touch the homepage, the calculator, or any non-generated page.
- It does not regenerate an existing page without `--force` naming it
  specifically — hand-edits to a generated page (there shouldn't be any, but
  just in case) are never silently clobbered by a routine re-run.
- It does not decide readiness itself — it only reads the verdict already
  computed by `scripts/evaluate-pilot.mjs`.
