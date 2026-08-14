// Central lookup from a record's `state` (USPS 2-letter code) to the
// display name and URL slug used everywhere a page needs to say what state
// a locality is in. This is the one place new states get registered — see
// docs/DATA_ARCHITECTURE.md's multi-state section. Adding a state here does
// NOT publish anything by itself; a locality only gets a public page once
// its own record clears READY (see scripts/evaluate-*.mjs).
//
// "CA" -> slug "california" is deliberately unchanged from the site's
// original single-state URL shape, so every existing indexed California URL
// (/california/<city>/...) keeps working with zero migration.

export interface StateMeta {
	code: string; // USPS 2-letter code, e.g. "CA"
	name: string; // Full display name, e.g. "California"
	slug: string; // URL path segment, e.g. "california"
}

export const STATE_META: Record<string, StateMeta> = {
	CA: { code: "CA", name: "California", slug: "california" },
	RI: { code: "RI", name: "Rhode Island", slug: "rhode-island" },
	DE: { code: "DE", name: "Delaware", slug: "delaware" },
	VT: { code: "VT", name: "Vermont", slug: "vermont" },
	CO: { code: "CO", name: "Colorado", slug: "colorado" },
	AZ: { code: "AZ", name: "Arizona", slug: "arizona" },
	HI: { code: "HI", name: "Hawaii", slug: "hawaii" },
	OR: { code: "OR", name: "Oregon", slug: "oregon" },
	NM: { code: "NM", name: "New Mexico", slug: "new-mexico" },
	NV: { code: "NV", name: "Nevada", slug: "nevada" },
	IL: { code: "IL", name: "Illinois", slug: "illinois" },
	NJ: { code: "NJ", name: "New Jersey", slug: "new-jersey" },
	UT: { code: "UT", name: "Utah", slug: "utah" },
	MD: { code: "MD", name: "Maryland", slug: "maryland" },
	VA: { code: "VA", name: "Virginia", slug: "virginia" },
	NC: { code: "NC", name: "North Carolina", slug: "north-carolina" },
	SC: { code: "SC", name: "South Carolina", slug: "south-carolina" },
	GA: { code: "GA", name: "Georgia", slug: "georgia" },
	WI: { code: "WI", name: "Wisconsin", slug: "wisconsin" },
	MN: { code: "MN", name: "Minnesota", slug: "minnesota" },
	CT: { code: "CT", name: "Connecticut", slug: "connecticut" },
	MA: { code: "MA", name: "Massachusetts", slug: "massachusetts" },
	NH: { code: "NH", name: "New Hampshire", slug: "new-hampshire" },
	ME: { code: "ME", name: "Maine", slug: "maine" },
	MI: { code: "MI", name: "Michigan", slug: "michigan" },
	WA: { code: "WA", name: "Washington", slug: "washington" },
	ID: { code: "ID", name: "Idaho", slug: "idaho" },
	FL: { code: "FL", name: "Florida", slug: "florida" },
	KY: { code: "KY", name: "Kentucky", slug: "kentucky" },
	IN: { code: "IN", name: "Indiana", slug: "indiana" },
	TN: { code: "TN", name: "Tennessee", slug: "tennessee" },
	LA: { code: "LA", name: "Louisiana", slug: "louisiana" },
	OH: { code: "OH", name: "Ohio", slug: "ohio" },
	PA: { code: "PA", name: "Pennsylvania", slug: "pennsylvania" },
	AK: { code: "AK", name: "Alaska", slug: "alaska" },
	NY: { code: "NY", name: "New York", slug: "new-york" },
	WV: { code: "WV", name: "West Virginia", slug: "west-virginia" },
	OK: { code: "OK", name: "Oklahoma", slug: "oklahoma" },
	TX: { code: "TX", name: "Texas", slug: "texas" },
	MS: { code: "MS", name: "Mississippi", slug: "mississippi" },
};

// Every currently-supported state, in the fixed order above (not alphabetical
// by code) — the order this site introduced them in, used anywhere a stable,
// deterministic listing order matters (e.g. a states index page).
export const SUPPORTED_STATE_CODES: string[] = Object.keys(STATE_META);

export function stateMeta(code: string): StateMeta {
	const meta = STATE_META[code];
	if (!meta) {
		throw new Error(
			`state-meta: unrecognized state code "${code}" — register it in src/lib/state-meta.ts before publishing any locality record for it`,
		);
	}
	return meta;
}

export function stateSlug(code: string): string {
	return stateMeta(code).slug;
}

export function stateName(code: string): string {
	return stateMeta(code).name;
}
