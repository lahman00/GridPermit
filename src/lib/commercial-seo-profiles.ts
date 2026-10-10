export interface CommercialSeoProfile {
	title: string;
	description: string;
	lead: string;
}

// Bounded page-level overrides selected from an authenticated, final-state
// Search Console exports on 2026-10-09 and 2026-10-11. Raw search metrics stay in the private
// operator evidence store; this public source contains only reviewed copy.
// Every factual phrase below is already supported by the corresponding
// locality record and its official sources.
export const COMMERCIAL_SEO_PROFILES = new Map<string, CommercialSeoProfile>([
	[
		"ca-san-diego-chula-vista-sdge",
		{
			title: "Chula Vista Solar Permit Requirements & SolarAPP+ | GridPermit",
			description:
				"Check Chula Vista residential solar permit paths, SolarAPP+ steps, required documents, inspections, and the separate SDG&E interconnection process.",
			lead: "SolarAPP+ or standard review comes first. SDG&E interconnection and PTO remain separate.",
		},
	],
	[
		"ca-los-angeles-pomona-sce",
		{
			title: "Pomona Solar Permit Requirements & SolarAPP+ | GridPermit",
			description:
				"Check Pomona's SolarAPP+ and Energov path for eligible residential rooftop solar, including the 38.4 kW AC limit, inspections, and SCE PTO.",
			lead: "Eligible contractor-led projects can use SolarAPP+ and Energov. SCE interconnection and PTO remain separate.",
		},
	],
	[
		"ca-riverside-menifee-sce",
		{
			title: "Menifee Solar Permit Requirements & Review Time | GridPermit",
			description:
				"See Menifee solar permit documents, the Permit Portal path, the City's up-to-14-business-day plan review target, inspections, and SCE PTO.",
			lead: "Prepare the City permit package first. SCE interconnection and PTO remain separate.",
		},
	],
	[
		"ca-san-bernardino-chino-hills-sce",
		{
			title: "Chino Hills Solar Permit Fees & Requirements | GridPermit",
			description:
				"See Chino Hills rooftop solar permit steps, SolarAPP+ or plan check, separate fire approval, current City fees, inspections, and SCE PTO.",
			lead: "Choose SolarAPP+ or standard plan check, then obtain separate fire approval. SCE PTO remains separate.",
		},
	],
	[
		"ca-orange-fullerton-sce",
		{
			title: "Fullerton Solar Permit Timeline & SolarAPP+ | GridPermit",
			description:
				"Check Fullerton's residential solar permit paths, SolarAPP+ and EasyDev steps, current review timing, one-inspection rule, and SCE PTO.",
			lead: "Eligible contractors can use SolarAPP+ with EasyDev. SCE interconnection and PTO remain separate.",
		},
	],
	[
		"ca-los-angeles-cerritos-sce",
		{
			title: "Cerritos Solar Permit Paths & Planning Fee | GridPermit",
			description:
				"Compare Cerritos express and standard residential solar permit paths, the $360 City planning fee, LA County building review, inspections, and SCE PTO.",
			lead: "Choose the express or standard City path first. LA County building review is additional, and SCE PTO remains separate.",
		},
	],
	[
		"ca-orange-laguna-beach-sce",
		{
			title: "Laguna Beach Solar Permit Timeline & Requirements | GridPermit",
			description:
				"Check Laguna Beach's small residential rooftop solar permit path, three-business-day decision rule, required plan, inspection, and separate SCE PTO.",
			lead: "Eligible small residential rooftop systems follow the City's expedited path. SCE interconnection and PTO remain separate.",
		},
	],
	[
		"ca-san-bernardino-ontario-sce",
		{
			title: "Ontario Solar Permit Requirements & Instant Review | GridPermit",
			description:
				"Check Ontario's Symbium instant plan-review path for eligible residential rooftop solar, battery conditions, inspections, and separate SCE interconnection.",
			lead: "Eligible residential rooftop projects can use Symbium for real-time plan review. SCE interconnection and PTO remain separate.",
		},
	],
]);

export function getCommercialSeoProfile(recordId: string): CommercialSeoProfile | null {
	return COMMERCIAL_SEO_PROFILES.get(recordId) ?? null;
}
