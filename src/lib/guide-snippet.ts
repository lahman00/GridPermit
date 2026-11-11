// Search-snippet description for a city guide, built only from that city's
// own verified record: the named permit office, a recorded automated path
// (SolarAPP+, Symbium or another platform), city or utility fee amounts on
// file, a document checklist and inspection steps when the record has them,
// and the interconnection utility when it is unambiguous. It replaces the
// generic template sentence only on guides outside every measurement window
// and outside the pre-registered holdout; every other guide keeps its
// current description. When the record cannot support a fact-bearing
// sentence, the caller keeps the existing description.

import type { LocalityRecord } from "./locality-guide.ts";
import { automatedKindFor, canonicalUtilityName, cityOrUtilityFees } from "./record-facts.ts";
import { hasVerifiedUnambiguousUtility } from "./utility-split-guard.ts";

export const MAX_DESCRIPTION_LENGTH = 160;
// Below this eligibility confidence the snippet does not name the platform;
// the guide still shows the recorded pathway with its confidence label.
export const MIN_PATH_CONFIDENCE = 0.6;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function checkedMonth(isoDate: string | null | undefined): string | null {
	const m = typeof isoDate === "string" ? isoDate.match(/^(\d{4})-(\d{2})-\d{2}$/) : null;
	if (!m) return null;
	const month = Number(m[2]);
	return month >= 1 && month <= 12 ? `${MONTHS[month - 1]} ${m[1]}` : null;
}

function sourcedList(field: { value: unknown; source_ids?: string[] | null } | undefined | null): boolean {
	return Boolean(field && Array.isArray(field.value) && field.value.length > 0 && field.source_ids?.length);
}

export interface SnippetFacts {
	office: string;
	path: string | null;
	fees: boolean;
	documents: boolean;
	inspections: boolean;
	utility: string | null;
}

export function snippetFacts(record: LocalityRecord): SnippetFacts | null {
	const authority = record.permit_authority;
	if (!authority?.value || !authority.source_ids?.length) return null;
	const eligibility = record.eligibility_constraints;
	const kind = automatedKindFor(eligibility?.value?.program_or_pathway);
	const confident = typeof eligibility?.confidence === "number" && eligibility.confidence >= MIN_PATH_CONFIDENCE;
	const path = kind && confident && eligibility?.source_ids?.length
		? (kind === "Other automated" ? "automated permit path" : `${kind} path`)
		: null;
	return {
		office: String(authority.value),
		path,
		fees: cityOrUtilityFees(record).length > 0,
		documents: sourcedList(record.required_documents),
		inspections: sourcedList(record.inspection_steps),
		utility: hasVerifiedUnambiguousUtility(record) ? canonicalUtilityName(record.utility.value) : null,
	};
}

function joinItems(items: string[]): string {
	return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function buildFactDescription(record: LocalityRecord): string | null {
	const city = record.city?.value;
	const month = checkedMonth(record.last_verified);
	// Statewide or otherwise annotated records ("Vermont (Statewide)") keep the old sentence.
	if (!city || /[()]/.test(city) || !month) return null;
	const facts = snippetFacts(record);
	if (!facts) return null;
	const place = `${city}, ${record.state}`;
	const interconnection = facts.utility ? `${facts.utility} interconnection` : "utility interconnection";
	const optional = [
		facts.path,
		facts.fees ? "published fees" : null,
		facts.documents ? "document checklist" : null,
		facts.inspections ? "inspection steps" : null,
	].filter((item): item is string => Boolean(item));

	const candidates: string[] = [];
	for (const office of [`${facts.office} link`, "official city permit link"]) {
		// Drop optional items from the end (inspections, documents, fees) before the path.
		for (let keep = optional.length; keep >= 0; keep -= 1) {
			candidates.push(`${place} solar permit guide: ${joinItems([office, ...optional.slice(0, keep), interconnection])}. Checked ${month}.`);
		}
	}
	return candidates.find((text) => text.length <= MAX_DESCRIPTION_LENGTH) ?? null;
}

// FNV-1a, 32-bit. Deterministic across builds and machines.
export function stableHash(text: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i += 1) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash >>> 0;
}

/**
 * Pre-registered holdout: one in four eligible guides, chosen by a stable
 * hash of the record id, keeps the old description so the change can be
 * measured against comparable guides (see docs/growth/TRAFFIC_GROWTH_20261111.md).
 */
export function isSnippetHoldout(recordId: string): boolean {
	return stableHash(recordId) % 4 === 0;
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
