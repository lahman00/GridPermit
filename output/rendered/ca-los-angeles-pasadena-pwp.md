**Locality:** Pasadena, Los Angeles County
**Utility (record):** Pasadena Water and Power
**Record ID:** ca-los-angeles-pasadena-pwp
**Schema version:** 1.3.0
**Last verified:** 2026-08-01

---

# Utility

**Utility:** Pasadena Water and Power

*Confidence:* High (1)
*Notes:* Given as the run's input parameter; directly confirmed as Pasadena's municipal electric utility via its own official site. PWP is both the distribution and interconnection authority — unlike the PG&E-territory records in this pilot, there is no separate investor-owned distribution company to distinguish from a city permitting authority.
*Source(s):* [S1](https://pwp.cityofpasadena.net/) — Pasadena Water and Power (City of Pasadena)

**Interconnection:** https://pwp.cityofpasadena.net/selfgenusp/

*Confidence:* High (0.9)
*Notes:* PWP's own self-generation/interconnection requirements page. Content directly confirmed, including the full application process — no bot-blocking encountered on pwp.cityofpasadena.net this session, unlike pge.com/sanjoseca.gov/fremont.gov in prior records.
*Source(s):* [S2](https://pwp.cityofpasadena.net/selfgenusp/) — Requirements for Self-Generation (City of Pasadena (Pasadena Water and Power))

## Generation Supplier

**Name:** Pasadena Water and Power
**Type:** utility

*Value notes:* PWP is a vertically-integrated municipal utility, not layered with a separate CCA. Per PWP's own materials: about 10% of power demand is met by PWP-owned generating facilities; the remainder is purchased via contracts (conventional and renewable) and the wholesale energy market. No Community Choice Aggregator was mentioned anywhere in PWP's own materials reviewed this session.
*Confidence:* High (0.9)
*Source(s):* [S5](https://pwp.cityofpasadena.net/power/) — Where Our Power Comes From (City of Pasadena (Pasadena Water and Power))

# Permit Authority

**Permit Authority:** City of Pasadena Department of Planning & Development issues the building permit; Pasadena Water and Power's interconnection approval is required first, before a building permit application can be submitted.

*Confidence:* High (0.85)
*Notes:* Distinguishes the two authorities per this record's collection rules: PWP is the interconnection authority (and the utility itself); the City's Planning & Development department is the separate building-permit-issuing authority. No City of Pasadena Planning & Development page was independently fetched this session — this fact comes from PWP's own description of the process.
*Source(s):* [S2](https://pwp.cityofpasadena.net/selfgenusp/) — Requirements for Self-Generation (City of Pasadena (Pasadena Water and Power))

**Permit URL:** https://pwp.cityofpasadena.net/solar-eligibility-and-requirements/

*Confidence:* High (0.85)
*Notes:* PWP's own solar eligibility/requirements page — the practical entry point for a Pasadena solar permit, since PWP pre-approval gates the building permit application.
*Source(s):* [S3](https://pwp.cityofpasadena.net/solar-eligibility-and-requirements/) — Solar Eligibility and Requirements (City of Pasadena (Pasadena Water and Power))

## Required Documents

- **Completed GFIA (Generation Facility Interconnection Application) Form**
  *Source(s):* [S2](https://pwp.cityofpasadena.net/selfgenusp/) — Requirements for Self-Generation (City of Pasadena (Pasadena Water and Power))
- **Site plan with system description and parameters**
  *Source(s):* [S2](https://pwp.cityofpasadena.net/selfgenusp/) — Requirements for Self-Generation (City of Pasadena (Pasadena Water and Power))
- **Single line diagram of electrical components**
  *Source(s):* [S2](https://pwp.cityofpasadena.net/selfgenusp/) — Requirements for Self-Generation (City of Pasadena (Pasadena Water and Power))
- **Certification test verifying equipment compliance**
  *Source(s):* [S2](https://pwp.cityofpasadena.net/selfgenusp/) — Requirements for Self-Generation (City of Pasadena (Pasadena Water and Power))
- **Signed contractor agreement** — required when: if available
  *Source(s):* [S2](https://pwp.cityofpasadena.net/selfgenusp/) — Requirements for Self-Generation (City of Pasadena (Pasadena Water and Power))

*Confidence:* High (0.85)
*Source(s):* [S2](https://pwp.cityofpasadena.net/selfgenusp/) — Requirements for Self-Generation (City of Pasadena (Pasadena Water and Power))

## Permit Fees

- **Self-Generation/Interconnection Application Fee (GFIA):** $800 (flat) — Check payable to 'City of Pasadena'. Additional fees may apply if a supplemental review or detailed interconnection study is required (amount not specified by source).
- **Plan Review and Inspection Fees:** $0 (flat) — PWP states it is not charging plan review and inspection fees for solar and battery systems. Structural, Building & Safety, meter, and other non-energy-related fees may still apply. The relationship between this waiver and the separately-stated $800 GFIA application fee above is not fully reconciled by these two source pages — confirm directly with PWP before treating both as simultaneously accurate.

*Confidence:* High (0.85)
*Source(s):* [S2](https://pwp.cityofpasadena.net/selfgenusp/) — Requirements for Self-Generation (City of Pasadena (Pasadena Water and Power)); [S4](https://pwp.cityofpasadena.net/residential-solar-rebate/) — Residential Solar Rebate (City of Pasadena (Pasadena Water and Power))

# Timeline

Not yet verified.

## Eligibility Constraints

**Property types:** Confirmed: none found.
**Max system size (AC):** 1000 kW
**Max system size (DC):** Not yet verified.
**Max thermal capacity:** Not yet verified.
**Program/pathway:** Net Energy Metering (Pasadena Municipal Code 13.04.177) via GFIA Interconnection Agreement
**Other conditions:** System size also capped at 150% of the customer's average annual energy consumption per PWP billing record (or 2 watts DC per square foot of conditioned floor area for new construction without billing history); System must serve on-site load to qualify under the renewable/Net Energy Metering pathway (PMC 13.04.177); other self-generation technologies (reciprocating engines, micro-turbines, fuel cells, combined heat and power) are billed under a separate Self-Generation Rate Schedule, PMC 13.04.178; Separate GFIA Interconnection Agreement forms apply for systems above vs. below 15 kW combined inverter nameplate rating

*Confidence:* High (0.85)
*Notes:* property_types left empty — sources describe eligibility by customer/meter account ('all PWP electric customers'), not by a residential-only or single-family-only property restriction; both residential and commercial customers are explicitly in scope across S2-S4.
*Source(s):* [S2](https://pwp.cityofpasadena.net/selfgenusp/) — Requirements for Self-Generation (City of Pasadena (Pasadena Water and Power)); [S3](https://pwp.cityofpasadena.net/solar-eligibility-and-requirements/) — Solar Eligibility and Requirements (City of Pasadena (Pasadena Water and Power))

# Inspection

**Inspection Steps:**
- Submit application package (GFIA form, site plan, single-line diagram, certification test, contractor agreement if available) to PWP Customer Relations - DG Applications
- PWP reviews and determines if simplified interconnection or a detailed study is needed
- PWP issues an approval letter (required before applying for a building permit)
- Sign the applicable GFIA Interconnection Agreement (separate forms for systems above vs. below 15 kW)
- Obtain a building permit from the City of Pasadena Department of Planning & Development
- Install the system and schedule fire/building inspections
- Submit a 'Permission to Operate' request with final inspection documentation
- PWP performs a field inspection and meter replacement, then issues the 'Permission to Operate' letter

*Confidence:* High (0.85)
*Notes:* This is PWP's full 8-step interconnection-to-operate sequence, not a narrower 'inspection only' list, because PWP's own material presents it as one unified process with the building-permit step (step 5) embedded partway through.
*Source(s):* [S2](https://pwp.cityofpasadena.net/selfgenusp/) — Requirements for Self-Generation (City of Pasadena (Pasadena Water and Power))

# Battery Programs

- **PWP Residential Solar and Battery Rebate Pilot Program - Battery Storage Track** — administered by Pasadena Water and Power
  Battery energy storage incentive of up to $550/kWh for residential customers, part of a pilot program launched April 7, 2026. No funding cap or end date stated in the source.
  Value: $550/kWh
  Eligibility: PWP residential electric customers
  Link: https://pwp.cityofpasadena.net/launch-solar-and-battery-rebate-pilot-program-for-residential-and-commercial-customers/
  Status: active (from 2026-04-07)

*Confidence:* High (0.85)
*Notes:* 'status: active' is based on the source's present-tense framing ('battery energy storage incentives are also available') at time of the pilot's launch announcement, not inferred from silence about an end date — no source states the program has since closed, but this should be re-verified against PWP's live program page before being shown to a user as current, since pilot programs can pause or exhaust funding without an update to this specific announcement page.
*Source(s):* [S7](https://pwp.cityofpasadena.net/launch-solar-and-battery-rebate-pilot-program-for-residential-and-commercial-customers/) — PWP Launches Solar and Battery Rebate Pilot Program for Residential and Commercial Customers (City of Pasadena (Pasadena Water and Power))

## Other Rebates

- **PWP Residential Solar Rebate - Standard Rate** — administered by Pasadena Water and Power
  Rebate of $0.60/Watt for new, permanent, owned (not leased/PPA) rooftop solar PV systems.
  Value: $0.6/W
  Eligibility: PWP residential electric customers not enrolled in an income-qualified bill payment assistance program; system must be owned (leased/PPA systems do not qualify); final NEM approval from PWP required; must apply within 180 days of interconnection
  Link: https://pwp.cityofpasadena.net/residential-solar-rebate/
  Status: unknown
- **PWP Residential Solar Rebate - Income-Qualified Rate** — administered by Pasadena Water and Power
  Rebate of $1.00/Watt for new, permanent, owned (not leased/PPA) rooftop solar PV systems, for customers enrolled in a PWP income-qualified bill payment assistance program.
  Value: $1/W
  Eligibility: PWP residential electric customers enrolled in an income-qualified bill payment assistance program (EUAP, CARES, or CARES Plus) at time of application; system must be owned (leased/PPA systems do not qualify); final NEM approval from PWP required; must apply within 180 days of interconnection
  Link: https://pwp.cityofpasadena.net/residential-solar-rebate/
  Status: unknown

*Confidence:* High (0.85)
*Notes:* Split into two separate program items (one per rate tier) rather than one item with two numbers, per the schema's 'one item, one unit' rule (see agents/data-collector.md) — the source describes two distinct eligibility tiers of the same per-Watt rebate, not two different components of one program. Both figures were previously stuck in 'description' text only because data/schema.json's programItem had no per-Watt field; schema v1.3.0 added value_usd_per_watt specifically in response to this record.
*Source(s):* [S4](https://pwp.cityofpasadena.net/residential-solar-rebate/) — Residential Solar Rebate (City of Pasadena (Pasadena Water and Power))

# Official Contacts

- **PWP Solar / Self-Generation (DG Applications)** — phone: 626-744-4495, email: PWPDGApplications@cityofpasadena.net, link: https://pwp.cityofpasadena.net/selfgenusp/
- **PWP Customer Service** — phone: 626-744-4005, link: https://pwp.cityofpasadena.net/

*Confidence:* High (0.9)
*Source(s):* [S1](https://pwp.cityofpasadena.net/) — Pasadena Water and Power (City of Pasadena); [S2](https://pwp.cityofpasadena.net/selfgenusp/) — Requirements for Self-Generation (City of Pasadena (Pasadena Water and Power))

# Sources

- **[S1]** Pasadena Water and Power — City of Pasadena (utility). https://pwp.cityofpasadena.net/ — accessed 2026-08-01
- **[S2]** Requirements for Self-Generation — City of Pasadena (Pasadena Water and Power) (utility). https://pwp.cityofpasadena.net/selfgenusp/ — accessed 2026-08-01
- **[S3]** Solar Eligibility and Requirements — City of Pasadena (Pasadena Water and Power) (utility). https://pwp.cityofpasadena.net/solar-eligibility-and-requirements/ — accessed 2026-08-01
- **[S4]** Residential Solar Rebate — City of Pasadena (Pasadena Water and Power) (utility). https://pwp.cityofpasadena.net/residential-solar-rebate/ — accessed 2026-08-01
- **[S5]** Where Our Power Comes From — City of Pasadena (Pasadena Water and Power) (utility). https://pwp.cityofpasadena.net/power/ — accessed 2026-08-01
- **[S6]** Pasadena, California - Services Locator — County of Los Angeles (government). https://locator.lacounty.gov/lac/Location/3036107/pasadena-california — accessed 2026-08-01
- **[S7]** PWP Launches Solar and Battery Rebate Pilot Program for Residential and Commercial Customers — City of Pasadena (Pasadena Water and Power) (utility). https://pwp.cityofpasadena.net/launch-solar-and-battery-rebate-pilot-program-for-residential-and-commercial-customers/ — accessed 2026-08-01

# Coverage

- **Populated fields (14/15):** utility, generation_supplier, city, county, permit_authority, permit_url, interconnection_url, battery_programs, required_documents, inspection_steps, eligibility_constraints, permit_fees, rebates, official_contacts
- **Missing fields (1/15):** timeline_days
- **Overall completeness:** 93.3%
