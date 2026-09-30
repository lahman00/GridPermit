// Guards against exposing a monetized referral CTA (CompareSolarPrices or
// any future partner) on a locality page whose utility is genuinely
// ambiguous — i.e. the city is actually split between two or more electric
// providers and a single `utility` field can't safely represent the whole
// city. Showing a generic "your utility is X" referral to a resident who is
// actually served by utility Y is misleading and can send a bad lead to a
// partner.
//
// This module is deliberately narrow and fail-closed: if the input doesn't
// look exactly like a well-formed, unambiguous locality record, the answer
// is "not verified unambiguous" (false) — never assumed true. See
// data/localities/ca-riverside-corona-multi.json for the real record that
// prompted this: its own `utility.value` is null because whoever researched
// it found Corona genuinely split between SCE and the city's own DWP and
// correctly refused to guess a majority provider.
//
// Two independent, real signals were found in the existing locality data
// (see docs/... batch-evaluation notes and scripts/evaluate-*-batch.mjs)
// and both are treated as authoritative ambiguity markers here:
//
// 1. A null/empty `utility.value` — the researcher couldn't even guess.
// 2. A `record_id` using the "-multi" suffix convention (currently only
//    Corona) — a deliberate naming signal that the record itself is a
//    stand-in for multiple utilities rather than one.
// 3. Explicit "genuinely split" / "is split between" / "split-territory"
//    language in `utility.notes` — the recurring phrasing this project's
//    own research batches use (Mission Viejo, Laguna Hills, Laguna Niguel,
//    Corona, and out-of-state examples like Loudoun County, VA and Mesa,
//    AZ) to flag that a record covers only PART of a city's territory even
//    though `utility.value` itself is non-null. Confidence alone is not
//    used as a signal: plenty of legitimate single-utility records also
//    carry reduced confidence for unrelated sourcing reasons.

const MULTI_UTILITY_RECORD_ID_PATTERN = /-multi(?:-|$)/i;

// Matches the recurring, deliberate phrasing this project's own research
// notes use to flag genuine multi-utility territory splits. Kept broad on
// purpose — a false positive here only ever makes the guard MORE
// conservative (CTA hidden), never less, which is the safe direction for a
// monetized referral link.
const SPLIT_TERRITORY_NOTES_PATTERN =
	/\bgenuinely?\s+split\b|\bis\s+split\s+between\b|\bsplit[\s-]territory\b|\bsplit\s+between\s+two\b/i;

export interface UtilitySplitGuardUtilityField {
	value?: string | null;
	notes?: string | null;
}

export interface UtilitySplitGuardRecord {
	record_id?: string | null;
	utility?: UtilitySplitGuardUtilityField | null;
}

/**
 * Returns true only when `record` is a well-formed locality record whose
 * utility is verified and unambiguous for the whole city. Returns false for
 * anything else, including malformed/unrecognized shapes — this function
 * never assumes unambiguity.
 */
export function hasVerifiedUnambiguousUtility(record: unknown): boolean {
	if (!record || typeof record !== "object") return false;

	const { record_id: recordId, utility } = record as UtilitySplitGuardRecord;

	if (typeof recordId !== "string" || recordId.trim().length === 0) return false;
	if (MULTI_UTILITY_RECORD_ID_PATTERN.test(recordId)) return false;

	if (!utility || typeof utility !== "object") return false;

	const { value, notes } = utility;
	if (typeof value !== "string" || value.trim().length === 0) return false;

	if (typeof notes === "string" && SPLIT_TERRITORY_NOTES_PATTERN.test(notes)) return false;

	return true;
}
