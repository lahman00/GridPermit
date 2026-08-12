// Data-shaping logic for utility hub pages (src/pages/california/utility/[slug].astro).
// A utility only gets a real page when it clears a genuine-value threshold
// — see MIN_READY_CITIES_FOR_HUB below — never a thin list-of-one-link
// page. Grouped by short name ("PG&E"), not the raw utility.value string,
// since this dataset has more than one full-name spelling on file for the
// same utility (see the same fix in src/lib/locality-guide.ts's
// buildRelatedLocalities). Never generalizes a per-city permitting fact
// (fees, timelines, documents) onto the utility page — only utility-level
// facts (its own name, and its interconnection page when every one of its
// READY cities cites the exact same URL) ever appear here.

import { citySlug, guideUrlForCitySlug, utilityShortName, type LocalityRecord } from "./locality-guide.ts";
import { stateMeta } from "./state-meta.ts";

// Mirrors county-hub.ts's threshold and rationale.
export const MIN_READY_CITIES_FOR_UTILITY_HUB = 4;

export interface UtilityCityEntry {
	city: string;
	county: string | null;
	citySlug: string;
	guideUrl: string;
}

export interface UtilityHubData {
	utilityShort: string;
	utilitySlug: string;
	state: string;
	stateName: string;
	stateSlug: string;
	cities: UtilityCityEntry[];
	counties: string[]; // deduped, alphabetical
	// Only set when every READY city on this utility cites the exact same
	// interconnection_url — never a guess at "the" utility page when
	// records disagree or one is null.
	commonInterconnectionUrl: string | null;
}

export interface UtilityEvaluationSummary {
	record_id: string;
	readiness: string;
}

export function utilitySlug(utilityShort: string): string {
	return citySlug(utilityShort);
}

export function buildUtilityHubs(
	evaluationRecords: UtilityEvaluationSummary[],
	recordsById: Map<string, LocalityRecord>,
): UtilityHubData[] {
	// Keyed by "STATE::utility short name" — a utility short name is not
	// guaranteed unique across states (and even a genuinely multi-state
	// utility must not get one hub page implying a single, blended list of
	// cities spanning state lines). See the identical fix in
	// src/lib/county-hub.ts.
	const byUtility = new Map<
		string,
		{ state: string; short: string; cities: UtilityCityEntry[]; interconnectionUrls: Set<string | null> }
	>();
	for (const evalRecord of evaluationRecords) {
		if (evalRecord.readiness !== "READY") continue;
		const record = recordsById.get(evalRecord.record_id);
		if (!record || !record.utility?.value) continue;
		const short = utilityShortName(record.utility.value);
		if (!short) continue;
		const key = `${record.state}::${short}`;
		const slug = citySlug(record.city.value);
		if (!byUtility.has(key)) byUtility.set(key, { state: record.state, short, cities: [], interconnectionUrls: new Set() });
		const bucket = byUtility.get(key)!;
		bucket.cities.push({
			city: record.city.value,
			county: record.county?.value ?? null,
			citySlug: slug,
			guideUrl: guideUrlForCitySlug(record.state, slug),
		});
		bucket.interconnectionUrls.add(record.interconnection_url?.value ?? null);
	}

	const hubs: UtilityHubData[] = [];
	for (const { state, short, cities, interconnectionUrls } of byUtility.values()) {
		if (cities.length < MIN_READY_CITIES_FOR_UTILITY_HUB) continue;
		cities.sort((a, b) => a.city.localeCompare(b.city));
		const counties = [...new Set(cities.map((c) => c.county).filter((c): c is string => Boolean(c)))].sort();
		const commonInterconnectionUrl =
			interconnectionUrls.size === 1 ? [...interconnectionUrls][0] : null;
		const stateInfo = stateMeta(state);
		hubs.push({
			utilityShort: short,
			utilitySlug: utilitySlug(short),
			state: stateInfo.code,
			stateName: stateInfo.name,
			stateSlug: stateInfo.slug,
			cities,
			counties,
			commonInterconnectionUrl,
		});
	}
	return hubs.sort((a, b) => a.stateSlug.localeCompare(b.stateSlug) || a.utilityShort.localeCompare(b.utilityShort));
}
