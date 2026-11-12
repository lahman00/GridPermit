// California Energy Commission (CEC) Residential Solar Permit Program Status
// Dashboard data, stored in data/cec/. Each jurisdiction self-reports its
// SB 379 platform status; the CEC does not certify compliance. This module
// only looks a city up by name and labels the status; it never infers one.

export type CecRawStatus = "SolarAPP+ Platform" | "Symbium Platform" | "Custom Platform" | "Without Platform" | "Exempt";
export type CecLabel = "SolarAPP+" | "Symbium" | "Custom platform" | "No platform reported" | "Exempt";

export interface CecJurisdiction {
	jurisdiction: string;
	name: string;
	types: string[];
	status: string;
	sb379_deadline: string | null;
}

export interface CecDataset {
	source: string;
	dashboard_url: string;
	file_url: string;
	file_sha256: string;
	data_last_updated: string;
	retrieved: string;
	note: string;
	jurisdictions: CecJurisdiction[];
}

const LABELS: Record<CecRawStatus, CecLabel> = {
	"SolarAPP+ Platform": "SolarAPP+",
	"Symbium Platform": "Symbium",
	"Custom Platform": "Custom platform",
	"Without Platform": "No platform reported",
	Exempt: "Exempt",
};

export const CEC_PLATFORM_LABELS: CecLabel[] = ["SolarAPP+", "Symbium", "Custom platform"];

export function cecLabel(status: string | null | undefined): CecLabel | null {
	return status && status in LABELS ? LABELS[status as CecRawStatus] : null;
}

// Our city names that the CEC file spells differently.
const CITY_ALIASES: Record<string, string> = {
	"city of industry": "industry",
};

export function normalizeJurisdictionName(name: string): string {
	return name
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/\./g, "")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

export interface CecCityIndex {
	byCity: Map<string, CecJurisdiction>;
	dataset: CecDataset;
}

export function buildCecCityIndex(dataset: CecDataset): CecCityIndex {
	const byCity = new Map<string, CecJurisdiction>();
	for (const j of dataset.jurisdictions) {
		if (j.types.includes("City")) byCity.set(normalizeJurisdictionName(j.name), j);
	}
	return { byCity, dataset };
}

/** The CEC entry for a California city, by exact normalized name (plus a short alias list). */
export function cecForCity(index: CecCityIndex, city: string): CecJurisdiction | null {
	const key = normalizeJurisdictionName(city);
	return index.byCity.get(CITY_ALIASES[key] ?? key) ?? null;
}
