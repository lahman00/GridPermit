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
]);

// These three pilot guides were already live before the Arvada release. Keep
// their related lists unchanged too, while the original measurement runs.
const EARLIER_PILOT_GUIDES = new Set([
	"co-arapahoe-aurora-xcel",
	"co-larimer-fort-collins-fcu",
	"co-jefferson-lakewood-xcel",
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
