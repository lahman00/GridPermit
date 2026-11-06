# Bakersfield application routing: evidence and scope

Reviewed 2026-11-06. This change improves one existing guide and its sitemap modification date. It does not claim an improvement in Google rankings or traffic.

## Verified official sources

- https://www.bakersfieldcity.us/online-permit-application-and-status
  - Read in an interactive browser after the City page finished rendering. It directs applicants to Clariti and instructs residential solar applicants to create a Clariti customer account before accessing Symbium. The embedded Symbium widget lists rooftop solar or battery storage. The City also provides instructions for Clariti applications and inspections.
  - A text-only web reader returned an incomplete navigation shell. That response was not used to infer the page's instructions.
- https://bakeweb.ci.bakersfield.ca.us/Click2GovBP/selectpermit.html
  - Public read-only GET returned 200 and exposed search fields for application number, address, parcel number and name. No search was submitted and no personal permit record was opened. Existence of this search is not proof that all current applications are held there.
- https://www.bakersfieldcity.us/building-division
  - Read in the browser. The Division links to the current application/status page and publishes a contact route. Readers are directed here when they cannot locate an existing application.

## Deliberate limits

Older Development Center material still refers to ProjectDox and Click2Gov. It was not treated as an instruction that every solar application must use those tools. No new fee, eligibility, turnaround time, instant-approval guarantee or inspection outcome is asserted. Existing locality data and its last_verified field remain unchanged. The new section explicitly distinguishes its link-check date from the older PV Toolkit facts.

## Technical boundary

- Render the new navigation section only for ca-kern-bakersfield-pge.
- Preserve the existing URL, title, description, canonical and structured data.
- Link to the existing free Permit Path checker, with the existing internal_resource_clicked convention.
- Record the actual significant content edit date in data/locality-content-updates.json. The sitemap accepts this date only for an already published locality guide and never replaces a newer source date with an older edit date. Do not update all sitemap dates on build.
- Preserve commercial routes, prices, qualification, disclosures, attribution, functions and schedules.

Sitemap rationale: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
Contextual-link rationale: https://developers.google.com/search/docs/crawling-indexing/links-crawlable

Private Search Console exports and account observations stay outside the public repository. No indexing request, sitemap submission, outreach or spending is part of this change. Recheck crawl evidence and comparable complete reporting windows after release; a build and HTTP 200 do not establish a new Google crawl or a ranking gain.
