// "Who files the solar permit here?" answer block for a small, explicitly
// reviewed set of locality guides. It restates what the record's own
// official-source fields already say, in the order a homeowner asks the
// question, and nothing else: no fees, no turnaround beyond what the record
// holds, no new destinations, no routing or commercial logic.
//
// Fail-closed: every reviewed entry lists the record facts its copy depends
// on (`requires`). If a record is edited so one of them is no longer true,
// the block simply stops rendering until a person re-reviews the copy.

import type { LocalityRecord, SourceRef } from "./locality-guide.ts";

export interface PathwayRow {
	situation: string;
	whoFiles: string;
	whatTheCityLists: string;
	notVerified: string;
}

export interface PermitPathwayAnswer {
	recordId: string;
	heading: string;
	answer: string;
	rows: PathwayRow[];
	prepare: string[];
	// Internal, non-commercial handoffs only.
	handoffs: Array<{ href: string; label: string }>;
	source: SourceRef;
	verifiedAsOf: string;
}

interface ReviewedEntry {
	sourceId: string;
	heading: string;
	answer: string;
	rows: PathwayRow[];
	prepare: string[];
	// Each predicate must hold for the record or the block is suppressed.
	requires: Array<(record: LocalityRecord) => boolean>;
}

const docNames = (r: LocalityRecord) => (r.required_documents.value ?? []).map((d) => d.name);
const conditions = (r: LocalityRecord) => r.eligibility_constraints.value?.other_conditions ?? [];
const pathway = (r: LocalityRecord) => r.eligibility_constraints.value?.program_or_pathway ?? "";
const hasDoc = (needle: string) => (r: LocalityRecord) => docNames(r).some((n) => n.includes(needle));
const hasCondition = (needle: string) => (r: LocalityRecord) => conditions(r).some((c) => c.includes(needle));
const hasInspection = (needle: string) => (r: LocalityRecord) =>
	(r.inspection_steps.value ?? []).some((s) => s.includes(needle));

const HANDOFFS = [
	{ href: "/blog/solarapp-eligibility-2026/", label: "Can this project use SolarAPP+? Battery, panel upgrade and homeowner-install rules" },
	{ href: "/blog/city-permit-vs-utility-pto/", label: "City permit vs utility interconnection and PTO: why one approval is not the other" },
];

const REVIEWED: Record<string, ReviewedEntry> = {
	"ca-san-diego-chula-vista-sdge": {
		sourceId: "S1",
		heading: "Who files the solar permit in Chula Vista?",
		answer:
			"According to the City's Residential Solar Energy Permits page as recorded in this guide, the SolarAPP+ path is submitted online by a licensed contractor. A property owner filing directly uses the City's standard path instead. If you are hiring an installer, ask which path they will file under.",
		rows: [
			{
				situation: "Qualifying system, licensed contractor (SolarAPP+)",
				whoFiles: "Licensed contractor, online",
				whatTheCityLists: "SolarAPP+ unique ID number and the forms/plans packet from SolarAPP+. Sources describe a same-day permit for eligible systems.",
				notVerified: "Eligibility is described as systems \"under 10 kW\" with no AC or DC unit stated. Confirm your system with the City.",
			},
			{
				situation: "Property owner filing directly (standard path)",
				whoFiles: "Property owner",
				whatTheCityLists: "Building Permit Application and 2 sets of plans.",
				notVerified: "No processing time or fee is stated in the sources reviewed.",
			},
			{
				situation: "System that does not fit either row",
				whoFiles: "Not verified",
				whatTheCityLists: "Nothing recorded.",
				notVerified: "Ask the City's Development Services Department (see Official contacts below).",
			},
		],
		prepare: [
			"Ask your installer which path (SolarAPP+ or standard) they will file under, and who the permit applicant will be.",
			"For the inspection, the City lists having the approved plans and the completed Circuit Card on site (plus an SDG&E Work Order if one applies).",
			"Keep the SDG&E interconnection in mind as a separate step from the City permit.",
		],
		requires: [
			hasDoc("SolarAPP+ unique ID"),
			hasDoc("Building Permit Application"),
			hasDoc("2 sets of plans"),
			hasCondition("under 10 kW"),
			hasCondition("licensed contractor"),
			hasInspection("Circuit Card"),
		],
	},
	"ca-ventura-oxnard-sce": {
		sourceId: "S1",
		heading: "Who files the solar permit in Oxnard?",
		answer:
			"The City of Oxnard's SolarAPP+ page, which this guide records, describes the online real-time process as available for licensed contractors only. This guide has no verified homeowner-filed pathway for Oxnard, so if you plan to file yourself, ask the City before assuming one exists.",
		rows: [
			{
				situation: "Licensed contractor using SolarAPP+",
				whoFiles: "Licensed contractor (CSLB), online",
				whatTheCityLists: "SolarAPP+ approval documents (Approval ID, system kilowatts, number of panels), a City of Oxnard Business Tax Certificate, and a Click2Gov account associated with the contractor. The City describes online application, payment and permit issuance in real time.",
				notVerified: "Whether your specific project qualifies, and any permit fee (not stated in the sources reviewed).",
			},
			{
				situation: "Homeowner filing directly",
				whoFiles: "Not verified",
				whatTheCityLists: "No homeowner path on the City's SolarAPP+ page.",
				notVerified: "Ask the City's Building Department (see Official contacts below).",
			},
			{
				situation: "After the permit is issued",
				whoFiles: "Per the City page: via the Click2Gov site",
				whatTheCityLists: "Request an inspection after paying and printing the permit. Inspections must be requested within 365 days of issuance.",
				notVerified: "Inspection scheduling details beyond that.",
			},
		],
		prepare: [
			"Ask your installer whether it is CSLB-licensed, holds an Oxnard Business Tax Certificate and Click2Gov account, and will submit through SolarAPP+.",
			"Ask who will request the inspection, since the City's page sets a 365-day window from permit issuance.",
			"Keep the SCE interconnection in mind as a separate step from the City permit.",
		],
		requires: [
			(r) => pathway(r).includes("licensed contractors only"),
			hasDoc("Business Tax Certificate"),
			hasDoc("Click2Gov"),
			hasInspection("365 days"),
		],
	},
	"ca-san-bernardino-san-bernardino-sce": {
		sourceId: "S1",
		heading: "Who files the solar permit in San Bernardino?",
		answer:
			"The City of San Bernardino's page, as recorded in this guide, lets contractors and homeowners pursuing a permit under SB 379 apply through the Symbium portal for instantaneous plan review, and says use of that platform is strongly encouraged. Applicants who are ineligible, or who choose to submit outside Symbium, may still apply in person at the Building and Safety counter; owner-builders need a completed Permit Application Declaration.",
		rows: [
			{
				situation: "SB 379 project (under 38.4 kW) using Symbium",
				whoFiles: "Contractor or homeowner, online",
				whatTheCityLists: "Instantaneous plan review approval through the Symbium portal.",
				notVerified: "Whether your system is eligible for Symbium.",
			},
			{
				situation: "System 10 kW and under, or not eligible for Symbium, filed at the counter",
				whoFiles: "In person at Building and Safety",
				whatTheCityLists: "Permit Application, Contractor/Owner-Builder declarations, the Eligibility Checklist for Expedited Residential Solar Permitting, and a hard-copy set of 11x17 plans with specifications and calculations. The City says processing may take approximately 1 to 3 business days, depending on staff availability.",
				notVerified: "The City also lists a valid business license; ask the counter how that applies to an owner-builder.",
			},
			{
				situation: "Electric main panel upgrade",
				whoFiles: "Separate permit, through the City's Solar Division",
				whatTheCityLists: "A separate electrical permit is required.",
				notVerified: "Fees and timing are not stated in the sources reviewed.",
			},
		],
		prepare: [
			"Ask your installer whether the project will go through Symbium or the counter, and whether a panel upgrade needs its own permit.",
			"If you are an owner-builder, the City lists the Owner-Builder acknowledgment and a completed Permit Application Declaration.",
			"Keep the SCE interconnection in mind as a separate step from the City permit.",
		],
		requires: [
			hasCondition("38.4kW"),
			hasCondition("10kW and under"),
			hasCondition("separate permits"),
			hasDoc("Eligibility Checklist"),
			hasDoc("Owner Builders Declarations"),
			(r) => r.timeline_days.value?.min_days === 1 && r.timeline_days.value?.max_days === 3,
		],
	},
};

export const PERMIT_PATHWAY_RECORD_IDS = Object.keys(REVIEWED);

export function buildPermitPathwayAnswer(record: LocalityRecord): PermitPathwayAnswer | null {
	const entry = REVIEWED[record.record_id];
	if (!entry) return null;
	const source = record.sources.find((s) => s.id === entry.sourceId);
	if (!source) return null;
	if (!entry.requires.every((check) => check(record))) return null;
	return {
		recordId: record.record_id,
		heading: entry.heading,
		answer: entry.answer,
		rows: entry.rows,
		prepare: entry.prepare,
		handoffs: HANDOFFS,
		source,
		verifiedAsOf: record.last_verified,
	};
}
