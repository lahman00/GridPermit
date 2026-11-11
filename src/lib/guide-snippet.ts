// Search-snippet description for a city guide, built only from that city's
// own verified record: the named permit office, a recorded automated path
// (SolarAPP+, Symbium or another platform), published fee amounts, and the
// interconnection utility. It replaces the generic template sentence only on
// guides that are not inside a measurement or observation window; every
// locked guide keeps its current description so its measurement stays clean.
// No fact is added that the record does not state; when the record cannot
// support a fact-bearing sentence, the caller keeps the existing description.

import { utilityShortName, type LocalityRecord } from "./locality-guide.ts";
import { automatedKindFor, publishedFees } from "./permit-data-study.ts";
import { hasVerifiedUnambiguousUtility } from "./utility-split-guard.ts";

export const MAX_DESCRIPTION_LENGTH = 160;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function checkedMonth(isoDate: string | null | undefined): string | null {
	const m = typeof isoDate === "string" ? isoDate.match(/^(\d{4})-(\d{2})-\d{2}$/) : null;
	if (!m) return null;
	const month = Number(m[2]);
	return month >= 1 && month <= 12 ? `${MONTHS[month - 1]} ${m[1]}` : null;
}

function sourced(field: { value: unknown; source_ids?: string[] | null } | undefined | null): boolean {
	return Boolean(field && field.value && field.source_ids?.length);
}

export function buildFactDescription(record: LocalityRecord): string | null {
	const city = record.city?.value;
	const month = checkedMonth(record.last_verified);
	if (!city || !month || !sourced(record.permit_authority)) return null;
	const authority = String(record.permit_authority.value);
	const kind = automatedKindFor(record.eligibility_constraints?.value?.program_or_pathway);
	const path = kind === "SolarAPP+" ? "SolarAPP+ path" : kind === "Symbium" ? "Symbium path" : kind ? "automated permit path" : null;
	const fees = publishedFees(record).length > 0;
	const utility = hasVerifiedUnambiguousUtility(record) ? utilityShortName(record.utility.value) : null;
	const interconnection = utility ? `${utility} interconnection` : "utility interconnection";
	const place = `${city}, ${record.state}`;

	const extras = [path, fees ? "published fees" : null].filter(Boolean).join(", ");
	const withExtras = extras ? `, ${extras}` : "";
	const candidates = [
		`${place} solar permit: ${authority} portal link${withExtras}, documents, inspections and ${interconnection}. Checked ${month}.`,
		`${place} solar permit: ${authority} portal link${withExtras} and ${interconnection}. Checked ${month}.`,
		`${place} solar permit: official portal link${withExtras}, documents, inspections and ${interconnection}. Checked ${month}.`,
		`${place} solar permit: official portal link${withExtras} and ${interconnection}. Checked ${month}.`,
	];
	return candidates.find((text) => text.length <= MAX_DESCRIPTION_LENGTH) ?? null;
}

export interface SnippetLockInputs {
	recordId: string;
	pagePath: string;
	// Record ids inside any measurement or observation window
	// (observationLockedRecordIds in src/lib/related-balance.ts).
	lockedRecordIds: Set<string>;
	// The balanced related-cities slice and its control pages.
	balancedRelated?: { pages: string[]; control_pages?: string[] } | null;
	// Any other explicitly held guide paths (for example lead sprint pages).
	heldPaths?: Set<string>;
}

/** True when a guide's search snippet must stay exactly as it is. */
export function isSnippetLocked(input: SnippetLockInputs): boolean {
	if (input.lockedRecordIds.has(input.recordId)) return true;
	if (input.heldPaths?.has(input.pagePath)) return true;
	const br = input.balancedRelated;
	if (br && (br.pages.includes(input.pagePath) || (br.control_pages ?? []).includes(input.pagePath))) return true;
	return false;
}
