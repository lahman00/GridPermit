export interface QuickAnswerOption {
	id: "new_rooftop_solar" | "solar_plus_storage" | "not_sure";
	label: string;
	answer: string;
	detail: string;
	href: "#eligibility" | "#overview";
	linkLabel: string;
}

export interface QuickAnswerPilot {
	id: string;
	recordId: string;
	citySlug: string;
	pagePath: string;
	title: string;
	intro: string;
	options: readonly QuickAnswerOption[];
}

// One deliberately bounded pilot selected from authenticated final-state GSC
// evidence on 2026-10-09. The answers repeat only facts already supported by
// Pomona's current locality record and official City/SCE sources. Commercial
// routing stays outside this registry.
export const QUICK_ANSWER_PILOTS = new Map<string, QuickAnswerPilot>([
	[
		"ca-los-angeles-pomona-sce",
		{
			id: "pomona-permit-intent-v1",
			recordId: "ca-los-angeles-pomona-sce",
			citySlug: "pomona",
			pagePath: "/california/pomona/solar-permit-guide/",
			title: "What are you planning in Pomona?",
			intro: "Choose a project type for the verified local starting point. The full permit guide remains available below.",
			options: [
				{
					id: "new_rooftop_solar",
					label: "New rooftop solar",
					answer: "Start with Pomona's SolarAPP+ eligibility check.",
					detail:
						"Eligible licensed-contractor projects on a permitted main dwelling rooftop can use SolarAPP+ and Energov for an auto-issued City permit, up to 38.4 kW AC. SCE interconnection and PTO are separate.",
					href: "#eligibility",
					linkLabel: "Review local eligibility",
				},
				{
					id: "solar_plus_storage",
					label: "Solar plus battery",
					answer: "Check both SolarAPP+ eligibility and fire requirements.",
					detail:
						"Pomona's streamlined scope includes eligible paired storage projects up to 38.4 kW AC. Battery projects are also subject to LA County Fire Department requirements, and SCE approval remains separate.",
					href: "#eligibility",
					linkLabel: "Review battery conditions",
				},
				{
					id: "not_sure",
					label: "Not sure yet",
					answer: "Separate the City permit from the SCE utility step.",
					detail:
						"Pomona handles the permit and inspection. SCE handles interconnection and permission to operate. Use the guide below to check the requirements for each approval.",
					href: "#overview",
					linkLabel: "Compare the two approvals",
				},
			],
		},
	],
]);

export function getQuickAnswerPilot(recordId: string): QuickAnswerPilot | null {
	return QUICK_ANSWER_PILOTS.get(recordId) ?? null;
}
