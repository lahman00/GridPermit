// Statewide permit-timeline aggregate — every figure here is read directly
// off an existing READY locality record's own timeline_days field, never
// independently estimated or inferred. This module only aggregates and
// classifies; it never invents a day count a city's own record doesn't
// already state. See src/lib/locality-guide.ts's formatTimeline for the
// per-city rendering rule this mirrors (0/0 = SolarAPP+ same-day only,
// null/null = not verified, otherwise a real min-max range).

import {
	buildLocalityIndexEntries,
	type EvaluationRecordSummary,
	type LocalityIndexEntry,
	type LocalityRecord,
	type TimelineValue,
	utilityShortName,
} from "./locality-guide.ts";

export interface TimelineExample {
	city: string;
	guideUrl: string;
	utility: string | null;
	minDays: number;
	maxDays: number;
}

export interface TimelineInsights {
	readyCount: number;
	// Cities whose record has a real, non-null timeline_days value (either a
	// same-day 0/0 range or a real min/max range) — excludes cities where the
	// field is missing or explicitly null/null ("not verified").
	documentedCount: number;
	sameDaySolarAppCount: number;
	sameDaySolarAppExamples: TimelineExample[];
	standardPathCount: number;
	// A curated, bounded sample of standardPathCount, sorted fastest first —
	// never a full 81-row table.
	standardPathExamples: TimelineExample[];
	overallMinDays: number | null;
	overallMaxDays: number | null;
}

function utilityForEntry(entry: LocalityIndexEntry): string | null {
	return utilityShortName(entry.utility);
}

// `limit` bounds each example list to a curated sample — this is a
// methodology page, not an attempt to replace the per-city guides, so it
// deliberately doesn't try to list all 81 READY cities' timelines. Takes
// the same (evaluationRecords, recordsById) shape as buildLocalityIndexEntries
// and buildCountyHubs/buildUtilityHubs, and applies the identical
// READY-only gate internally, so this can never surface a LIMITED/NOT_READY
// city's timeline.
export function buildTimelineInsights(
	evaluationRecords: EvaluationRecordSummary[],
	recordsById: Map<string, LocalityRecord>,
	limit: number = 8,
): TimelineInsights {
	const readyEntries = buildLocalityIndexEntries(evaluationRecords, recordsById);
	const sameDay: TimelineExample[] = [];
	const standardPath: TimelineExample[] = [];
	let overallMin: number | null = null;
	let overallMax: number | null = null;
	let documentedCount = 0;

	for (const entry of readyEntries) {
		const record = recordsById.get(entry.recordId);
		if (!record) continue;
		const timeline: TimelineValue | null = record.timeline_days?.value ?? null;
		if (!timeline) continue;
		const { min_days, max_days } = timeline;
		if (min_days === null || max_days === null) continue;
		documentedCount++;
		const example: TimelineExample = {
			city: entry.city,
			guideUrl: entry.guideUrl,
			utility: utilityForEntry(entry),
			minDays: min_days,
			maxDays: max_days,
		};
		if (min_days === 0 && max_days === 0) {
			sameDay.push(example);
		} else {
			standardPath.push(example);
			overallMin = overallMin === null ? min_days : Math.min(overallMin, min_days);
			overallMax = overallMax === null ? max_days : Math.max(overallMax, max_days);
		}
	}

	sameDay.sort((a, b) => a.city.localeCompare(b.city));
	standardPath.sort((a, b) => a.maxDays - b.maxDays || a.minDays - b.minDays || a.city.localeCompare(b.city));

	return {
		readyCount: readyEntries.length,
		documentedCount,
		sameDaySolarAppCount: sameDay.length,
		sameDaySolarAppExamples: sameDay.slice(0, limit),
		standardPathCount: standardPath.length,
		standardPathExamples: standardPath.slice(0, limit),
		overallMinDays: overallMin,
		overallMaxDays: overallMax,
	};
}
