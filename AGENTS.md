## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)


## Production release integrity

Before any production-bound push, read `https://mygridpermit.com/gridpermit-release.json` and the exact Netlify site's published deployment. GitHub main or a local main checkout may be older than the deployed source; a documentation-only commit can still trigger a full automatic deployment. Reconcile the verified production source first. Do not overwrite unrelated dirty worktrees.

The canonical production site ID is `d49c19aa-f997-43f3-9b11-fabff36c4c83`; a CLI default project is not evidence of the correct target. Run tests, typecheck, build/release-preservation and partner-health gates, then independently verify the deployed commit, functions and route contracts. A green CI run alone does not prove correct production identity.

City coverage confirmation is separate from a canonical locality record, an unambiguous utility, an approved intent and a published route. Do not override any gate based on the legacy city allowlist. Keep private search metrics, outbound receipts and partner outreach logs outside the public repository. A URL-only regression fixture is sufficient for route-preservation tests.
