# GridPermit organic distribution: 30-day plan (2026-10-26 to 2026-11-20)

Status: **plan and drafts only. Nothing has been posted, scheduled, liked, followed or sent.** Written 2026-10-23 on branch `claude/sprint-distribution-20261023`. The publishing gate (`data/distribution/publishing-gate.json`) is fully disabled and unchanged. Machine-readable version: `data/distribution/queue-30day.json`. Draft texts: `data/distribution/candidates.json`.

## 1. Ledger audit

| Where | Topic | Channel | Status | Date |
|---|---|---|---|---|
| `posted-topics.json` | solarapp-eligibility | LinkedIn | published | 2026-10-10 |
| `posted-topics.json` | pomona-solarapp-permit | LinkedIn | published | 2026-10-10 |
| `posted-topics.json` | permit-path | LinkedIn | published | 2026-10-15 |
| `posted-topics.json` | permit-path | X | draft_not_published (do not publish) | 2026-10-15 |
| `candidates.json` | california-solarapp-fees | LinkedIn, X | drafted, unpublished | 2026-10-17 |
| 01-Command-Center pilot pack | Why solar permit steps vary by location | LinkedIn, Facebook | draft, not published | 2026-10-17 |
| 01-Command-Center 2026-10-11 pack | SolarAPP+ eligibility vs local acceptance; Sausalito comment | LinkedIn | prepared, not confirmed published | 2026-10-11 |

Findings:
- No duplicates inside the ledger. The ledger stores topics and dates only, so text-level duplicate checks against published posts are not possible; they are done at topic level plus a similarity check across the new drafts (highest same-channel similarity 0.20, limit 0.55).
- Topic overlap to avoid: city permit vs utility PTO in general (covered by the published `permit-path` post and the 2026-10-17 pilot draft) and SolarAPP+ eligibility (published 2026-10-10). The new topics are specific jurisdiction facts and a data-handling point, not those.
- The `california-solarapp-fees` candidate cites a DOE article for 'no cost to participating local governments'. The page is dated 2023-12-20 (over the 180-day limit) but the candidate records `evidence_date: null`, so the pipeline only warns. Its `date_checked` (2026-10-17) also stops passing the 7-day rule after 2026-10-24. The candidate is left untouched; see the two DRAFT_ONLY entries.
- Replies: none drafted. LinkedIn and X threads cannot be read without a signed-in session, so `discussions.json` stays empty.

## 2. Rules applied
- Max 3 posts per channel per week; same topic on the other channel at least 6 days later.
- Claim sources re-opened on 2026-10-23 (`date_checked`); claims older than 7 days must be re-checked before posting, and evidence older than 180 days blocks.
- Exactly one URL per post, the exact UTM URL. No hashtags, no long dashes, no hype or commercial language, no claim about customers, results, partners, endorsements, leads or prices.
- Destination pages exist (HTTP 200 on mygridpermit.com and present in the local build and sitemap). City or county permit and utility interconnection or PTO are kept apart in every post.
- 'Developer agencies' is read as solar project developers and the agencies or software teams that build permitting and interconnection workflows for them. This is an assumption.
- Editorial pass: ben-adam English engine, register M for X and E for LinkedIn, no long dashes, no invented facts.

## 3. Calendar

| ID | Week | Date | Channel | Audience | Topic | Status |
|---|---|---|---|---|---|---|
| Q01 | 1 | Mon 2026-10-26 | LinkedIn | US installers | clark-county-bd-pp-206 | READY_FOR_HUMAN_REVIEW |
| Q02 | 1 | Tue 2026-10-27 | X | US installers | honolulu-expedited-clean-energy | READY_FOR_HUMAN_REVIEW |
| Q03 | 1 | Thu 2026-10-29 | LinkedIn | permitting professionals | san-diego-self-issued-pv | READY_FOR_HUMAN_REVIEW |
| Q04 | 2 | Mon 2026-11-02 | X | developer agencies | kw-limit-ac-dc-basis | READY_FOR_HUMAN_REVIEW |
| Q05 | 2 | Wed 2026-11-04 | LinkedIn | permitting professionals | honolulu-expedited-clean-energy | READY_FOR_HUMAN_REVIEW |
| Q06 | 2 | Fri 2026-11-06 | X | US installers | san-diego-self-issued-pv | READY_FOR_HUMAN_REVIEW |
| Q07 | 3 | Tue 2026-11-10 | LinkedIn | US installers | california-solarapp-fees | DRAFT_ONLY |
| Q08 | 3 | Thu 2026-11-12 | X | developer agencies | not-yet-verified-fields | READY_FOR_HUMAN_REVIEW |
| Q09 | 3 | Fri 2026-11-13 | LinkedIn | developer agencies | kw-limit-ac-dc-basis | READY_FOR_HUMAN_REVIEW |
| Q10 | 4 | Tue 2026-11-17 | X | US installers | california-solarapp-fees | DRAFT_ONLY |
| Q11 | 4 | Wed 2026-11-18 | LinkedIn | permitting professionals | denver-solarapp-quick-permit-10kw | BLOCKED_NEEDS_SOURCE |
| Q12 | 4 | Thu 2026-11-19 | LinkedIn | developer agencies | not-yet-verified-fields | READY_FOR_HUMAN_REVIEW |
| Q13 | 4 | Fri 2026-11-20 | LinkedIn | US installers | nv-energy-application-and-no-energize | BLOCKED_NEEDS_SOURCE |

Weekly counts (week:channel): 1:linkedin=2, 1:x=1, 2:x=2, 2:linkedin=1, 3:linkedin=2, 3:x=1, 4:x=1, 4:linkedin=3. Cap is 3.

## 4. Entries

### Q01 LinkedIn, Mon 2026-10-26: clark-county-bd-pp-206

- Status: **READY_FOR_HUMAN_REVIEW**. Audience: US installers. Format: single post.
- Destination: https://mygridpermit.com/nevada/las-vegas/solar-permit-guide/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=clark_county_bd_pp_206_202610 (HTTP 200 on 2026-10-23)
- Value: Gives installers working in Clark County the two electrical size thresholds and the structural waiver criteria from the county's current written policy in one read.
- Duplicate check: topic in posted ledger for this channel: no; max same-channel similarity: 0.19 (with Q03); same topic elsewhere: none.
- Pipeline (2026-10-23): READY, no block issues.
- Evidence:
  - Clark County Building Department, policy BD-PP-206: https://www.clarkcountynv.gov/adobe/assets/urn:aaid:aem:4666c480-77e5-451b-8542-8358743548be/original/as/BD-PP-206-Solar-Photovoltaic-Requirements-FINAL-4.30.2026.pdf (checked 2026-10-23; evidence date 2026-04-30). Revised 04/30/2026; no electrical plan review for systems not exceeding 5 kW; engineer-designed plans at 25 kW DC or greater (new systems and additions); building official may waive full submittal and engineering for residential roof mounts meeting listed criteria (4 psf, parallel to roof, within 24 in., connection points max 48 in. on center). evidence_date 2026-04-30 is 176 days old on 2026-10-23; the pipeline's 180-day rule blocks these claims from 2026-10-28.
  - GridPermit Las Vegas guide (own page): https://mygridpermit.com/nevada/las-vegas/solar-permit-guide/ (checked 2026-10-23; evidence date 2026-08-13). Permit authority is the City of Las Vegas Department of Building & Safety; a local permit and utility permission to operate are different approvals.
- Notes: Must go out by 2026-10-27: from 2026-10-28 the pipeline blocks BD-PP-206 claims as older than 180 days unless a newer dated source is recorded. The policy covers Clark County Building Department permits; the linked guide is the City of Las Vegas, which the post says is a separate authority. GridPermit has no unincorporated Clark County guide.

Draft (exact text):

```
Clark County's solar PV policy, BD-PP-206, was revised on April 30, 2026. The electrical section is short.

No electrical plan review for systems that do not exceed 5 kW. Engineer-designed plans for new systems of 25 kW DC or greater, and for additions that bring the total to 25 kW DC or greater.

For residential roof mounts, the Building Official may waive the full submittal package and engineering if the system meets every structural criterion, including 4 psf or less and connection points no more than 48 inches apart.

A local permit and utility permission to operate are different approvals. The City of Las Vegas Department of Building & Safety handles permits inside the city, and our guide covers that one:

https://mygridpermit.com/nevada/las-vegas/solar-permit-guide/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=clark_county_bd_pp_206_202610
```

### Q02 X, Tue 2026-10-27: honolulu-expedited-clean-energy

- Status: **READY_FOR_HUMAN_REVIEW**. Audience: US installers. Format: single post.
- Destination: https://mygridpermit.com/hawaii/honolulu/solar-permit-guide/?utm_source=x&utm_medium=organic_social&utm_campaign=honolulu_expedited_clean_energy_202610 (HTTP 200 on 2026-10-23)
- Value: States the 20 kW limit, the townhome focus and the eligible project types of Honolulu's expedited clean energy permit in one line.
- Duplicate check: topic in posted ledger for this channel: no; max same-channel similarity: 0.09 (with Q06); same topic elsewhere: Q05 (linkedin, 2026-11-04).
- Pipeline (2026-10-23): READY, no block issues.
- Evidence:
  - City and County of Honolulu, Department of Planning and Permitting: clean energy expedited permit page: https://www.honolulu.gov/dpp/permitting/building-permits-home/building-permit/clean-energy/ (checked 2026-10-23; evidence date none shown on page). Eligible projects limited to 20KW systems; process applies to clean energy projects primarily at townhomes; eligible types solar PV, solar thermal or solar electric water heating, EV charging stations; four forms listed (checklist, filing instructions, affidavit, permit issuance notification). Page shows no update date (only a 2026 copyright). Page does not mention Hawaiian Electric.
  - GridPermit Honolulu guide (own page): https://mygridpermit.com/hawaii/honolulu/solar-permit-guide/ (checked 2026-10-23; evidence date 2026-08-13). A local permit and utility permission to operate are different approvals (HECO listed as interconnection and PTO authority).
- Notes: The Honolulu guide labels its 20 kW limit as DC; the DPP page says only '20KW'. The post does not state a basis. Fix the guide label or confirm it before posting.

Draft (exact text):

```
Honolulu's expedited clean energy permit is limited to 20 kW systems and aimed primarily at townhomes. Eligible types: solar PV, solar thermal or electric water heating, EV charging stations. The Hawaiian Electric step is a separate approval.

https://mygridpermit.com/hawaii/honolulu/solar-permit-guide/?utm_source=x&utm_medium=organic_social&utm_campaign=honolulu_expedited_clean_energy_202610
```

### Q03 LinkedIn, Thu 2026-10-29: san-diego-self-issued-pv

- Status: **READY_FOR_HUMAN_REVIEW**. Audience: permitting professionals. Format: single post.
- Destination: https://mygridpermit.com/california/san-diego/solar-permit-guide/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=san_diego_self_issued_pv_202610 (HTTP 200 on 2026-10-23)
- Value: Spells out the conditions of San Diego's self-issued, no-plan-review rooftop path (IB 301 template, 38.4 kW AC) and keeps SDG&E as a separate step.
- Duplicate check: topic in posted ledger for this channel: no; max same-channel similarity: 0.19 (with Q01); same topic elsewhere: Q06 (x, 2026-11-06).
- Pipeline (2026-10-23): READY, no block issues.
- Evidence:
  - City of San Diego Development Services Department: solar PV permit page: https://www.sandiego.gov/development-services/permits/solar-photovoltaic-permit (checked 2026-10-23; evidence date none shown on page). Residential rooftop PV permit 'self-issued with no plan review' for single-family, duplex or townhouse roofs designed per the template in Information Bulletin (IB) 301; system 'does not exceed more than 38.4 kW AC maximum output'; submitted electronically; 'previous requirement for professional certification is no longer required'. Page shows no update date (only a 2002-2026 copyright). Page does not mention SDG&E.
  - GridPermit San Diego guide (own page): https://mygridpermit.com/california/san-diego/solar-permit-guide/ (checked 2026-10-23; evidence date 2026-08-09). AC field 38.4 kW, DC field 'Not yet verified', Review time 'Not yet verified'; separate SDG&E interconnection and PTO authority.
- Notes: The destination guide shows a CompareSolarPrices paid-referral block lower on the page; the post itself has no commercial language.

Draft (exact text):

```
San Diego has a residential rooftop solar permit that is self-issued with no plan review, if the roof is designed per the template in Information Bulletin (IB) 301.

Per the city's page, the project is a single-family home, duplex or townhouse, and the system does not exceed 38.4 kW AC maximum output. It is submitted electronically. The page also says the previous requirement for professional certification is no longer required.

A local permit and utility permission to operate are different approvals. The SDG&E step is not part of the city permit. Our San Diego guide lists both:

https://mygridpermit.com/california/san-diego/solar-permit-guide/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=san_diego_self_issued_pv_202610
```

### Q04 X, Mon 2026-11-02: kw-limit-ac-dc-basis

- Status: **READY_FOR_HUMAN_REVIEW**. Audience: developer agencies. Format: single post.
- Destination: https://mygridpermit.com/partners/?utm_source=x&utm_medium=organic_social&utm_campaign=kw_limit_ac_dc_basis_202610 (HTTP 200 on 2026-10-23)
- Value: Shows two official pages stating size limits on different bases (DC vs AC), a concrete data-modelling detail for teams building permit-rules software or workflows.
- Duplicate check: topic in posted ledger for this channel: no; max same-channel similarity: 0.2 (with Q06); same topic elsewhere: Q09 (linkedin, 2026-11-13).
- Pipeline (2026-10-23): READY, no block issues.
- Evidence:
  - City and County of Denver, Community Planning and Development: Solar Permits (single-family and duplex): https://www.denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Community-Planning-and-Development/Plan-Review-Permits-and-Inspections/Single-Family-and-Duplex-Projects/Solar-Permits (checked 2026-10-23; evidence date none shown on page). SolarAPP+ quick-permit criterion 'kW DC rating of less than 10'; systems rated 10 kW and above need a Colorado-licensed professional engineer's stamp on the one-line diagram and calculations; 'All systems require an electrical permit'; AC/DC basis of the 10 kW engineering threshold not stated. Page shows no update date (only a 2026 copyright).
  - City of San Diego Development Services Department: solar PV permit page: https://www.sandiego.gov/development-services/permits/solar-photovoltaic-permit (checked 2026-10-23; evidence date none shown on page). Residential rooftop PV permit 'self-issued with no plan review' for single-family, duplex or townhouse roofs designed per the template in Information Bulletin (IB) 301; system 'does not exceed more than 38.4 kW AC maximum output'; submitted electronically; 'previous requirement for professional certification is no longer required'. Page shows no update date (only a 2002-2026 copyright). Page does not mention SDG&E.
- Notes: PRECONDITION: UPDATE 2026-10-23: the guide correction (no AC maximum, DC not stated) is committed on the integration branch but is NOT live; do not post until it is live. Before the correction, GridPermit's Denver guide showed 'Max system size (AC): 10 kW' and DC 'Not yet verified', which conflicts with Denver's page ('kW DC rating of less than 10'). Correct the guide before this post goes out. Destination is /partners/, which carries no Denver numbers.

Draft (exact text):

```
Denver's SolarAPP+ quick permit lists "kW DC rating of less than 10". San Diego's self-issued rooftop path caps systems at 38.4 kW AC. Same kind of limit, different basis, so one "max kW" field loses information.

https://mygridpermit.com/partners/?utm_source=x&utm_medium=organic_social&utm_campaign=kw_limit_ac_dc_basis_202610
```

### Q05 LinkedIn, Wed 2026-11-04: honolulu-expedited-clean-energy

- Status: **READY_FOR_HUMAN_REVIEW**. Audience: permitting professionals. Format: single post.
- Destination: https://mygridpermit.com/hawaii/honolulu/solar-permit-guide/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=honolulu_expedited_clean_energy_202610 (HTTP 200 on 2026-10-23)
- Value: Lists the eligible project types and the four forms on Honolulu's expedited clean energy page, with the HECO step kept separate.
- Duplicate check: topic in posted ledger for this channel: no; max same-channel similarity: 0.17 (with Q03); same topic elsewhere: Q02 (x, 2026-10-27).
- Pipeline (2026-10-23): READY, no block issues.
- Evidence:
  - City and County of Honolulu, Department of Planning and Permitting: clean energy expedited permit page: https://www.honolulu.gov/dpp/permitting/building-permits-home/building-permit/clean-energy/ (checked 2026-10-23; evidence date none shown on page). Eligible projects limited to 20KW systems; process applies to clean energy projects primarily at townhomes; eligible types solar PV, solar thermal or solar electric water heating, EV charging stations; four forms listed (checklist, filing instructions, affidavit, permit issuance notification). Page shows no update date (only a 2026 copyright). Page does not mention Hawaiian Electric.
  - GridPermit Honolulu guide (own page): https://mygridpermit.com/hawaii/honolulu/solar-permit-guide/ (checked 2026-10-23; evidence date 2026-08-13). A local permit and utility permission to operate are different approvals (HECO listed as interconnection and PTO authority).
- Notes: Same guide-label caveat as the X post (DC label vs unstated basis). Posted 8 days after the X version.

Draft (exact text):

```
Honolulu's Department of Planning and Permitting has an expedited permit for clean energy projects. Its page says eligible projects are limited to 20 kW systems, and the process is aimed primarily at townhomes.

Eligible project types are solar PV, solar thermal or solar electric water heating, and EV charging stations. The page lists four forms: a checklist, filing instructions, an affidavit and a permit issuance notification.

That is the city side. A local permit and utility permission to operate are different approvals. The Hawaiian Electric step is its own. Our Honolulu guide keeps them apart:

https://mygridpermit.com/hawaii/honolulu/solar-permit-guide/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=honolulu_expedited_clean_energy_202610
```

### Q06 X, Fri 2026-11-06: san-diego-self-issued-pv

- Status: **READY_FOR_HUMAN_REVIEW**. Audience: US installers. Format: single post.
- Destination: https://mygridpermit.com/california/san-diego/solar-permit-guide/?utm_source=x&utm_medium=organic_social&utm_campaign=san_diego_self_issued_pv_202610 (HTTP 200 on 2026-10-23)
- Value: One-line check on whether a San Diego rooftop job fits the self-issued path.
- Duplicate check: topic in posted ledger for this channel: no; max same-channel similarity: 0.2 (with Q04); same topic elsewhere: Q03 (linkedin, 2026-10-29).
- Pipeline (2026-10-23): READY, no block issues.
- Evidence:
  - City of San Diego Development Services Department: solar PV permit page: https://www.sandiego.gov/development-services/permits/solar-photovoltaic-permit (checked 2026-10-23; evidence date none shown on page). Residential rooftop PV permit 'self-issued with no plan review' for single-family, duplex or townhouse roofs designed per the template in Information Bulletin (IB) 301; system 'does not exceed more than 38.4 kW AC maximum output'; submitted electronically; 'previous requirement for professional certification is no longer required'. Page shows no update date (only a 2002-2026 copyright). Page does not mention SDG&E.
  - GridPermit San Diego guide (own page): https://mygridpermit.com/california/san-diego/solar-permit-guide/ (checked 2026-10-23; evidence date 2026-08-09). AC field 38.4 kW, DC field 'Not yet verified', Review time 'Not yet verified'; separate SDG&E interconnection and PTO authority.
- Notes: Posted 8 days after the LinkedIn version.

Draft (exact text):

```
San Diego's residential rooftop solar permit is self-issued with no plan review when the roof follows the IB 301 template and the system does not exceed 38.4 kW AC maximum output. SDG&E interconnection is separate.

https://mygridpermit.com/california/san-diego/solar-permit-guide/?utm_source=x&utm_medium=organic_social&utm_campaign=san_diego_self_issued_pv_202610
```

### Q07 LinkedIn, Tue 2026-11-10: california-solarapp-fees

- Status: **DRAFT_ONLY**. Audience: US installers. Format: single post.
- Destination: https://mygridpermit.com/california/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=california_solarapp_fees_202610 (HTTP 200 on 2026-10-23)
- Value: States who pays what for SolarAPP+ (installer administration fee, AHJ permit fees on top, no cost to participating jurisdictions).
- Duplicate check: topic in posted ledger for this channel: no; max same-channel similarity: 0.11 (with Q03); same topic elsewhere: Q10 (x, 2026-11-17).
- Pipeline (2026-10-23): READY (warn only: undated DOE claim), but queue status is DRAFT_ONLY for the reasons in notes.
- Evidence:
  - SolarAPP+ Help Center: How much does SolarAPP+ cost an installer to use: https://help.gosolarapp.org/article/75-how-much-does-solarapp-cost-an-installer-to-use (checked 2026-10-23; evidence date 2026-07-06). Installers pay a small administration fee; installers also pay any permitting fees established by the AHJ; page last updated July 6, 2026. Re-opened 2026-10-23 (the candidate's own date_checked is still 2026-10-17).
  - U.S. Department of Energy: 160 communities now automating solar permitting with SolarAPP+: https://www.energy.gov/cmei/systems/articles/160-communities-now-automating-solar-permitting-solarapp (checked 2026-10-23; evidence date 2023-12-20). 'SolarAPP+ is available free to jurisdictions and is supported by administrative fees paid by installers.' Article dated 2023-12-20 (1,038 days old): the candidate records evidence_date null, so the pipeline only warns; recorded with its true date it would be blocked.
- Notes: Existing 2026-10-17 candidate, untouched and still unpublished. Not ready: (1) its date_checked is 2026-10-17, so the pipeline blocks it after 2026-10-24; (2) the DOE source for 'no cost to participating local governments' is dated 2023-12-20, over the 180-day limit once the true date is recorded; the SolarAPP+ site (gosolarapp.org, undated) also says there is no cost to local governments and could be the current source. Re-verify sources and refresh dates in the 7 days before posting. It does not duplicate the published 'solarapp-eligibility' topic (2026-10-10).

Draft (exact text):

```
We updated the SolarAPP+ section of our California solar permit guide.

SolarAPP+ is available at no cost to participating local governments. Installers pay a SolarAPP+ administrative fee, and local permit fees may also apply. The guide now states this and links to SolarAPP+'s fee guidance.

The same page keeps the city or county permit separate from utility interconnection. It currently shows 298 verified cities, 38 counties and 27 utilities.

https://mygridpermit.com/california/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=california_solarapp_fees_202610

#SolarPermitting
```

### Q08 X, Thu 2026-11-12: not-yet-verified-fields

- Status: **READY_FOR_HUMAN_REVIEW**. Audience: developer agencies. Format: single post.
- Destination: https://mygridpermit.com/methodology/?utm_source=x&utm_medium=organic_social&utm_campaign=not_yet_verified_fields_202610 (HTTP 200 on 2026-10-23)
- Value: Shows how unsourced fields are handled in a permit-data product (marked 'Not yet verified', never filled with a typical value).
- Duplicate check: topic in posted ledger for this channel: no; max same-channel similarity: 0.1 (with Q06); same topic elsewhere: Q12 (linkedin, 2026-11-19).
- Pipeline (2026-10-23): READY, no block issues.
- Evidence:
  - GridPermit Methodology (own page): https://mygridpermit.com/methodology/ (checked 2026-10-23; evidence date none shown on page). 'We do not fill a missing fact with an estimate, a typical value from a similar city, or an inference from a neighboring jurisdiction's rules'; every fact links to its source and shows a confidence score. Page shows no update date.
  - GridPermit San Diego guide (own page): https://mygridpermit.com/california/san-diego/solar-permit-guide/ (checked 2026-10-23; evidence date 2026-08-09). AC field 38.4 kW, DC field 'Not yet verified', Review time 'Not yet verified'; separate SDG&E interconnection and PTO authority.
- Notes: Statement about GridPermit's own process, backed by its own pages; no customer, partner or result claim.

Draft (exact text):

```
If a review time isn't in an official source, our guide says "Not yet verified" instead of using a typical value from a similar city. San Diego's guide shows it that way today.

https://mygridpermit.com/methodology/?utm_source=x&utm_medium=organic_social&utm_campaign=not_yet_verified_fields_202610
```

### Q09 LinkedIn, Fri 2026-11-13: kw-limit-ac-dc-basis

- Status: **READY_FOR_HUMAN_REVIEW**. Audience: developer agencies. Format: single post.
- Destination: https://mygridpermit.com/partners/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=kw_limit_ac_dc_basis_202610 (HTTP 200 on 2026-10-23)
- Value: Longer version of the AC vs DC basis point, including that Denver does not state the basis of its 10 kW engineering threshold.
- Duplicate check: topic in posted ledger for this channel: no; max same-channel similarity: 0.19 (with Q03); same topic elsewhere: Q04 (x, 2026-11-02).
- Pipeline (2026-10-23): READY, no block issues.
- Evidence:
  - City and County of Denver, Community Planning and Development: Solar Permits (single-family and duplex): https://www.denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Community-Planning-and-Development/Plan-Review-Permits-and-Inspections/Single-Family-and-Duplex-Projects/Solar-Permits (checked 2026-10-23; evidence date none shown on page). SolarAPP+ quick-permit criterion 'kW DC rating of less than 10'; systems rated 10 kW and above need a Colorado-licensed professional engineer's stamp on the one-line diagram and calculations; 'All systems require an electrical permit'; AC/DC basis of the 10 kW engineering threshold not stated. Page shows no update date (only a 2026 copyright).
  - City of San Diego Development Services Department: solar PV permit page: https://www.sandiego.gov/development-services/permits/solar-photovoltaic-permit (checked 2026-10-23; evidence date none shown on page). Residential rooftop PV permit 'self-issued with no plan review' for single-family, duplex or townhouse roofs designed per the template in Information Bulletin (IB) 301; system 'does not exceed more than 38.4 kW AC maximum output'; submitted electronically; 'previous requirement for professional certification is no longer required'. Page shows no update date (only a 2002-2026 copyright). Page does not mention SDG&E.
  - GridPermit San Diego guide (own page): https://mygridpermit.com/california/san-diego/solar-permit-guide/ (checked 2026-10-23; evidence date 2026-08-09). AC field 38.4 kW, DC field 'Not yet verified', Review time 'Not yet verified'; separate SDG&E interconnection and PTO authority.
- Notes: Same Denver guide precondition as the X version. Posted 11 days after it.

Draft (exact text):

```
Two official solar permit pages, two ways of stating a size limit.

Denver's SolarAPP+ quick permit for one- and two-family homes lists "kW DC rating of less than 10". The same page says systems rated 10 kW and above need the stamp of a Colorado-licensed engineer on the one-line diagram and calculations. It does not say whether that 10 kW is AC or DC.

San Diego's self-issued rooftop path caps the system at 38.4 kW AC.

A single "max kW" field in a permit-rules database would lose that difference. Our guides keep AC and DC as separate fields. More on how we handle source-linked permit and utility data:

https://mygridpermit.com/partners/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=kw_limit_ac_dc_basis_202610
```

### Q10 X, Tue 2026-11-17: california-solarapp-fees

- Status: **DRAFT_ONLY**. Audience: US installers. Format: single post.
- Destination: https://mygridpermit.com/california/?utm_source=x&utm_medium=organic_social&utm_campaign=california_solarapp_fees_202610 (HTTP 200 on 2026-10-23)
- Value: Short fee-clarity post for installers.
- Duplicate check: topic in posted ledger for this channel: no; max same-channel similarity: 0.06 (with Q06); same topic elsewhere: Q07 (linkedin, 2026-11-10).
- Pipeline (2026-10-23): READY (warn only: undated DOE claim), but queue status is DRAFT_ONLY for the reasons in notes.
- Evidence:
  - SolarAPP+ Help Center: How much does SolarAPP+ cost an installer to use: https://help.gosolarapp.org/article/75-how-much-does-solarapp-cost-an-installer-to-use (checked 2026-10-23; evidence date 2026-07-06). Installers pay a small administration fee; installers also pay any permitting fees established by the AHJ; page last updated July 6, 2026. Re-opened 2026-10-23 (the candidate's own date_checked is still 2026-10-17).
  - U.S. Department of Energy: 160 communities now automating solar permitting with SolarAPP+: https://www.energy.gov/cmei/systems/articles/160-communities-now-automating-solar-permitting-solarapp (checked 2026-10-23; evidence date 2023-12-20). 'SolarAPP+ is available free to jurisdictions and is supported by administrative fees paid by installers.' Article dated 2023-12-20 (1,038 days old): the candidate records evidence_date null, so the pipeline only warns; recorded with its true date it would be blocked.
- Notes: Same blockers as the LinkedIn entry. Posted 7 days after it.

Draft (exact text):

```
Our California guide now spells out who pays for SolarAPP+. It's available at no cost to participating local governments. Installers pay an administrative fee, and local permit fees may also apply.

https://mygridpermit.com/california/?utm_source=x&utm_medium=organic_social&utm_campaign=california_solarapp_fees_202610
```

### Q11 LinkedIn, Wed 2026-11-18: denver-solarapp-quick-permit-10kw

- Status: **BLOCKED_NEEDS_SOURCE**. Audience: permitting professionals. Format: single post.
- Destination: https://mygridpermit.com/colorado/denver/solar-permit-guide/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=denver_solarapp_quick_permit_202611 (HTTP 200 on 2026-10-23)
- Value: Would explain Denver's SolarAPP+ quick-permit criterion (DC under 10 kW) and the engineer-stamp threshold at 10 kW and above.
- Duplicate check: topic in posted ledger for this channel: no; max same-channel similarity: n/a; same topic elsewhere: none.
- Pipeline (2026-10-23): not run (no draft).
- Evidence:
  - City and County of Denver, Community Planning and Development: Solar Permits (single-family and duplex): https://www.denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Community-Planning-and-Development/Plan-Review-Permits-and-Inspections/Single-Family-and-Duplex-Projects/Solar-Permits (checked 2026-10-23; evidence date none shown on page). SolarAPP+ quick-permit criterion 'kW DC rating of less than 10'; systems rated 10 kW and above need a Colorado-licensed professional engineer's stamp on the one-line diagram and calculations; 'All systems require an electrical permit'; AC/DC basis of the 10 kW engineering threshold not stated. Page shows no update date (only a 2026 copyright).
- Notes: BLOCKED: the destination guide contradicts the official page. The guide says 'Max system size (AC): 10 kW' and DC 'Not yet verified'; Denver's page says 'kW DC rating of less than 10' for the quick permit and gives no AC/DC basis for the 10 kW engineering threshold. No draft written until the guide is corrected or the owner confirms the basis with Denver.

### Q12 LinkedIn, Thu 2026-11-19: not-yet-verified-fields

- Status: **READY_FOR_HUMAN_REVIEW**. Audience: developer agencies. Format: single post.
- Destination: https://mygridpermit.com/methodology/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=not_yet_verified_fields_202610 (HTTP 200 on 2026-10-23)
- Value: Same point as the X version with the confidence-score detail.
- Duplicate check: topic in posted ledger for this channel: no; max same-channel similarity: 0.09 (with Q09); same topic elsewhere: Q08 (x, 2026-11-12).
- Pipeline (2026-10-23): READY, no block issues.
- Evidence:
  - GridPermit Methodology (own page): https://mygridpermit.com/methodology/ (checked 2026-10-23; evidence date none shown on page). 'We do not fill a missing fact with an estimate, a typical value from a similar city, or an inference from a neighboring jurisdiction's rules'; every fact links to its source and shows a confidence score. Page shows no update date.
  - GridPermit San Diego guide (own page): https://mygridpermit.com/california/san-diego/solar-permit-guide/ (checked 2026-10-23; evidence date 2026-08-09). AC field 38.4 kW, DC field 'Not yet verified', Review time 'Not yet verified'; separate SDG&E interconnection and PTO authority.
- Notes: Posted 7 days after the X version.

Draft (exact text):

```
When a permit fact isn't stated in an official source, our guide field reads "Not yet verified". Review time in the San Diego guide is one example today. We do not fill the gap with an estimate or a typical value from a similar city.

What is published does link to its source, and each fact shows a confidence score. The verification process is written out here:

https://mygridpermit.com/methodology/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=not_yet_verified_fields_202610
```

### Q13 LinkedIn, Fri 2026-11-20: nv-energy-application-and-no-energize

- Status: **BLOCKED_NEEDS_SOURCE**. Audience: US installers. Format: single post.
- Destination: https://mygridpermit.com/nevada/las-vegas/solar-permit-guide/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=nv_energy_pto_sequence_202611 (HTTP 200 on 2026-10-23)
- Value: Would state the Southern Nevada NV Energy sequence: PowerClerk application, fee before the application proceeds, no energizing before NV Energy's final verification.
- Duplicate check: topic in posted ledger for this channel: no; max same-channel similarity: n/a; same topic elsewhere: none.
- Pipeline (2026-10-23): not run (no draft).
- Evidence:
  - NV Energy Net Metering and Energy Storage Interconnection Handbook (PDF): https://www.nvenergy.com/publish/content/dam/nvenergy/brochures_arch/cleanenergy/handbooks/SolarGenerations-Handbook.pdf (checked 2026-10-23; evidence date 2025-10-16). Applications go through PowerClerk and are incomplete until the application fee is paid (Southern Nevada $189, Northern Nevada $184); 'Systems may not be energized prior to successful final verification by NV Energy'; permission to operate follows utility inspection and meter set. Latest revision row in the handbook: 10/16/2025 (372 days old on 2026-10-23).
- Notes: BLOCKED: the only source is the NV Energy handbook, whose latest revision row is 10/16/2025 (372 days old, over the 180-day evidence limit). The nvenergy.com/cleanenergy/solar page returned no usable content. Needs a current dated NV Energy page or an owner-accepted exception. Also, the destination guide describes the City of Las Vegas permit side and a 25 kW net-metering cap; confirm it does not contradict the final wording.

## 5. Before any post
1. Owner approves the exact text (SHA-256 is in `queue-30day.json`).
2. Rebuild the site, take a fresh snapshot and run `node scripts/build-distribution-queue.mjs --snapshot <snapshot> --out <dir> --today <posting day>`. The item must be READY with no block issues.
3. Refresh `date_checked` on every claim after re-opening its source on the posting day.
4. Confirm the account identity and the gate in the live account; the tooling never publishes.
5. Fix first: the Denver guide AC label (affects Q04, Q09, Q11) and the Honolulu guide DC label (Q02, Q05).
