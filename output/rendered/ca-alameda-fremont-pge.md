**Locality:** Fremont, Alameda County
**Utility (record):** Pacific Gas and Electric Company (PG&E)
**Record ID:** ca-alameda-fremont-pge
**Schema version:** 1.2.0
**Last verified:** 2026-08-01

---

# Utility

**Utility:** Pacific Gas and Electric Company (PG&E)

*Confidence:* High (0.9)
*Notes:* PG&E is confirmed as the transmission/distribution, billing, and interconnection utility of record for Fremont. See generation_supplier for the electricity generation supplier, which is a separate CCA entity (Ava Community Energy), not PG&E, by default.
*Source(s):* [S6](https://www.selfgenca.com/home/contact/) — SGIP - Contact (Self-Generation Incentive Program (statewide administrator site)); [S7](https://www.fremont.gov/about/sustainability/energy/green-electricity) — Green Electricity (City of Fremont)

**Interconnection:** https://www.pge.com/en/about/doing-business-with-pge/interconnections/net-energy-metering-program.html

*Confidence:* Medium (0.6)
*Notes:* Same URL and same limitation as the San Jose pilot record: confirmed to exist on PG&E's official domain via search engine indexing under the expected title, but pge.com returned HTTP 403 to direct fetch on every attempt this session (re-checked fresh for this record, not assumed from before).
*Source(s):* [S9](https://www.pge.com/en/about/doing-business-with-pge/interconnections/net-energy-metering-program.html) — Net Energy Metering (NEM) Program | PG&E (Pacific Gas and Electric Company)

## Generation Supplier

**Name:** Ava Community Energy (formerly East Bay Community Energy / EBCE) - 'Bright Choice' product
**Type:** cca

*Value notes:* Fremont residents and businesses are automatically enrolled in Ava's Bright Choice product as their default electricity generation supplier, with the option to opt up to a cleaner product or opt out back to PG&E generation. PG&E remains the transmission/distribution entity and billing agent for both PG&E's and Ava's customers regardless of which generation supplier is used.
*Confidence:* High (0.9)
*Source(s):* [S7](https://www.fremont.gov/about/sustainability/energy/green-electricity) — Green Electricity (City of Fremont)

# Permit Authority

**Permit Authority:** City of Fremont Community Development Department — Planning, Building & Permit Services

*Confidence:* High (0.9)
*Notes:* Confirmed via direct retrieval of the Instant Solar Permit (ISP) page, which is hosted under this department's section of the city website and lists Development Services staff as the contact.
*Source(s):* [S1](https://www.fremont.gov/government/departments/community-development/planning-building-permit-services/planning-building-permits/permit-types/instant-solar-permit-isp) — Instant Solar Permit (ISP) (City of Fremont)

**Permit URL:** https://www.fremont.gov/government/departments/community-development/planning-building-permit-services/planning-building-permits/permit-types/instant-solar-permit-isp

*Confidence:* High (0.85)
*Notes:* Content directly confirmed (unlike the San Jose pilot record's permit_url, which pointed at a general electrical page — this is the specific, dedicated solar permit page).
*Source(s):* [S1](https://www.fremont.gov/government/departments/community-development/planning-building-permit-services/planning-building-permits/permit-types/instant-solar-permit-isp) — Instant Solar Permit (ISP) (City of Fremont)

## Required Documents

Not yet verified.

## Permit Fees

Not yet verified.

# Timeline

**Range:** 0–3 days

*Field notes:* Same-day approval for over-the-counter/Instant Solar Permit (ISP) applications; up to 3 days for other standard expedited applications, per Fremont Municipal Code Ch. 15.63. See eligibility_constraints for the system-size and property-type scope this applies to; non-qualifying or larger systems may require standard plan review with a longer, unconfirmed timeline.
*Confidence:* High (0.85)
*Source(s):* [S3](https://www.codepublishing.com/CA/Fremont/html/Fremont15/Fremont1563.html) — Fremont Municipal Code Chapter 15.63 - Small Residential Rooftop Solar Systems (City of Fremont (hosted by Code Publishing Company))

## Eligibility Constraints

**Property types:** single-family, duplex
**Max system size (AC):** 10 kW
**Max system size (DC):** Not yet verified.
**Max thermal capacity:** 30 kW
**Program/pathway:** Fremont Municipal Code Ch. 15.63 (Small Residential Rooftop Solar Systems) / Instant Solar Permit (ISP) via SolarAPP+
**Other conditions:** Confirmed: none found.

*Confidence:* High (0.85)
*Notes:* System-size caps (10 kW AC / 30 kW thermal) and property-type scope (single-family, duplex) moved here from timeline_days/inspection_steps notes, where this same constraint was previously duplicated as free text. system_size_kw_dc_max left null — the source states an AC and a thermal cap, not a separate DC cap. other_conditions left empty — the source also mentions general fire/structural/electrical code compliance and building-height limits, but those were not transcribed into this record's text during the original collection session, so they are not carried forward here rather than being added now from memory.
*Source(s):* [S3](https://www.codepublishing.com/CA/Fremont/html/Fremont15/Fremont1563.html) — Fremont Municipal Code Chapter 15.63 - Small Residential Rooftop Solar Systems (City of Fremont (hosted by Code Publishing Company))

# Inspection

**Inspection Steps:**
- One inspection required and performed for qualifying expedited/ISP small residential rooftop solar systems (Fremont Municipal Code Ch. 15.63)
- Re-inspection authorized if the initial inspection fails

*Confidence:* High (0.85)
*Notes:* Applies to qualifying small residential rooftop systems only — see eligibility_constraints for the exact scope. Does not describe the process for non-qualifying/larger systems.
*Source(s):* [S3](https://www.codepublishing.com/CA/Fremont/html/Fremont15/Fremont1563.html) — Fremont Municipal Code Chapter 15.63 - Small Residential Rooftop Solar Systems (City of Fremont (hosted by Code Publishing Company))

# Battery Programs

- **SGIP - Residential Solar and Storage Equity** — administered by Pacific Gas and Electric Company (PG&E), under the CPUC's Self-Generation Incentive Program
  Storage incentive of $1,100/kWh paired with a solar incentive of $3,100/kW, funded via a $280 million CPUC-authorized budget that opened for reservations June 2, 2025. Administered by PG&E across its entire distribution territory, which includes Fremont/Alameda County.
  Value: $1100/kWh
  Eligibility: PG&E or SCE residential customers (general market tier)
  Link: https://www.selfgenca.com/home/about/
  Status: unknown (from 2025-06-02)
- **SGIP - Equity Resiliency** — administered by Pacific Gas and Electric Company (PG&E), under the CPUC's Self-Generation Incentive Program
  Incentive of $1,000/kWh for IOU residential or non-residential customers. Source states this rate is/was 'available through 2025.'
  Value: $1000/kWh
  Eligibility: IOU residential or non-residential customers meeting Equity Resiliency criteria (e.g. high fire-threat district, medical baseline). Specific Fremont/Alameda County eligibility not independently confirmed this session.
  Link: https://www.selfgenca.com/home/about/
  Status: expired (until 2025-12-31)

*Confidence:* Medium (0.65)
*Notes:* Same statewide CPUC/PG&E-administered SGIP program and figures confirmed for the San Jose pilot record, reused here because SGIP is administered per IOU distribution territory (PG&E), not per city — PG&E's distribution role in Fremont is independently confirmed (S7), so the program's applicability carries over. Confidence set slightly below the San Jose record's (0.7) because this record does not independently re-confirm PG&E's SGIP administrator role specifically for Alameda County (S6 names Santa Clara County explicitly, not Alameda). 'effective_from'/'expires_on'/'status' per item follow the same reasoning documented in the San Jose record: the Residential Solar and Storage Equity tier's reservation-opening date (2025-06-02) is directly stated, with no stated end date or current status (hence 'unknown'); the Equity Resiliency tier's 'available through 2025' is interpreted as expiring 2025-12-31 (end of year, no specific day given), which is before last_verified, hence 'expired'. Re-check against selfgenca.com's live Program Metrics page before showing as current.
*Source(s):* [S4](https://www.cpuc.ca.gov/industries-and-topics/electrical-energy/demand-side-management/self-generation-incentive-program) — Self-Generation Incentive Program (SGIP) (California Public Utilities Commission); [S5](https://www.selfgenca.com/home/about/) — SGIP - Statewide Announcements / About (Self-Generation Incentive Program (statewide administrator site))

## Other Rebates

Not yet verified.

# Official Contacts

- **City of Fremont Development Services (Community Development Dept.)** — phone: 510-284-4000, email: developmentservices@fremont.gov, link: https://www.fremont.gov/government/departments/community-development/planning-building-permit-services/planning-building-permits/permit-types/instant-solar-permit-isp
- **SGIP Program Administrator (PG&E territory)** — phone: 415-973-6436, email: selfgen@pge.com, link: https://www.selfgenca.com/home/contact/

*Confidence:* High (0.85)
*Source(s):* [S1](https://www.fremont.gov/government/departments/community-development/planning-building-permit-services/planning-building-permits/permit-types/instant-solar-permit-isp) — Instant Solar Permit (ISP) (City of Fremont); [S5](https://www.selfgenca.com/home/about/) — SGIP - Statewide Announcements / About (Self-Generation Incentive Program (statewide administrator site))

# Sources

- **[S1]** Instant Solar Permit (ISP) — City of Fremont (government). https://www.fremont.gov/government/departments/community-development/planning-building-permit-services/planning-building-permits/permit-types/instant-solar-permit-isp — accessed 2026-08-01
- **[S2]** Planning, Building & Permit Services Fees — City of Fremont (government). https://www.fremont.gov/government/departments/community-development/planning-building-permit-services/fees — accessed 2026-08-01
- **[S3]** Fremont Municipal Code Chapter 15.63 - Small Residential Rooftop Solar Systems — City of Fremont (hosted by Code Publishing Company) (government). https://www.codepublishing.com/CA/Fremont/html/Fremont15/Fremont1563.html — accessed 2026-08-01
- **[S4]** Self-Generation Incentive Program (SGIP) — California Public Utilities Commission (cpuc). https://www.cpuc.ca.gov/industries-and-topics/electrical-energy/demand-side-management/self-generation-incentive-program — accessed 2026-08-01
- **[S5]** SGIP - Statewide Announcements / About — Self-Generation Incentive Program (statewide administrator site) (program_administrator). https://www.selfgenca.com/home/about/ — accessed 2026-08-01
- **[S6]** SGIP - Contact — Self-Generation Incentive Program (statewide administrator site) (program_administrator). https://www.selfgenca.com/home/contact/ — accessed 2026-08-01
- **[S7]** Green Electricity — City of Fremont (government). https://www.fremont.gov/about/sustainability/energy/green-electricity — accessed 2026-08-01
- **[S8]** Alameda County Government — County of Alameda (government). https://www.acgov.org/government/ — accessed 2026-08-01
- **[S9]** Net Energy Metering (NEM) Program | PG&E — Pacific Gas and Electric Company (utility). https://www.pge.com/en/about/doing-business-with-pge/interconnections/net-energy-metering-program.html — accessed 2026-08-01

# Coverage

- **Populated fields (12/15):** utility, generation_supplier, city, county, permit_authority, permit_url, interconnection_url, battery_programs, inspection_steps, timeline_days, eligibility_constraints, official_contacts
- **Missing fields (3/15):** required_documents, permit_fees, rebates
- **Overall completeness:** 80%
