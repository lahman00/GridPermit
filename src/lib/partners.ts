// Partner control-plane: a single, typed source of truth for every partner
// relationship's real state, so an approved partner can be activated by
// flipping data here rather than hunting through components. Not yet wired
// into InstallerCTA.astro or index.astro — production still uses its
// existing hardcoded EnergySage link. Nothing here changes rendering
// behavior; it exists so the next approval doesn't require re-deriving
// "what do we actually know about this partner."
//
// Full research/evidence trail lives in docs/AFFILIATE_PARTNER_PIPELINE.md.
// Current-state summary (human-readable mirror of this file) lives in
// docs/MONETIZATION_CANONICAL_STATE.md. If the two ever disagree, that's a
// bug — reconcile both in the same commit.

export type PartnerStatus =
	| "discovered"
	| "verified"
	| "contacted"
	| "awaiting_response"
	| "application_started"
	| "owner_action_required"
	| "pending_approval"
	| "approved"
	| "tracking_received"
	| "ready_for_production"
	| "production_active"
	| "rejected"
	| "blocked";

export type PartnerVertical = "solar" | "battery" | "general_home_services";

export type PartnerChannel = "cpl" | "pay_per_call" | "hardware_affiliate" | "general_referral";

export type PayoutType = "per_lead" | "per_call" | "per_sale_percent" | "unknown";

/** Page-intent categories used to gate where a partner's CTA is eligible to render. See docs/MONETIZATION_PLACEMENT_MAP.md. */
export type EligiblePageType =
	| "locality_guide"
	| "state_hub"
	| "county_hub"
	| "utility_hub"
	| "battery_editorial"
	| "blog_general";

export interface Partner {
	id: string;
	name: string;
	status: PartnerStatus;
	vertical: PartnerVertical;
	channel: PartnerChannel;
	/** Current safe destination URL — a tracked affiliate link ONLY if trackingEnabled is true. Empty string when no safe link exists yet. */
	destination: string;
	/** Verified tracking phone number for pay-per-call partners. Undefined until a real number is received — never a placeholder. */
	trackingPhone?: string;
	/** True only once a real, verified, attributable tracking asset (URL or phone) exists — never set from a guess. */
	trackingEnabled: boolean;
	/** True only with documentary evidence of an actual compensation agreement. */
	compensationVerified: boolean;
	/** Whether this partner is allowed to appear anywhere in production at all. */
	placementEligible: boolean;
	disclosureType: "plain_partner" | "affiliate" | "pay_per_call" | "none";
	/**
	 * Manual launch switch. Must default to false and stay false until a human
	 * deliberately flips it after real approval + real tracking arrive. This
	 * is a second, independent gate on top of status/trackingEnabled — see
	 * isLaunchReady(), which requires ALL gates to pass, not just this one.
	 */
	launchEnabled: boolean;
	/** Confirmed business hours during which a pay-per-call campaign is live, e.g. "Monday-Friday, 8:00 AM-8:00 PM EST". Only set when documented by the partner. */
	campaignHours?: string;
	payoutType: PayoutType;
	/** Numeric payout value: dollars for per_lead/per_call, percent for per_sale_percent. Undefined when not independently confirmed — never a guess. */
	payoutValue?: number;
	currency?: "USD";
	cookieDays?: number;
	/** ISO 3166-1 alpha-2 or plain-English geo scope, e.g. "US". */
	geo: string;
	trafficSources: string[];
	eligiblePageTypes: EligiblePageType[];
	/** ISO date this entry's status was last confirmed against a primary source. */
	lastVerified: string;
	notes?: string;
}

const ORGANIC_ONLY: string[] = ["organic_search", "content"];
const SOLAR_CPL_PAGES: EligiblePageType[] = ["locality_guide", "state_hub", "county_hub", "utility_hub"];
const BATTERY_PAGES: EligiblePageType[] = ["battery_editorial", "blog_general"];

export const PARTNERS: Partner[] = [
	{
		id: "energysage",
		name: "EnergySage",
		status: "owner_action_required",
		vertical: "solar",
		channel: "cpl",
		destination: "https://www.energysage.com",
		trackingEnabled: false,
		compensationVerified: false,
		placementEligible: true,
		disclosureType: "plain_partner",
		launchEnabled: false,
		payoutType: "per_lead",
		geo: "US",
		trafficSources: ORGANIC_ONLY,
		eligiblePageTypes: SOLAR_CPL_PAGES,
		lastVerified: "2026-08-25",
		notes: "Channel Partner relationship + CJ advertiser ID 5835771 exist; dedicated /p/gridpermit/ page 404s, current production link is the plain untracked root. CJ program blocked on account activation (Network Profile step or Activate Account button unclear which — see docs/CJ_ACTIVATION_ESCALATION.md), not an EnergySage rejection. Reported ~$10/lead and a 45-day referral window appear on CJ's program page but are not independently confirmed in writing, so payoutValue/cookieDays are left unset. FlexOffers alternate route open, awaiting substantive reply. This is the only live production CTA today.",
	},
	{
		id: "digital-master-media",
		name: "Digital Master Media (DMM)",
		status: "awaiting_response",
		vertical: "solar",
		channel: "pay_per_call",
		destination: "",
		trackingEnabled: false,
		compensationVerified: false,
		placementEligible: false,
		disclosureType: "pay_per_call",
		launchEnabled: false,
		campaignHours: "Monday-Friday, 8:00 AM-8:00 PM EST",
		payoutType: "per_call",
		currency: "USD",
		geo: "US",
		trafficSources: ORGANIC_ONLY,
		eligiblePageTypes: SOLAR_CPL_PAGES,
		lastVerified: "2026-08-25",
		notes: "Direct email 2026-08-24 from Abid Ali confirmed GridPermit is a fit: organic SEO/content accepted, solar qualification threshold 120s post-IVR, nationwide US, Mon-Fri 8AM-8PM EST, first qualified call only, no daily minimum, calls recorded (publisher disclosure required). Public site advertises up to $53/call, but that is not GridPermit's confirmed rate, so payoutValue is left unset. Still missing: GridPermit-specific payout, tracking number, setup instructions, ZIP recommendations, exact IVR logic, disclosure wording, final agreement. See GitHub issue #1.",
	},
	{
		id: "angi",
		name: "Angi",
		status: "rejected",
		vertical: "general_home_services",
		channel: "general_referral",
		destination: "",
		trackingEnabled: false,
		compensationVerified: false,
		placementEligible: false,
		disclosureType: "none",
		launchEnabled: false,
		payoutType: "unknown",
		geo: "US",
		trafficSources: ORGANIC_ONLY,
		eligiblePageTypes: [],
		lastVerified: "2026-08-19",
		notes: 'Angi Affiliate Team confirmed directly: "we do not currently accept solar leads from affiliate partners." Program/vertical mismatch, not a GridPermit-quality judgment. No follow-up.',
	},
	{
		id: "bigbattery",
		name: "BigBattery",
		status: "pending_approval",
		vertical: "battery",
		channel: "hardware_affiliate",
		destination: "",
		trackingEnabled: false,
		compensationVerified: false,
		placementEligible: false,
		disclosureType: "none",
		launchEnabled: false,
		payoutType: "per_sale_percent",
		payoutValue: 5,
		geo: "US",
		trafficSources: ORGANIC_ONLY,
		eligiblePageTypes: BATTERY_PAGES,
		lastVerified: "2026-08-20",
		notes: "Application fully submitted 2026-08-20 with zero fabrication, confirmed via BigBattery's own \"Application received\" message. Awaiting their review, no tracking link yet. Published 5% commission on hardware.",
	},
	{
		id: "power-queen",
		name: "Power Queen",
		status: "awaiting_response",
		vertical: "battery",
		channel: "hardware_affiliate",
		destination: "",
		trackingEnabled: false,
		compensationVerified: false,
		placementEligible: false,
		disclosureType: "none",
		launchEnabled: false,
		payoutType: "per_sale_percent",
		payoutValue: 5.5,
		cookieDays: 30,
		geo: "US",
		trafficSources: ORGANIC_ONLY,
		eligiblePageTypes: BATTERY_PAGES,
		lastVerified: "2026-08-25",
		notes: "Awin blocked (Israel unavailable in Tax Residency dropdown). Non-Awin route confirmed live: GoAffPro direct portal (ipowerqueen.goaffpro.com). Direct inquiry sent 2026-08-25 to service@ipowerqueen.com confirming GoAffPro eligibility and current 5.5%/30-day terms for GridPermit specifically.",
	},
	{
		id: "matchburst",
		name: "MatchBurst",
		status: "blocked",
		vertical: "solar",
		channel: "cpl",
		destination: "",
		trackingEnabled: false,
		compensationVerified: false,
		placementEligible: false,
		disclosureType: "none",
		launchEnabled: false,
		payoutType: "unknown",
		geo: "US",
		trafficSources: ORGANIC_ONLY,
		eligiblePageTypes: [],
		lastVerified: "2026-08-24",
		notes: "Awin blocked (Israel unavailable in Tax Residency dropdown). No non-Awin alternate found — matchburst.com blocks direct fetch (403), no direct/CJ/Impact/FlexOffers/Partnerize path located. Parked until Awin resolves or a genuine alternate surfaces.",
	},
	{
		id: "bark",
		name: "Bark.com",
		status: "blocked",
		vertical: "general_home_services",
		channel: "general_referral",
		destination: "",
		trackingEnabled: false,
		compensationVerified: false,
		placementEligible: false,
		disclosureType: "none",
		launchEnabled: false,
		payoutType: "unknown",
		geo: "US",
		trafficSources: ORGANIC_ONLY,
		eligiblePageTypes: [],
		lastVerified: "2026-08-24",
		notes: "Awin blocked (Israel unavailable in Tax Residency dropdown). No non-Awin alternate found — bark.com's own affiliate page states it runs on Awin. Unconfirmed, untested direct-inquiry contact: pro@bark.us.",
	},
	{
		id: "bluetti",
		name: "Bluetti",
		status: "awaiting_response",
		vertical: "battery",
		channel: "hardware_affiliate",
		destination: "",
		trackingEnabled: false,
		compensationVerified: false,
		placementEligible: false,
		disclosureType: "none",
		launchEnabled: false,
		payoutType: "per_sale_percent",
		payoutValue: 10,
		cookieDays: 30,
		geo: "US",
		trafficSources: ORGANIC_ONLY,
		eligiblePageTypes: BATTERY_PAGES,
		lastVerified: "2026-08-25",
		notes: "Awin blocked (Israel unavailable in Tax Residency dropdown). Non-Awin alternate confirmed live: Impact.com (app.impact.com/advertiser-advertiser-info/bluettius.brand). Its CJ option requires an active CJ account, the same wall as EnergySage, so is not a real alternate. Direct outreach sent 2026-08-25 to marketing@bluetti.com. Published terms: up to 10% commission, 30-day cookie.",
	},
	{
		id: "ecoflow",
		name: "EcoFlow",
		status: "awaiting_response",
		vertical: "battery",
		channel: "hardware_affiliate",
		destination: "",
		trackingEnabled: false,
		compensationVerified: false,
		placementEligible: false,
		disclosureType: "none",
		launchEnabled: false,
		payoutType: "per_sale_percent",
		payoutValue: 5,
		cookieDays: 7,
		geo: "US",
		trafficSources: ORGANIC_ONLY,
		eligiblePageTypes: BATTERY_PAGES,
		lastVerified: "2026-08-25",
		notes: "Awin blocked (Israel unavailable in Tax Residency dropdown). Non-Awin alternate confirmed live: Impact.com (app.impact.com/advertiser-advertiser-info/EcoFlow-Technology-Inc.brand). Same CJ-gate caveat as Bluetti applies to its CJ option. Direct outreach sent 2026-08-25 to affiliate@ecoflow.com. Published terms: minimum 5% commission, 7-day cookie (US-specific confirmation still pending).",
	},
	{
		id: "allpowers",
		name: "ALLPOWERS",
		status: "awaiting_response",
		vertical: "battery",
		channel: "hardware_affiliate",
		destination: "",
		trackingEnabled: false,
		compensationVerified: false,
		placementEligible: false,
		disclosureType: "none",
		launchEnabled: false,
		payoutType: "per_sale_percent",
		payoutValue: 5,
		cookieDays: 30,
		geo: "US",
		trafficSources: ORGANIC_ONLY,
		eligiblePageTypes: BATTERY_PAGES,
		lastVerified: "2026-08-25",
		notes: "Awin blocked (Israel unavailable in Tax Residency dropdown). Non-Awin alternate confirmed live: GoAffPro direct portal (allpowers.goaffpro.com); CJ/AvantLink also listed but CJ carries the same active-account wall as EnergySage. Direct outreach sent 2026-08-25 to marketing@allpowers.com. Published terms: 5% base commission with tiers up to 10%, 30-day cookie.",
	},
	{
		id: "redodo",
		name: "Redodo",
		status: "owner_action_required",
		vertical: "battery",
		channel: "hardware_affiliate",
		destination: "",
		trackingEnabled: false,
		compensationVerified: false,
		placementEligible: false,
		disclosureType: "none",
		launchEnabled: false,
		payoutType: "unknown",
		geo: "US",
		trafficSources: ORGANIC_ONLY,
		eligiblePageTypes: BATTERY_PAGES,
		lastVerified: "2026-08-24",
		notes: "Real LiFePO4/battery brand (redodopower.com). Not Awin-dependent: GoAffPro direct portal (redodopower.goaffpro.com) confirmed live. A separate Awin listing and a Germany-only Webgains listing also exist but neither is needed. No outreach sent yet — next step is owner account creation on GoAffPro.",
	},
	{
		id: "easunpower",
		name: "EASUNPOWER",
		status: "awaiting_response",
		vertical: "battery",
		channel: "hardware_affiliate",
		destination: "",
		trackingEnabled: false,
		compensationVerified: false,
		placementEligible: false,
		disclosureType: "none",
		launchEnabled: false,
		payoutType: "per_sale_percent",
		payoutValue: 5,
		geo: "US",
		trafficSources: ORGANIC_ONLY,
		eligiblePageTypes: BATTERY_PAGES,
		lastVerified: "2026-08-25",
		notes: "Primary source: easunpower.com/pages/easunpower-affiliate-program. Direct email application to avy@easunpower.com; explicitly accepts bloggers/content creators/website owners; 5% commission on confirmed orders. Outreach sent 2026-08-25 asking to confirm SEO/content publisher eligibility, US-audience eligibility, cookie window, minimum traffic/sales requirements, and payment methods.",
	},
	{
		id: "vatrer-power",
		name: "Vatrer Power",
		status: "awaiting_response",
		vertical: "battery",
		channel: "hardware_affiliate",
		destination: "",
		trackingEnabled: false,
		compensationVerified: false,
		placementEligible: false,
		disclosureType: "none",
		launchEnabled: false,
		payoutType: "unknown",
		geo: "US",
		trafficSources: ORGANIC_ONLY,
		eligiblePageTypes: BATTERY_PAGES,
		lastVerified: "2026-08-25",
		notes: "Official program confirmed on vatrerpower.com, hosted on UpPromote. Website/blog/newsletter promotion explicitly supported. Public US affiliate contact: brand@vatrerpower.com. Outreach sent 2026-08-25 asking for current US commission, attribution window, restrictions, and payment methods.",
	},
	{
		id: "litime",
		name: "LiTime",
		status: "owner_action_required",
		vertical: "battery",
		channel: "hardware_affiliate",
		destination: "",
		trackingEnabled: false,
		compensationVerified: false,
		placementEligible: false,
		disclosureType: "none",
		launchEnabled: false,
		payoutType: "per_sale_percent",
		payoutValue: 5,
		geo: "US",
		trafficSources: ORGANIC_ONLY,
		eligiblePageTypes: BATTERY_PAGES,
		lastVerified: "2026-08-25",
		notes: "Official program confirmed on litime.com; website owners/bloggers explicitly eligible; public page advertises up to 5% commission. Non-Awin routes explicitly available through GoAffPro and Impact. No outreach sent yet — next step is owner account creation.",
	},
	{
		id: "rich-solar",
		name: "RICH SOLAR",
		status: "awaiting_response",
		vertical: "battery",
		channel: "hardware_affiliate",
		destination: "",
		trackingEnabled: false,
		compensationVerified: false,
		placementEligible: false,
		disclosureType: "none",
		launchEnabled: false,
		payoutType: "unknown",
		geo: "US",
		trafficSources: ORGANIC_ONLY,
		eligiblePageTypes: BATTERY_PAGES,
		lastVerified: "2026-08-25",
		notes: "Official site states content sites can participate. Strong product fit: solar kits, batteries, inverters, panels, system components. Outreach sent 2026-08-25 to support@richsolar.com asking to route to affiliate management and confirm eligibility, commission, attribution window, platform, and restrictions.",
	},
	{
		id: "current-connected",
		name: "Current Connected",
		status: "rejected",
		vertical: "battery",
		channel: "hardware_affiliate",
		destination: "",
		trackingEnabled: false,
		compensationVerified: false,
		placementEligible: false,
		disclosureType: "none",
		launchEnabled: false,
		payoutType: "unknown",
		geo: "US_CA_residents_only",
		trafficSources: ORGANIC_ONLY,
		eligiblePageTypes: [],
		lastVerified: "2026-08-25",
		notes: "Strong content/product fit in isolation (solar, batteries, inverters, generators; average affiliate commission stated as 8%), but the program's own eligibility page restricts applicants to US/Canada residents and requires W-9/payment info. GridPermit does not meet the residency requirement. Do not re-apply unless published eligibility changes.",
	},
	{
		id: "profitise",
		name: "Profitise",
		status: "awaiting_response",
		vertical: "solar",
		channel: "cpl",
		destination: "",
		trackingEnabled: false,
		compensationVerified: false,
		placementEligible: false,
		disclosureType: "none",
		launchEnabled: false,
		payoutType: "unknown",
		geo: "US",
		trafficSources: ORGANIC_ONLY,
		eligiblePageTypes: [],
		lastVerified: "2026-08-15",
		notes: "Inquiry sent per user report (not independently verified by this environment, no email access to check for a reply). Awaiting response; do not duplicate outreach.",
	},
];

/**
 * The single fail-closed launch gate. Every condition must hold — status
 * approved, tracking confirmed, placement eligible, AND the manual
 * launchEnabled switch flipped, AND a real destination or phone number
 * present — before a partner is allowed to render anywhere in production.
 * Any one missing condition fails the whole check closed.
 */
export function isLaunchReady(partner: Partner): boolean {
	const hasRealTrackingAsset = partner.destination.length > 0 || Boolean(partner.trackingPhone);
	return (
		partner.status === "approved" &&
		partner.trackingEnabled === true &&
		partner.placementEligible === true &&
		partner.launchEnabled === true &&
		hasRealTrackingAsset
	);
}

/** Partners actually allowed to render in production today. Expected to be empty until a real approved tracking link exists — that emptiness is itself the correct, tested state. */
export function getActivePartners(): Partner[] {
	return PARTNERS.filter(isLaunchReady);
}

export function getPartnersByChannel(channel: PartnerChannel): Partner[] {
	return PARTNERS.filter((p) => p.channel === channel);
}

export function getPartner(id: string): Partner | undefined {
	return PARTNERS.find((p) => p.id === id);
}

/**
 * The single entry point CTA components should use to decide whether to
 * render at all. Returns the partner only when isLaunchReady() passes AND
 * (if given) the channel matches what the calling component expects — e.g.
 * PayPerCallCTA.astro must never accidentally render for a hardware
 * affiliate entry. Returns null in every other case, which the calling
 * component must treat as "render nothing."
 */
export function getLaunchReadyPartner(id: string, expectedChannel?: PartnerChannel): Partner | null {
	const partner = getPartner(id);
	if (!partner) return null;
	if (expectedChannel && partner.channel !== expectedChannel) return null;
	if (!isLaunchReady(partner)) return null;
	return partner;
}

export type CplState = "UNTRACKED_RELATIONSHIP" | "TRACKED_UNCONFIRMED_COMPENSATION" | "APPROVED_CPL" | "ACTIVE_CPL";

/**
 * Classifies a CPL/referral partner's relationship into exactly one of four
 * states, so a CTA component can render the right copy from state rather
 * than from hand-written prose that has to be edited every time the
 * underlying relationship changes (see docs/MONETIZATION_CANONICAL_STATE.md,
 * Phase 7). Moving from one real state to the next is a data change in this
 * file, never a copy rewrite in the component.
 */
export function getCplState(partner: Partner): CplState {
	if (isLaunchReady(partner)) return "ACTIVE_CPL";
	if (partner.status === "approved" && partner.trackingEnabled && partner.compensationVerified) return "APPROVED_CPL";
	if (partner.trackingEnabled) return "TRACKED_UNCONFIRMED_COMPENSATION";
	return "UNTRACKED_RELATIONSHIP";
}

/** Disclosure copy for a given CplState. Only ever describes what's actually true for that state. */
export function getCplDisclosureText(state: CplState, partnerName: string): string {
	switch (state) {
		case "ACTIVE_CPL":
			return "This link may earn GridPermit a commission at no additional cost to you.";
		case "APPROVED_CPL":
			return `GridPermit has an approved partnership with ${partnerName}; tracking is not yet live on this link.`;
		case "TRACKED_UNCONFIRMED_COMPENSATION":
			return "This link is tracked; whether it results in compensation to GridPermit has not yet been confirmed.";
		case "UNTRACKED_RELATIONSHIP":
		default:
			return `GridPermit has a partner relationship with ${partnerName}; this link is not currently tracked, and whether the partnership results in compensation to GridPermit has not yet been confirmed.`;
	}
}

/**
 * Derives disclosure copy from a partner's actual verified state rather than
 * hardcoding prose per partner — see docs/MONETIZATION_CANONICAL_STATE.md
 * and the disclosure taxonomy in docs/MONETIZATION_PLACEMENT_MAP.md. Only
 * ever describes what's actually true; never asserts compensation, tracking,
 * or approval that hasn't been verified.
 */
export function getDisclosureText(partner: Partner): string {
	if (partner.disclosureType === "none") return "";

	if (partner.disclosureType === "pay_per_call") {
		return "Calls may be recorded for quality and compliance purposes.";
	}

	if (partner.disclosureType === "affiliate" && partner.compensationVerified && partner.trackingEnabled) {
		return "This link may earn GridPermit a commission at no additional cost to you.";
	}

	if (partner.trackingEnabled && !partner.compensationVerified) {
		return "This link is tracked; whether it results in compensation to GridPermit has not yet been confirmed.";
	}

	return "GridPermit may have a commercial relationship with some third-party services; this link is not currently tracked for compensation.";
}
