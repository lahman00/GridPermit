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
	// Column heading for the "what the source lists" column.
	listsHeading: string;
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
	listsHeading?: string;
	prepare: string[];
	// Internal, same-intent handoffs only; defaults to HANDOFFS. A utility- or
	// pathway-specific entry must list only articles that are valid for it.
	handoffs?: Array<{ href: string; label: string }>;
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
const PERMIT_VS_PTO = { href: "/blog/city-permit-vs-utility-pto/", label: "City permit vs utility interconnection and PTO: why one approval is not the other" };
const HANDOFFS = [
	{ href: "/blog/solarapp-eligibility-2026/", label: "Can this project use SolarAPP+? Battery, panel upgrade and homeowner-install rules" },
	PERMIT_VS_PTO,
];

const REVIEWED: Record<string, ReviewedEntry> = {
	"ca-san-diego-chula-vista-sdge": {
		sourceId: "S1",
		heading: "Who files the solar permit in Chula Vista?",
		answer:
			"The City's current Residential Solar Energy Permits page says all expedited residential solar permits must use SolarAPP+. Its application steps send the applicant through SolarAPP+ and then Citizen Access; that page does not state that the expedited path is limited to licensed contractors. For the standard path, the City separately lists instructions for property owners and contractors.",
		rows: [
			{
				situation: "Expedited residential solar (SolarAPP+)",
				whoFiles: "Applicant uses SolarAPP+ and then Citizen Access",
				whatTheCityLists: "SolarAPP+ unique ID number and forms/plans packet, followed by a Citizen Access application using the \"Solar Permit with Solar App Plus\" option. The City says eligible cookie-cutter permits can be processed instantly.",
				notVerified: "Whether your specific project is SolarAPP+-eligible. The current City page does not state an explicit kW threshold.",
			},
			{
				situation: "Property owner using the standard path",
				whoFiles: "Property owner",
				whatTheCityLists: "Building Permit Application and 2 sets of plans, plus the City's additional project-submittal requirements.",
				notVerified: "Processing time for the standard solar path is not stated on the Residential Solar Energy Permits page.",
			},
			{
				situation: "Contractor using the standard path",
				whoFiles: "Contractor, through Citizen Access",
				whatTheCityLists: "Use Citizen Access and choose the \"Residential Solar Energy – Citizen Access\" application option.",
				notVerified: "Whether the standard path or SolarAPP+ is appropriate for the specific project.",
			},
		],
		prepare: [
			"Ask your installer whether the project will use SolarAPP+ or the standard path and who will be the permit applicant.",
			"If you are filing as the property owner on the standard path, prepare the Building Permit Application and plan set and review the City's current project-submittal requirements.",
			"For inspection, the City lists the approved plans and completed Circuit Card on site, plus an SDG&E Work Order if one applies.",
			"Keep SDG&E interconnection and PTO separate from the City permit.",
		],
		requires: [
			hasDoc("SolarAPP+ unique ID"),
			hasDoc("Building Permit Application"),
			hasDoc("2 sets of plans"),
			(r) => pathway(r).includes("SolarAPP+"),
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
	"ca-los-angeles-pasadena-pwp": {
		sourceId: "S8",
		heading: "Which approval comes first for solar in Pasadena?",
		listsHeading: "What the official source lists",
		answer:
			"Pasadena Water and Power's current Solar Application Instructions say the installer submits the solar application through PowerClerk and PWP completes its Initial Review before the customer proceeds to the City Permit Center for a building permit. The utility review, City permit and later PWP Permission to Operate are separate steps.",
		rows: [
			{
				situation: "Step 1: Solar application to PWP",
				whoFiles: "Installer submits through PWP's PowerClerk system",
				whatTheCityLists: "Single-line diagram, site plan, Net Metering and Surplus Compensation Enrollment Form, signed customer-installer contract, electric bill, the applicable interconnection agreement, billing history or building square footage, and HOA approval if applicable.",
				notVerified: "Any City building-permit fee. PWP's current solar application page does not list that fee.",
			},
			{
				situation: "Step 2: PWP Initial Review",
				whoFiles: "PWP reviews the submitted application",
				whatTheCityLists: "When approved, PowerClerk shows \"Initial Review Completed. Pending Permits/Construction\" and PWP tells the customer they can proceed to the Permit Center.",
				notVerified: "How long Initial Review will take; no review duration is stated on the current page.",
			},
			{
				situation: "Step 3: City building permit and construction",
				whoFiles: "Customer/installer obtains applicable permits from the City Permit Center",
				whatTheCityLists: "After permits are received, the system is installed and the installer obtains Fire and Building & Safety inspection signoffs.",
				notVerified: "The City's own permit document list and City permit fee are not independently verified here.",
			},
			{
				situation: "Step 4: PWP inspection, meter and PTO",
				whoFiles: "PWP completes the utility-side closeout after permit signoffs",
				whatTheCityLists: "PWP inspection, meter replacement, then the Permission to Operate letter. The current solar instructions say PWP inspection occurs within 5-7 business days after permit signoffs.",
				notVerified: "Timing for the City permit or meter-installation stage.",
			},
		],
		prepare: [
			"Ask your installer who will submit the PowerClerk application and make sure the required PWP documents are complete before filing.",
			"Do not apply for the City building permit before PWP Initial Review is complete; PWP's current solar instructions place the Permit Center step after Initial Review approval.",
			"Keep the City permit, Fire/Building inspections and PWP Permission to Operate separate in your project checklist.",
		],
		handoffs: [PERMIT_VS_PTO],
		requires: [
			hasDoc("Single Line Diagram"),
			hasDoc("Net Metering and Surplus Compensation"),
			hasDoc("Copy of customer's electric bill"),
			hasInspection("Initial Review"),
			hasInspection("5-7 business days"),
			(r) => pathway(r).includes("PowerClerk"),
		],
	},
	"ca-riverside-norco-sce": {
		sourceId: "S1",
		heading: "Who can file the solar permit in Norco, and how?",
		answer:
			"The City of Norco's Building & Safety FAQ says that generally only a California licensed contractor or the property owner can pull a permit. For residential solar it lists three ways to apply: in person at City Hall, online through SolarAPP+, or by email. If a project goes through SolarAPP+, the City says the person submitting must first register and complete IREC's one-time SolarAPP+ training.",
		rows: [
			{
				situation: "Property owner pulling the permit",
				whoFiles: "Property owner, in person or by email",
				whatTheCityLists: "Proof of identification, typically a state photo ID. The City's FAQ lists no other paperwork for owners.",
				notVerified: "Whether an owner may submit through SolarAPP+ in Norco. The City ties SolarAPP+ account enablement to jurisdictions \"where you are licensed\", so ask the City.",
			},
			{
				situation: "Licensed contractor",
				whoFiles: "Contractor, in person, by email or through SolarAPP+",
				whatTheCityLists: "California contractor's state license, a current City of Norco business license (including subcontractors) and, for SolarAPP+, the one-time IREC training certificate, with a storage-specific training if batteries are included.",
				notVerified: "Whether your project is eligible for SolarAPP+ review. The City points to SolarAPP+'s own eligibility list.",
			},
		],
		prepare: [
			"Decide with your installer whether they will apply in person, by email or through SolarAPP+, and who the applicant is.",
			"If you apply as the owner, bring proof of identification.",
			"The City says SolarAPP+ technical support, application questions and refund inquiries go to SolarAPP+, not City staff.",
			"Keep the SCE interconnection in mind as a separate step from the City permit.",
		],
		requires: [
			hasDoc("property owner proof of identification"),
			hasDoc("Business License"),
			hasDoc("SolarAPP+ training"),
			(r) => /SolarApp\+/i.test(pathway(r)),
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
		listsHeading: entry.listsHeading ?? "What the City lists",
		prepare: entry.prepare,
		handoffs: entry.handoffs ?? HANDOFFS,
		source,
		verifiedAsOf: record.last_verified,
	};
}
