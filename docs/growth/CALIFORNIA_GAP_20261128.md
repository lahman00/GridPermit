# California gap batch (2026-11-28)

Goal: add audited guides for California cities on the CEC permitting-status list that had no published guide (185 cities). Same evidence standard as the Colorado batches: official sources only, raw captures on the owner's computer (two rounds, links harvested from round-1 pages), OCR for scanned PDFs checked against page images, machine-checked quotes, sentence trace with 0 blocking entries, independent audit that fails any derived value, capture attestations with SHA-256 re-checked.

## What limits California yield
- The PG&E, SCE and SDG&E websites refuse access from the capture location (HTTP 403 / Akamai "Access Denied"; SCE also an Imperva bot challenge). They are not worked around. Utility program facts come instead from statewide CPUC and SGIP Program Administrator pages (`cpuc.ca.gov`, `selfgenca.com`), cited with wording tied to the reader's utility.
- Which utility serves a city must come from that city's own official page; many small cities publish none.
- Capture tool fix (2026-11-28): later capture rounds no longer re-request sources that already failed twice.

## Wave 1: Claremont and Bell Gardens
| Guide | Record | Fields after audit |
|---|---|---|
| `/california/claremont/solar-permit-guide/` | `ca-los-angeles-claremont-sce` | 13 of 15 |
| `/california/bell-gardens/solar-permit-guide/` | `ca-los-angeles-bell-gardens-sce` | 12 of 15 |

- Audit: Claremont 95 pass / 22 edits / 3 fails; Bell Gardens 116 pass / 6 edits / 7 fails (failed sentences removed). SGIP uses the site's 2026 summary label, with description, eligibility and notes rewritten to what the 2026 SGIP Handbook and the Program Metrics page (captured 2026-11-28) say; the per-kWh restatement is null.
- Both ids are in `NEW_GUIDES_DURING_MEASUREMENT` and the batch 5 set, so no existing guide's related list changes.
- Build diff against live 11c6091: added only the two guides and their Permit Path records; changed only the California index, the California data and timeline pages (two new rows), the guide directory, `/permits/`, Permit Path, search, the sitemap and the release file. 86-route manifest byte-identical; release-preservation output identical.
- Statewide partner coverage tests now count 336 California cities (334 + 2).
- Held after audit: Isleton (fee file is a 2020 "Proposed" schedule), Hidden Hills (only a 2015 solar fee bulletin). DO NOT BUILD reasons for every other city are in `01-Command-Center/research/california-gap-20261128/cities/<city>/EVIDENCE_GATE.md`.
