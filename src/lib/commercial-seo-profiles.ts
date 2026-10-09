export interface CommercialSeoProfile {
	title: string;
	description: string;
	lead: string;
}

// Bounded page-level overrides selected from an authenticated, final-state
// Search Console export on 2026-10-09. Raw search metrics stay in the private
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
]);

export function getCommercialSeoProfile(recordId: string): CommercialSeoProfile | null {
	return COMMERCIAL_SEO_PROFILES.get(recordId) ?? null;
}
