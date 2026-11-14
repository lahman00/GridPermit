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
]);

export function isNewGuideDuringMeasurement(recordId: string | null | undefined): boolean {
	return typeof recordId === "string" && NEW_GUIDES_DURING_MEASUREMENT.has(recordId);
}

/**
 * The entries a guide may choose its related cities from. An existing guide never
 * sees a new guide; a new guide sees everything, including the other new guides.
 */
export function relatedPoolFor<T extends { recordId: string }>(currentRecordId: string, entries: T[]): T[] {
	if (isNewGuideDuringMeasurement(currentRecordId)) return entries;
	return entries.filter((entry) => !NEW_GUIDES_DURING_MEASUREMENT.has(entry.recordId));
}
