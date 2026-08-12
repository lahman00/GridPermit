// Data-shaping logic for county hub pages (src/pages/california/county/[slug].astro).
// A county only gets a real page when it clears a genuine-value threshold —
// see MIN_READY_CITIES_FOR_HUB below — never a thin list-of-one-link page.
// Every fact here is derived directly from the same LocalityRecord data the
// city guides themselves use; nothing county-specific is invented.

import { citySlug, guideUrlForCitySlug, utilityShortName, type LocalityRecord } from "./locality-guide.ts";
import { stateMeta } from "./state-meta.ts";

// Below this many READY cities, a county hub would be a link list with no
// real navigation or context value — see docs/DATA_ARCHITECTURE.md and the
// mission's own instruction: "Create county pages only where: multiple
// READY localities exist... If county pages cannot meet that quality
// threshold: do not create them." 14 of this dataset's 22 represented
// counties have only 1 READY city as of this writing and are deliberately
// left without a hub page.
export const MIN_READY_CITIES_FOR_HUB = 4;

export interface CountyCityEntry {
	city: string;
	citySlug: string;
	guideUrl: string;
	utility: string;
	utilityShort: string | null;
	permitAuthority: string | null;
	// True when the city's own permit_authority names the county government
	// itself (e.g. "Contra Costa County Department of Conservation and
	// Development") rather than a city department — a genuinely useful,
	// data-derived fact for a county page to surface, not an inference.
	countyContracted: boolean;
}

export interface CountyHubData {
	county: string;
	countySlug: string;
	state: string;
	stateName: string;
	stateSlug: string;
	cities: CountyCityEntry[];
	utilities: string[]; // short names, deduped, alphabetical
	countyContractedCities: string[]; // city names only
}

export function countySlug(countyValue: string): string {
	// "Contra Costa County" -> "contra-costa"; strips a trailing " County".
	return citySlug(countyValue.replace(/\s+County$/i, ""));
}

function isCountyContracted(permitAuthority: string | null, county: string): boolean {
	if (!permitAuthority) return false;
	const countyName = county.replace(/\s+County$/i, "");
	// Matches "Contra Costa County Department..." or "County of Alameda...";
	// deliberately does NOT match a city department that merely mentions the
	// county in passing, by requiring the county name to lead the phrase.
	return new RegExp(`^(${countyName} County|County of ${countyName})\\b`, "i").test(permitAuthority);
}

export interface ReadyEvaluationSummary {
	record_id: string;
	readiness: string;
}

// Builds one CountyHubData per county that meets MIN_READY_CITIES_FOR_HUB,
// from the same READY-only, evaluation-driven inputs every other cross-link
// list on the site already uses (see buildLocalityIndexEntries).
export function buildCountyHubs(
	evaluationRecords: ReadyEvaluationSummary[],
	recordsById: Map<string, LocalityRecord>,
): CountyHubData[] {
	// Keyed by "STATE::County Name", not county name alone — a county name is
	// not unique across states (and even where it happens to be, its READY
	// cities must never be mixed into one hub page spanning two states). See
	// the identical fix in src/lib/utility-hub.ts.
	const byCounty = new Map<string, { state: string; county: string; cities: CountyCityEntry[] }>();
	for (const evalRecord of evaluationRecords) {
		if (evalRecord.readiness !== "READY") continue;
		const record = recordsById.get(evalRecord.record_id);
		if (!record || !record.county?.value) continue;
		const county = record.county.value;
		const key = `${record.state}::${county}`;
		const slug = citySlug(record.city.value);
		const entry: CountyCityEntry = {
			city: record.city.value,
			citySlug: slug,
			guideUrl: guideUrlForCitySlug(record.state, slug),
			utility: record.utility.value,
			utilityShort: utilityShortName(record.utility.value),
			permitAuthority: record.permit_authority?.value ?? null,
			countyContracted: isCountyContracted(record.permit_authority?.value ?? null, county),
		};
		if (!byCounty.has(key)) byCounty.set(key, { state: record.state, county, cities: [] });
		byCounty.get(key)!.cities.push(entry);
	}

	const hubs: CountyHubData[] = [];
	for (const { state, county, cities } of byCounty.values()) {
		if (cities.length < MIN_READY_CITIES_FOR_HUB) continue;
		cities.sort((a, b) => a.city.localeCompare(b.city));
		const utilities = [...new Set(cities.map((c) => c.utilityShort).filter((u): u is string => Boolean(u)))].sort();
		const stateInfo = stateMeta(state);
		hubs.push({
			county,
			countySlug: countySlug(county),
			state: stateInfo.code,
			stateName: stateInfo.name,
			stateSlug: stateInfo.slug,
			cities,
			utilities,
			countyContractedCities: cities.filter((c) => c.countyContracted).map((c) => c.city),
		});
	}
	return hubs.sort((a, b) => a.stateSlug.localeCompare(b.stateSlug) || a.county.localeCompare(b.county));
}
