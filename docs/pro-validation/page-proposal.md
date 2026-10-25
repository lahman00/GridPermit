# Proposal: `/pro/` and `/for-installers/` pages for the pilot (preview only)

Nothing here is applied. No page file was edited.

## Current state (read 2026-10-24)
- `/pro/`: says the product does not exist, shows $29/mo as a hypothesis, one mailto button that fires `pro_interest_clicked`.
- `/for-installers/`: positions GridPermit as an exception-research layer for jobs that leave the normal permit path; shows no price; the built HTML has no pilot form (its only field is the site search box). The strategy brief's mention of a 3-field pilot form does not match the current build.

## Proposal
1. Keep the honesty banner on `/pro/`. Replace the single notify-me button with two lines of text: the pilot in plain terms (three sourced permit briefs for upcoming jobs, prepaid, full refund) and one mailto link that fires the same `pro_interest_clicked` event. Do not add a payment form, new lead form or new event.
2. Keep the $29/mo line only if the owner wants to keep testing it; otherwise remove the number until the pilot gives evidence.
3. On `/for-installers/`, add one sentence linking to `/pro/` for installers who do battery work. Do not add a form.
4. Measurement: the existing `pro_interest_clicked` event is the only signal; pilot payments are counted by hand, outside the site.

Approval needed before any edit: offer text, price wording, and whether to publish at all before the validation gate.
