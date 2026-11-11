# Traffic growth pass, 2026-11-11

Status: draft PR on production `2e3ae4f`. Not merged or deployed without explicit owner approval.

## Why
The owner's private search exports (kept outside this repository) show the same picture as the 2026-11-06 diagnosis: impressions are spread thinly across hundreds of city guides, most city guides share one generic search description, and few other sites link to GridPermit yet. This PR sharpens the search snippets of guides that are not under measurement, with a holdout so the effect can be measured.

## What changes
Fact-bearing meta descriptions (`src/lib/guide-snippet.ts`, readers in `src/lib/record-facts.ts`). For an eligible guide, the description names only what that guide's own record supports:
- the sourced permit office (or "official city permit link" when the office name is too long);
- a SolarAPP+, Symbium or other automated path, only when the record's pathway field names it with eligibility confidence of at least 0.6;
- "published fees" only when a confident, sourced city permit or utility interconnection fee amount is on file (SolarAPP+/Symbium platform fees do not count);
- "document checklist" and "inspection steps" only when those fields are populated and sourced;
- the interconnection utility when it is unambiguous (split territories say "utility interconnection"), with readable short names;
- the month the record was last checked.
It never exceeds 160 characters and falls back to the existing sentence. Titles, bodies, records and structured data are unchanged.

## Who keeps the old description
- Every guide inside a measurement or observation window: commercial SEO profiles, quick-answer pilots, reviewed pathway records, content-link rollout pages, the Santa Clara balanced slice and its Riverside control pages, and the three lead-sprint guides (50 guides).
- A pre-registered holdout: one in four of the remaining guides, chosen by a stable FNV-1a hash of the record id (`isSnippetHoldout`).
- Records that cannot support the sentence (for example a statewide record).

## Pre-registered measurement (decide before looking at "after")
- Treatment: eligible guides with the new description. Control: the hash holdout (same eligibility, old description). The 50 window-locked guides are excluded from both groups.
- Windows: 28 days ending the day before deploy versus 28 days starting 7 days after deploy (recrawl allowance); US web search; authenticated final-state Search Console page exports.
- Metric: difference-in-differences of clicks / impressions per group, with each page's CTR adjusted to the site's pooled CTR for its position bucket (`scripts/lib/search-opportunities.mjs`), plus raw clicks per group.
- Decision: keep if the treatment's adjusted CTR change exceeds the control's by at least 20% relative and clicks do not fall; revert if it trails the control by 20% or more; otherwise INCONCLUSIVE and extend one more 28-day window. Under 500 impressions in either group or window: INSUFFICIENT_DATA.
- Owner action after the windows close: export the two page-level windows; the comparison can be computed from those exports outside the repository.

## Held for a separate change
A California permit data page with a CSV download was prepared on branch `claude/permit-data-20261112`. An independent review found it not ready to publish: the automated-path count reads only the pathway field while some records state SolarAPP+/Symbium elsewhere, platform fees were counted as city fees, split utilities were shown as single utilities, and some fee entries need a data check. It needs a record-consistency and fee pass (ideally reconciled with the CEC residential solar permitting dashboard) and an owner decision on reuse terms before it can ship or be pitched.

## Rollback
Revert the PR, or make `buildFactDescription` return `null` (every guide then uses the old sentence).
