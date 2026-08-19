// Partner control-plane: a single, typed source of truth for every partner
// relationship's real state, so an approved partner can be activated by
// flipping data here rather than hunting through components. This is
// intentionally NOT yet wired into InstallerCTA.astro or index.astro —
// production still uses its existing hardcoded EnergySage link. Nothing
// here changes rendering behavior; it exists so the next approval doesn't
// require re-deriving "what do we actually know about this partner."
//
// Full research/evidence trail lives in docs/AFFILIATE_PARTNER_PIPELINE.md
// — this file holds only the current-state fields needed to gate what's
// allowed to render, not the narrative.

export type PartnerStatus =
	| "researched"
	| "needs_verification"
	| "owner_action_required"
	| "contacted"
	| "waiting_for_network"
	| "pending_approval"
	| "approved"
	| "rejected";

export type PartnerVertical = "solar" | "battery" | "general_home_services";

export interface Partner {
	id: string;
	name: string;
	status: PartnerStatus;
	vertical: PartnerVertical;
	/** Current safe destination URL — a tracked affiliate link ONLY if trackingEnabled is true. */
	destination: string;
	/** True only once a real, verified, attributable tracking URL exists — never set from a guess. */
	trackingEnabled: boolean;
	/** True only with documentary evidence of an actual compensation agreement. */
	compensationVerified: boolean;
	/** Whether this partner is allowed to appear anywhere in production at all. */
	placementEligible: boolean;
	disclosureType: "plain_partner" | "affiliate" | "none";
	/** ISO date this entry's status was last confirmed against a primary source. */
	lastVerified: string;
	notes?: string;
}

export const PARTNERS: Partner[] = [
	{
		id: "energysage",
		name: "EnergySage",
		status: "owner_action_required",
		vertical: "solar",
		destination: "https://www.energysage.com",
		trackingEnabled: false,
		compensationVerified: false,
		placementEligible: true,
		disclosureType: "plain_partner",
		lastVerified: "2026-08-20",
		notes: "Channel Partner relationship + CJ advertiser ID 5835771 exist; dedicated /p/gridpermit/ page 404s, CJ program blocked on Payoneer/payment onboarding. This is the only live production CTA today.",
	},
	{
		id: "angi",
		name: "Angi",
		status: "rejected",
		vertical: "general_home_services",
		destination: "",
		trackingEnabled: false,
		compensationVerified: false,
		placementEligible: false,
		disclosureType: "none",
		lastVerified: "2026-08-19",
		notes: 'Angi Affiliate Team confirmed directly: "we do not currently accept solar leads from affiliate partners." Program/vertical mismatch, not a GridPermit-quality judgment. No follow-up.',
	},
	{
		id: "bigbattery",
		name: "BigBattery",
		status: "owner_action_required",
		vertical: "battery",
		destination: "",
		trackingEnabled: false,
		compensationVerified: false,
		placementEligible: false,
		disclosureType: "none",
		lastVerified: "2026-08-20",
		notes: "Application step 1 completed with zero fabrication (niche checkbox only); remaining steps blocked by browser-automation tooling instability this pass, not by BigBattery or a password/payment wall.",
	},
	{
		id: "power-queen",
		name: "Power Queen",
		status: "owner_action_required",
		vertical: "battery",
		destination: "",
		trackingEnabled: false,
		compensationVerified: false,
		placementEligible: false,
		disclosureType: "none",
		lastVerified: "2026-08-20",
		notes: "Real Awin merchant 118441 re-confirmed live. Requires an Awin publisher account (password-gated) — same account as the rest of the Awin cluster below.",
	},
	{
		id: "matchburst",
		name: "MatchBurst",
		status: "owner_action_required",
		vertical: "solar",
		destination: "",
		trackingEnabled: false,
		compensationVerified: false,
		placementEligible: false,
		disclosureType: "none",
		lastVerified: "2026-08-20",
		notes: "Real Awin merchant 114854 re-confirmed live, US-only traffic. Same Awin account blocker as Power Queen — consolidated, not a separate account.",
	},
	{
		id: "bark",
		name: "Bark.com",
		status: "owner_action_required",
		vertical: "general_home_services",
		destination: "",
		trackingEnabled: false,
		compensationVerified: false,
		placementEligible: false,
		disclosureType: "none",
		lastVerified: "2026-08-20",
		notes: "Re-confirmed live: up to $100/project, 30-day cookie, content producers explicitly eligible. Same Awin account blocker as Power Queen/MatchBurst.",
	},
	{
		id: "bluetti",
		name: "Bluetti",
		status: "owner_action_required",
		vertical: "battery",
		destination: "",
		trackingEnabled: false,
		compensationVerified: false,
		placementEligible: false,
		disclosureType: "none",
		lastVerified: "2026-08-20",
		notes: "Re-confirmed live: up to 10% commission, 30-day cookie, network choice of Impact/Awin/CJ. Awin route shares the same account as the rest of this cluster.",
	},
	{
		id: "ecoflow",
		name: "EcoFlow",
		status: "owner_action_required",
		vertical: "battery",
		destination: "",
		trackingEnabled: false,
		compensationVerified: false,
		placementEligible: false,
		disclosureType: "none",
		lastVerified: "2026-08-20",
		notes: "Re-confirmed live: minimum 5% commission, 7-day cookie, network choice including Awin.",
	},
	{
		id: "allpowers",
		name: "ALLPOWERS",
		status: "owner_action_required",
		vertical: "battery",
		destination: "",
		trackingEnabled: false,
		compensationVerified: false,
		placementEligible: false,
		disclosureType: "none",
		lastVerified: "2026-08-20",
		notes: "Re-confirmed live: 5%+ up to 10% tiered, 30-day cookie, explicitly welcomes review/comparison sites. Network choice includes Awin.",
	},
	{
		id: "profitise",
		name: "Profitise",
		status: "contacted",
		vertical: "solar",
		destination: "",
		trackingEnabled: false,
		compensationVerified: false,
		placementEligible: false,
		disclosureType: "none",
		lastVerified: "2026-08-15",
		notes: "Inquiry sent per user report (not independently verified by this environment — no email access to check for a reply). Awaiting response; do not duplicate outreach.",
	},
];

/** Partners actually allowed to render in production today. Expected to be empty until a real approved tracking link exists — that emptiness is itself the correct, tested state. */
export function getActivePartners(): Partner[] {
	return PARTNERS.filter(
		(p) => p.status === "approved" && p.trackingEnabled && p.placementEligible && p.destination.length > 0,
	);
}

export function getPartner(id: string): Partner | undefined {
	return PARTNERS.find((p) => p.id === id);
}
