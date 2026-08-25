// CompareSolarPrices referral-link builder.
//
// This module is intentionally inert on its own. Production pages must not
// import or render it until the payment/tax activation gates in GitHub issue
// #5 are complete. The referral partner requires a fresh unique `cid` on
// every click, limited to letters, numbers, dashes and underscores, with a
// maximum length of 32 characters and no personally identifiable data.

const COMPARE_SOLAR_ORIGIN = "https://www.comparesolarprices.net";
const GRIDPERMIT_REF = "GridPermit";
const CID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
const COMPARE_SOLAR_STATE = "CA";

// Conservative allowlist copied from CompareSolarPrices' own Southern
// California service-area pages/homepage. We deep-link only when both the
// state and city are explicitly eligible. Unknown cities and non-California
// localities fail closed.
export const COMPARE_SOLAR_SERVED_CITY_SLUGS = new Set([
	"anaheim",
	"apple-valley",
	"beaumont",
	"buena-park",
	"camarillo",
	"carlsbad",
	"cathedral-city",
	"chino",
	"chino-hills",
	"chula-vista",
	"corona",
	"costa-mesa",
	"downey",
	"eastvale",
	"el-cajon",
	"el-monte",
	"encinitas",
	"escondido",
	"fontana",
	"fullerton",
	"garden-grove",
	"glendale",
	"hemet",
	"hesperia",
	"highland",
	"huntington-beach",
	"indian-wells",
	"indio",
	"irvine",
	"jurupa-valley",
	"la-mesa",
	"lake-elsinore",
	"lake-forest",
	"lancaster",
	"loma-linda",
	"long-beach",
	"los-angeles",
	"menifee",
	"mission-viejo",
	"moreno-valley",
	"murrieta",
	"norwalk",
	"oceanside",
	"ontario",
	"orange",
	"oxnard",
	"palm-desert",
	"palm-springs",
	"palmdale",
	"pasadena",
	"perris",
	"pomona",
	"poway",
	"rancho-cucamonga",
	"rancho-mirage",
	"redlands",
	"rialto",
	"riverside",
	"san-bernardino",
	"san-diego",
	"san-jacinto",
	"santa-ana",
	"santa-clarita",
	"santee",
	"simi-valley",
	"temecula",
	"thousand-oaks",
	"torrance",
	"upland",
	"victorville",
	"vista",
	"west-covina",
	"whittier",
	"yorba-linda",
	"yucaipa",
]);

export function normalizeCompareSolarCitySlug(city: string): string {
	return city
		.trim()
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function isCalifornia(state: string): boolean {
	return state.trim().toUpperCase() === COMPARE_SOLAR_STATE;
}

export function isCompareSolarServedLocality(state: string, city: string): boolean {
	return isCalifornia(state) && COMPARE_SOLAR_SERVED_CITY_SLUGS.has(normalizeCompareSolarCitySlug(city));
}

export function generateCompareSolarCid(): string {
	if (!globalThis.crypto?.getRandomValues) {
		throw new Error("Secure random generation is unavailable; refusing to create a referral cid.");
	}

	const bytes = new Uint8Array(12);
	globalThis.crypto.getRandomValues(bytes);
	return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function isValidCompareSolarCid(cid: string): boolean {
	return CID_PATTERN.test(cid);
}

export function getCompareSolarDestination(state: string, city: string): string | null {
	if (!isCalifornia(state)) return null;
	const slug = normalizeCompareSolarCitySlug(city);
	if (!COMPARE_SOLAR_SERVED_CITY_SLUGS.has(slug)) return null;
	return `${COMPARE_SOLAR_ORIGIN}/solar-${slug}-ca/`;
}

export function buildCompareSolarReferralUrl(state: string, city: string, cid = generateCompareSolarCid()): string | null {
	if (!isValidCompareSolarCid(cid)) {
		throw new Error("CompareSolarPrices cid must be 1-32 characters using only letters, numbers, dashes or underscores.");
	}

	const destination = getCompareSolarDestination(state, city);
	if (!destination) return null;

	const url = new URL(destination);
	url.searchParams.set("ref", GRIDPERMIT_REF);
	url.searchParams.set("cid", cid);
	return url.toString();
}
