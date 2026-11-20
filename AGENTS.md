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

Before any production-bound push, read `https://mygridpermit.com/gridpermit-release.json` and the exact hosting project's production deployment. Reconcile the public domain, live source commit and provider before using a local or GitHub main checkout. Do not overwrite unrelated dirty worktrees.

The Vercel production target is team `lahman001` (`team_H3WXTdYUtyb1PHly4EZJQVeT`), project `gridpermit-migration` (`prj_yqFniKhSom1J5qBlIMSWjVZFojxz`). Its production branch is `main`. Confirm its deployment is READY, its source commit matches the release metadata, and public HTTPS/DNS and `/telemetry/health` verify the intended provider. A green CI run alone does not prove correct production identity.

Netlify site `d49c19aa-f997-43f3-9b11-fabff36c4c83` is the migration rollback target. Keep its historical attribution data and unrelated account sites intact. Never deploy there as the primary production target merely because an older script hardcodes the site ID. During a rollback, verify the actual public release before proceeding.

Run tests, typecheck, build/release-preservation, SEO and partner-health gates. Verify the approved commercial manifest, actual function behavior, authenticated retention schedule, durable storage health and unchanged page/measurement contracts. Preview deployments must reject real referrals. Never generate accepted affiliate requests for QA.

City coverage confirmation is separate from a canonical locality record, an unambiguous utility, an approved intent and a published route. Do not override any gate based on the legacy city allowlist. Keep private search metrics, outbound receipts and partner outreach logs outside the public repository. A URL-only regression fixture is sufficient for route-preservation tests.
