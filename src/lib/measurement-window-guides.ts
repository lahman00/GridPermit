// Guides first published while a search measurement is running.
//
// docs/growth/TRAFFIC_GROWTH_20261111.md compares guides that were already live
// before 2026-11-11 (treatment, hash holdout and window-locked pages). Until that
// window closes on 2026-12-16 those pages must stay exactly as they are: content,
// titles, descriptions, structured data and links. A newly published guide would
// otherwise appear in the "Related cities" list of every existing guide that
// shares its county or utility, which changes pages under measurement.
//
// Records listed here are therefore:
//   - left out of every OTHER guide's related-cities list (their own page still
//     shows its related cities, and they are linked from the state index, the
//     guide directory, search and the sitemap);
//   - a separate group for the measurement: no pre-period, so they belong to
//     neither the treatment nor the holdout group.
//
// After the window closes, empty this set (see docs/growth/COLORADO_PILOT_20261113.md).

export const MEASUREMENT_WINDOW_CLOSES = "2026-12-16";

export const NEW_GUIDES_DURING_MEASUREMENT: ReadonlySet<string> = new Set<string>([
	"co-arapahoe-aurora-xcel",
	"co-larimer-fort-collins-fcu",
	"co-jefferson-lakewood-xcel",
	"co-jefferson-arvada-multi",
	"co-boulder-longmont-multi",
	"co-arapahoe-centennial-multi",
	"co-boulder-boulder-multi",
	"co-broomfield-broomfield-multi",
	"co-adams-westminster-multi",
	"co-douglas-parker-multi",
	"co-adams-thornton-multi",
	// Batch 2 (2026-11-20)
	"co-jefferson-wheat-ridge-xcel",
	"co-boulder-lafayette-xcel",
	"co-mesa-grand-junction-multi",
	"co-arapahoe-englewood-xcel",
	"co-arapahoe-littleton-xcel",
	"co-adams-commerce-city-multi",
	// Batch 3 (2026-11-24)
	"co-adams-brighton-multi",
	"co-boulder-erie-multi",
	"co-boulder-superior-xcel",
	"az-maricopa-queen-creek-multi",
	"az-pima-oro-valley-multi",
	// Batch 4 (2026-11-27)
	"co-weld-johnstown-multi",
	"co-summit-silverthorne-multi",
	"co-alamosa-alamosa-multi",
	"co-larimer-wellington-multi",
	"co-chaffee-salida-multi",
	"co-arapahoe-sheridan-xcel",
	"co-weld-frederick-united-power",
	"co-garfield-glenwood-springs-multi",
	"co-adams-federal-heights-multi",
	"co-la-plata-durango-multi",
	// Batch 5 (2026-11-27)
	"co-mesa-clifton-multi",
	"co-eagle-basalt-holy-cross",
	"co-summit-dillon-multi",
	"co-summit-frisco-multi",
	"co-arapahoe-cherry-hills-village-multi",
	"co-boulder-niwot-multi",
	"co-boulder-gunbarrel-multi",
	"co-arapahoe-bow-mar-multi",
	"co-arapahoe-glendale-multi",
]);

// These three pilot guides were already live before the Arvada release. Keep
// their related lists unchanged too, while the original measurement runs.
const EARLIER_PILOT_GUIDES = new Set([
	"co-arapahoe-aurora-xcel",
	"co-larimer-fort-collins-fcu",
	"co-jefferson-lakewood-xcel",
]);

// Batch 2 (2026-11-20) is newer than every guide above. Those guides keep the
// pools they had; a batch 2 guide can link to everything already published.
const BATCH_2_GUIDES = new Set([
	"co-jefferson-wheat-ridge-xcel",
	"co-boulder-lafayette-xcel",
	"co-mesa-grand-junction-multi",
	"co-arapahoe-englewood-xcel",
	"co-arapahoe-littleton-xcel",
	"co-adams-commerce-city-multi",
]);

// Batch 3 (2026-11-24) is newer than batch 2. Every guide above keeps the pool
// it had; a batch 3 guide can link to everything already published.
const BATCH_3_GUIDES = new Set([
	"co-adams-brighton-multi",
	"co-boulder-erie-multi",
	"co-boulder-superior-xcel",
	"az-maricopa-queen-creek-multi",
	"az-pima-oro-valley-multi",
]);

// Batch 4 (2026-11-27) is newer than batch 3; every earlier guide keeps its pool.
const BATCH_4_GUIDES = new Set([
	"co-weld-johnstown-multi",
	"co-summit-silverthorne-multi",
	"co-alamosa-alamosa-multi",
	"co-larimer-wellington-multi",
	"co-chaffee-salida-multi",
	"co-arapahoe-sheridan-xcel",
	"co-weld-frederick-united-power",
	"co-garfield-glenwood-springs-multi",
	"co-adams-federal-heights-multi",
	"co-la-plata-durango-multi",
]);

// Batch 5 (2026-11-27, second run) is newer than batch 4; every earlier guide keeps its pool.
const BATCH_5_GUIDES = new Set<string>([
	"co-mesa-clifton-multi",
	"co-eagle-basalt-holy-cross",
	"co-summit-dillon-multi",
	"co-summit-frisco-multi",
	"co-arapahoe-cherry-hills-village-multi",
	"co-boulder-niwot-multi",
	"co-boulder-gunbarrel-multi",
	"co-arapahoe-bow-mar-multi",
	"co-arapahoe-glendale-multi",
]);

export function isNewGuideDuringMeasurement(recordId: string | null | undefined): boolean {
	return typeof recordId === "string" && NEW_GUIDES_DURING_MEASUREMENT.has(recordId);
}

/**
 * The entries a guide may choose its related cities from. An existing guide never
 * sees a new guide. Earlier pilot guides keep their existing pool; the newest
 * guide can link to everything already published.
 */
export function relatedPoolFor<T extends { recordId: string }>(currentRecordId: string, entries: T[]): T[] {
	if (BATCH_5_GUIDES.has(currentRecordId)) return entries;
	entries = entries.filter((entry) => !BATCH_5_GUIDES.has(entry.recordId));
	if (BATCH_4_GUIDES.has(currentRecordId)) return entries;
	entries = entries.filter((entry) => !BATCH_4_GUIDES.has(entry.recordId));
	if (BATCH_3_GUIDES.has(currentRecordId)) return entries;
	entries = entries.filter((entry) => !BATCH_3_GUIDES.has(entry.recordId));
	if (BATCH_2_GUIDES.has(currentRecordId)) return entries;
	entries = entries.filter((entry) => !BATCH_2_GUIDES.has(entry.recordId));
	// Thornton is newer than the ten pilots; preserve every previous pool.
	if (currentRecordId === "co-adams-thornton-multi") return entries;
	entries = entries.filter((entry) => entry.recordId !== "co-adams-thornton-multi");
	// Parker is newer than the nine pilots; preserve every previous pool.
	if (currentRecordId === "co-douglas-parker-multi") return entries;
	entries = entries.filter((entry) => entry.recordId !== "co-douglas-parker-multi");
	// Westminster is newer than the eight pilots; preserve every previous pool.
	if (currentRecordId === "co-adams-westminster-multi") return entries;
	entries = entries.filter((entry) => entry.recordId !== "co-adams-westminster-multi");
	// Broomfield is newer than the seven pilots; preserve every previous pool.
	if (currentRecordId === "co-broomfield-broomfield-multi") return entries;
	entries = entries.filter((entry) => entry.recordId !== "co-broomfield-broomfield-multi");
	// Boulder is newer than the six pilots; preserve every previous pool.
	if (currentRecordId === "co-boulder-boulder-multi") return entries;
	entries = entries.filter((entry) => entry.recordId !== "co-boulder-boulder-multi");
	// Centennial is newer than all five pilots; preserve every previous pool.
	if (currentRecordId === "co-arapahoe-centennial-multi") return entries;
	entries = entries.filter((entry) => entry.recordId !== "co-arapahoe-centennial-multi");
	// Longmont is newer than all four published pilots. Preserve every prior pool.
	if (currentRecordId === "co-boulder-longmont-multi") return entries;
	entries = entries.filter((entry) => entry.recordId !== "co-boulder-longmont-multi");
	if (EARLIER_PILOT_GUIDES.has(currentRecordId)) {
		return entries.filter((entry) => entry.recordId !== "co-jefferson-arvada-multi");
	}
	if (isNewGuideDuringMeasurement(currentRecordId)) return entries;
	return entries.filter((entry) => !NEW_GUIDES_DURING_MEASUREMENT.has(entry.recordId));
}
