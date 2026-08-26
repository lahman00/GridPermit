// Partner control-plane: a single, typed source of truth for every partner
// relationship's real state. Production CTA components read from this registry
// and fail closed unless approval, tracking, placement eligibility, and the
// manual launch switch all agree. Current-state narrative lives in
// docs/MONETIZATION_CANONICAL_STATE.md. If the two ever disagree, that's a
// bug: reconcile both in the same commit.

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
	/**
	 * Verified list of eligible service ZIP codes for a pay-per-call/CPL
	 * partner whose coverage is narrower than statewide, when the partner has
	 * actually published or confirmed one. Undefined means no ZIP-level
	 * restriction is known (not the same as "nationwide confirmed") — a
	 * partner-specific geo check (see src/lib/partner-routing.ts) should be
	 * used instead of guessing from this field alone if real ZIP data exists.
	 */
	eligibleZips?: string[];
	/**
	 * Verbatim, partner-specific required disclosure text that overrides the
	 * generic disclosureType templates in getDisclosureText(), for partners
	 * whose compliance rules are stricter or more specific than the generic
	 * categories below (e.g. a required "independent service provider,
	 * calls may be recorded" combination, or a ban on certain claim words
	 * that the generic templates don't need to worry about). Only ever set
	 * from the partner's own actually-published or actually-confirmed
	 * requirement — never invented.
	 */
	requiredDisclosureText?: string;
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
		notes: "Channel Partner relationship + CJ advertiser ID 5835771 exist; dedicated /p/gridpermit/ page 404s and current production link is the plain untracked root. CJ sent official publisher-account activation confirmation on 2026-08-25, so the network-level activation blocker is cleared. Remaining owner action: open EnergySage in CJ, review current live terms and submit Apply/Join. No advertiser approval or tracking link exists yet. Reported ~$10/approved lead and 45-day referral window must be re-read on the current CJ program page before relying on them. FlexOffers publisher registration fully submitted 2026-08-25 (site ownership verified via the fo-verify meta tag on the homepage); FlexOffers said review takes up to 5 business days. EnergySage is confirmed to currently be in the FlexOffers network, but its advertiser-specific program has not been opened or applied to yet, since that requires the FlexOffers publisher account to be approved first.",
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
		notes: "Direct email 2026-08-24 from Abid Ali confirmed GridPermit is a fit: organic SEO/content accepted, solar qualification threshold 120s post-IVR, nationwide US, Mon-Fri 8AM-8PM EST, first qualified call only, no daily minimum, calls recorded and publisher disclosure required. Public site advertises up to $53/call, but that is not GridPermit's confirmed rate, so payoutValue remains unset. A standalone follow-up was successfully sent 2026-08-25 requesting GridPermit-specific payout, tracking number/setup, ZIP guidance, exact IVR logic, disclosure wording, final agreement/compliance and other launch requirements. Awaiting response; see GitHub issue #1.",
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
		notes: "Application fully submitted 2026-08-20 with zero fabrication, confirmed via BigBattery's own 'Application received' message. Awaiting review, no tracking link yet. Published 5% commission on hardware.",
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
		notes: "Awin blocked. Non-Awin route confirmed live: GoAffPro direct portal (ipowerqueen.goaffpro.com). Direct inquiry sent 2026-08-25 to service@ipowerqueen.com confirming GoAffPro eligibility and current 5.5%/30-day terms for GridPermit specifically.",
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
		notes: "Awin blocked and no non-Awin alternate found. matchburst.com blocks direct fetch and no direct/CJ/Impact/FlexOffers/Partnerize path has been verified. Park until a genuine alternate surfaces.",
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
		notes: "Awin blocked. Bark's own affiliate page states it runs on Awin and no verified non-Awin publisher route has been found.",
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
		notes: "Non-Awin alternate confirmed live: Impact.com. Direct outreach sent 2026-08-25 to marketing@bluetti.com. Published terms: up to 10% commission, 30-day cookie. No approval or tracking link yet.",
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
		geo: "US",
		trafficSources: ORGANIC_ONLY,
		eligiblePageTypes: BATTERY_PAGES,
		lastVerified: "2026-08-25",
		notes: "Impact.com alternate is confirmed live and direct outreach was sent 2026-08-25 to affiliate@ecoflow.com. Regional EcoFlow affiliate pages publish differing commission/cookie economics; those must not be imported into the U.S. entry. payoutValue/cookieDays intentionally remain unset until U.S.-specific confirmation arrives.",
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
		notes: "Non-Awin routes confirmed live: GoAffPro direct, CJ and AvantLink. Direct outreach sent 2026-08-25 to marketing@allpowers.com. Published terms: 5% base with tiers up to 10%, 30-day cookie. No approval/tracking yet.",
	},
	{
		id: "redodo",
		name: "Redodo",
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
		notes: "U.S. site confirms a GoAffPro Program exists alongside Awin. Direct inquiry sent 2026-08-25 to official service@redodopower.com asking GridPermit U.S. GoAffPro eligibility, SEO/editorial acceptance, current commission/cookie, deep-link support, restrictions and disclosures. Wait for reply before account creation.",
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
		notes: "Primary source: easunpower.com/pages/easunpower-affiliate-program. Direct email program explicitly accepts bloggers/content creators/website owners; published 5% on confirmed orders. Outreach sent 2026-08-25 to avy@easunpower.com asking SEO/content eligibility, U.S.-audience eligibility, cookie window, minimums and payment methods.",
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
		notes: "Official program confirmed on vatrerpower.com and hosted on UpPromote. Website/blog/newsletter promotion explicitly supported. Outreach sent 2026-08-25 to brand@vatrerpower.com asking current U.S. commission, attribution window, restrictions and payment methods.",
	},
	{
		id: "litime",
		name: "LiTime",
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
		notes: "Official program explicitly welcomes bloggers and website owners and lists GoAffPro, Impact and Awin; public page advertises up to 5% commission. Direct inquiry sent 2026-08-25 to service@litime.com asking international publisher eligibility for U.S. traffic, SEO/editorial acceptance, preferred GoAffPro vs Impact route, actual base/tier commission, cookie window, restrictions and disclosures.",
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
		notes: "Official site states content sites can participate. Strong product fit: solar kits, batteries, inverters, panels and system components. Outreach sent 2026-08-25 to support@richsolar.com; automated case #8058 received, no substantive affiliate answer yet.",
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
		notes: "Strong content/product fit in isolation, but the program's own eligibility page restricts applicants to U.S./Canada residents and requires W-9/payment information. Do not re-apply unless published eligibility changes.",
	},
	{
		id: "anker-solix",
		name: "Anker SOLIX",
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
		notes: "Primary source explicitly lists forums/blogs/product-review websites as allowed channels. Routes via LinkShare or Impact, avoiding Awin. Published 5% commission and 30-day cookie. Outreach sent 2026-08-24 to affiliate@anker.com; no reply yet.",
	},
	{
		id: "goal-zero",
		name: "Goal Zero",
		status: "verified",
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
		notes: "Primary source: Goal Zero Affiliate Marketing Program. Managed by Partnerize; businesses have a dedicated apply route. Dynamic commission up to 10%, 30-day cookie. Requires owner/account application action; no tracking link exists.",
	},
	{
		id: "signature-solar",
		name: "Signature Solar",
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
		payoutValue: 9,
		cookieDays: 7,
		geo: "US",
		trafficSources: ORGANIC_ONLY,
		eligiblePageTypes: BATTERY_PAGES,
		lastVerified: "2026-08-25",
		notes: "Direct in-house program, up to 9% depending on product, 7-day cookie, no minimum sales requirement; official page says international referrals can earn compensation. GridPermit outreach was already sent 2026-08-24 to support@signaturesolar.com. Await reply or owner direct application.",
	},
	{
		id: "natures-generator",
		name: "Nature's Generator",
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
		notes: "Official affiliate page publishes 5% and tells affiliates to create a free ShareASale account, but the same page also references Awin. Outreach sent 2026-08-25 to support@naturesgenerator.com asking GridPermit eligibility, SEO/editorial acceptance, current preferred U.S. route, 5% applicability, cookie window, restrictions and disclosures.",
	},
	{
		id: "sungoldpower",
		name: "SunGoldPower",
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
		payoutValue: 6,
		geo: "US",
		trafficSources: ORGANIC_ONLY,
		eligiblePageTypes: BATTERY_PAGES,
		lastVerified: "2026-08-25",
		notes: "Primary source publishes a ShareASale route (Merchant ID 107752), 6% commission and stated AOV around $1,000. GridPermit outreach sent 2026-08-24 to sales@sungoldpower.com; no reply yet. Cookie window not confirmed.",
	},
	{
		id: "zendure",
		name: "Zendure",
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
		cookieDays: 30,
		geo: "US",
		trafficSources: ORGANIC_ONLY,
		eligiblePageTypes: BATTERY_PAGES,
		lastVerified: "2026-08-25",
		notes: "Impact route exists. Official page states both 'up to 5%' and 'up to 10%' in different sections, so payoutValue deliberately remains unset. 30-day cookie published. Outreach sent 2026-08-24 to sales_us@zendure.com; no reply yet.",
	},
	{
		id: "growatt",
		name: "Growatt",
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
		payoutValue: 15,
		geo: "US",
		trafficSources: ORGANIC_ONLY,
		eligiblePageTypes: BATTERY_PAGES,
		lastVerified: "2026-08-25",
		notes: "Primary source explicitly accepts content creators, publishers, installers and affiliate marketers; offers PartnerBoost/direct/Awin routes and publishes 15%-20% on qualifying sales. payoutValue records only the lower bound, not a GridPermit-approved rate. Outreach sent 2026-08-25 to official marketing.pps@growatt.com asking fit, preferred U.S. route, cookie, tier rules and restrictions.",
	},
	{
		id: "eco-worthy",
		name: "ECO-WORTHY",
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
		notes: "Official U.S. affiliate page lists Impact/Awin, 5% commission and 30-day cookie. Outreach sent 2026-08-25 to service@eco-worthy.com asking GridPermit publisher eligibility, SEO/editorial acceptance, Impact preference, current terms, restrictions and disclosure requirements.",
	},
	{
		id: "powerness",
		name: "Powerness",
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
		notes: "Official affiliate page welcomes media publishers and review/ranking sites, uses ShareASale, publishes 5% and prohibits PPC. The same official page conflicts on cookie duration: 45 days in the summary vs 30 days later, so cookieDays remains unset. Outreach sent 2026-08-25 to service@powerness.com asking for clarification and GridPermit fit.",
	},
	{
		id: "acopower",
		name: "ACOPOWER",
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
		notes: "Official ACOPOWER pages conflict materially: AvantLink/8%/30 days on one page, ShareASale/8% on another, 6% on another, while a direct agreement describes ACOPOWER Credits and prohibits SEM/PPC. Clarification inquiry sent 2026-08-25 to support@acopower.com. Leave payoutValue/cookieDays unset until ACOPOWER resolves platform, rate and payout form.",
	},
	{
		id: "wattcycle",
		name: "WattCycle",
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
		notes: "Official U.S. site has a live Affiliate page and publishes marketing@wattcycle.com as PR & Influencer contact, but public crawl does not expose usable commission/platform/cookie terms. Outreach sent 2026-08-25 asking publisher fit, SEO/editorial acceptance, platform, commission, cookie, deep links, restrictions and disclosures.",
	},
	{
		id: "sok-battery",
		name: "SOK Battery",
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
		notes: "Official U.S. site exposes an Affiliate Programme navigation entry and official sales@sokbattery.com contact; products include LiFePO4 batteries and solar storage. Public crawl does not expose affiliate commercial terms. Outreach sent 2026-08-25 asking publisher eligibility, SEO/editorial acceptance, platform, commission, cookie, deep links, restrictions and disclosures.",
	},
	{
		id: "shopsolar",
		name: "ShopSolar",
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
		notes: "Official shopsolarkits.com Affiliate Program link redirects to a ShopSolar-branded GoAffPro signup. Strong fit: complete solar kits, batteries, inverters, portable power and permit-adjacent system content. Outreach sent 2026-08-25 to official info@shopsolarkits.com asking independent publisher eligibility, SEO/editorial acceptance, current GoAffPro status, commission, cookie, deep links, restrictions and disclosures.",
	},
	{
		id: "jackery",
		name: "Jackery",
		status: "discovered",
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
		eligiblePageTypes: [],
		lastVerified: "2026-08-25",
		notes: "Program page exists, but commission, cookie window, network and geo restrictions could not be verified from a primary automated fetch. Needs manual verification before any new outreach.",
	},
	{
		id: "modernize",
		name: "Modernize",
		status: "discovered",
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
		lastVerified: "2026-08-25",
		notes: "Program page returned HTTP 403 on direct fetch, so terms could not be independently verified from a primary source. Third-party synthesis is explicitly insufficient. Do not contact until verified.",
	},
	{
		id: "segway-power",
		name: "Segway (portable power)",
		status: "discovered",
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
		eligiblePageTypes: [],
		lastVerified: "2026-08-25",
		notes: "Program URL exists, but automated fetch did not confirm whether the portable-power line is commissionable. Verify product scope and terms before outreach.",
	},
	{
		id: "oukitel-power",
		name: "Oukitel Power",
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
		geo: "US",
		trafficSources: ORGANIC_ONLY,
		eligiblePageTypes: [],
		lastVerified: "2026-08-25",
		notes: "Primary source lists Awin as the only network route and no non-Awin alternate has been found. Do not pursue unless an alternate surfaces.",
	},
	{
		id: "battle-born-batteries",
		name: "Battle Born Batteries",
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
		geo: "US",
		trafficSources: ORGANIC_ONLY,
		eligiblePageTypes: [],
		lastVerified: "2026-08-25",
		notes: "No live affiliate program page could be confirmed. Do not pursue without a live primary program page.",
	},
	{
		id: "mighty-max-battery",
		name: "Mighty Max Battery",
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
		geo: "US",
		trafficSources: ORGANIC_ONLY,
		eligiblePageTypes: [],
		lastVerified: "2026-08-25",
		notes: "Indexed references suggest a program may have existed, but current affiliate URLs return 404. Do not pursue until a live page is confirmed.",
	},
	{
		id: "adt-solar",
		name: "ADT Solar",
		status: "rejected",
		vertical: "solar",
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
		lastVerified: "2026-08-25",
		notes: "Consumer/homeowner refer-a-friend structure, not a content-publisher affiliate channel. Wrong program type for GridPermit.",
	},
	{
		id: "renogy",
		name: "Renogy",
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
		payoutValue: 6,
		cookieDays: 27,
		geo: "US",
		trafficSources: ORGANIC_ONLY,
		eligiblePageTypes: BATTERY_PAGES,
		lastVerified: "2026-08-25",
		notes: "Direct 2026-08-25 email from Renogy Affiliate Team: GridPermit is a great fit; international publishers welcome when primary focus/target audience are U.S.-based; organic search/editorial accepted; residential solar/battery permitting guides described as ideal contextual placements; current U.S. rate 6%; attribution 27 days; no paid-search bidding on Renogy brand terms. GridPermit replied requesting preferred Impact application/invitation route and official media assets. No platform approval/tracking yet; do not send another follow-up until Renogy responds.",
	},
	{
		id: "bougerv",
		name: "BougeRV",
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
		payoutValue: 7,
		geo: "US",
		trafficSources: ORGANIC_ONLY,
		eligiblePageTypes: BATTERY_PAGES,
		lastVerified: "2026-08-25",
		notes: "Direct email from BougeRV Affiliate Manager confirmed independent content publishers, organic/editorial traffic and contextual links in solar/battery/home-energy content are accepted. U.S. routes: Impact or Awin. Standard commission directly confirmed at 7%; potential adjustments are not recorded until documented. Deep links available after platform approval. GridPermit replied requesting preferred Impact application/invitation link. No platform approval/tracking yet; do not send another follow-up until reply.",
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
		lastVerified: "2026-08-25",
		notes: "Inquiry and follow-up have been sent. Gmail is available in the current environment; a 2026-08-25 sweep found no substantive Profitise reply. Awaiting response; do not duplicate outreach.",
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

	// A partner's own confirmed compliance language always wins over the
	// generic categorized templates below — never overridden or paraphrased.
	if (partner.requiredDisclosureText) return partner.requiredDisclosureText;

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
