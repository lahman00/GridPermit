# Inquiry page usage (2026-11-25)

Uses the existing GA4 property G-PGX9SJ9QLG; no extra provider, storage or cost.

Page-scoped approved events (in partner-inquiry.astro) intentionally do not extend the shared analytics module: changing that module would rebuild frozen measurement pages' assets. Existing events and observation definitions stay unchanged.

| Event | Meaning | Parameters |
| --- | --- | --- |
| inquiry_page_viewed | Once per document load of /partner-inquiry/ | Fixed canonical page_location |
| inquiry_email_clicked | Native activation of either email link, including keyboard | Fixed canonical page_location; inquiry_action=compose or address |

Existing automatic page_view remains once as before; the custom view event is a separate event, not a second page_view. No input, email body, mailto URL or contact data is added to these custom events. Native navigation is never intercepted or delayed. Previews do not emit. No-JS/ad-blocked visits may be absent, as with existing analytics. Back-forward cache restoration is not counted as a new document view. Multiple clicks count separately.

## Read usage in the existing GA4 property

Reports > Engagement > Events: compare Event count for inquiry_page_viewed and inquiry_email_clicked over the same completed dates. Use Total users for each to distinguish people from repeated views/clicks. In an Exploration, use a closed two-step funnel with these two event names, order view then click, within the same session. Its user completion rate answers how many measured visitors clicked; raw click-count/view-count is an interaction ratio and can exceed 100%. Filter Country=United States separately if evaluating the target market. No custom dimension registration is necessary for the two totals. The optional inquiry_action parameter is inspectable in DebugView; no account settings changed here.

A click does not prove an email app opened, a draft exists, an email was sent, or a lead/revenue resulted. Report actual inbox inquiries separately. Do not mark this event as generate_lead/purchase or treat it as a sale.

QA must block Google Analytics collection before loading the page, inspect queued calls/network payloads locally, and cancel native mailto navigation. Never send an inquiry or synthesize genuine production analytics events. Standard report processing can lag; no historical click counts can be backfilled from this release.

Reference: https://developers.google.com/analytics/devguides/collection/ga4/events
