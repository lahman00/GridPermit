// Small, pure readers of a locality record's own verified fields, shared by
// the search-snippet builder (and later by any statewide data view). They
// never add a fact the record does not state.

import { utilityShortName, type FeeItem, type LocalityRecord } from "./locality-guide.ts";

// Same test as the Permit Path checker (src/pages/permit-path.astro) applies
// to eligibility_constraints.value.program_or_pathway.
export const AUTOMATED_PATH_PATTERN = /solarapp|symbium|automated|instant/i;
export const MIN_FEE_CONFIDENCE = 0.7;

export type AutomatedKind = "SolarAPP+" | "Symbium" | "Other automated";

export function automatedKindFor(program: string | null | undefined): AutomatedKind | null {
	if (!program || !AUTOMATED_PATH_PATTERN.test(program)) return null;
	if (/solarapp/i.test(program)) return "SolarAPP+";
	if (/symbium/i.test(program)) return "Symbium";
	return "Other automated";
}

export interface RecordFee {
	name: string;
	amountUsd: number;
	unit: string | null;
	notes: string | null;
}

/** Dollar amounts from a confident, sourced fee field, as recorded. */
export function publishedFees(record: LocalityRecord): RecordFee[] {
	const field = record.permit_fees;
	if (!field || typeof field.confidence !== "number" || field.confidence < MIN_FEE_CONFIDENCE) return [];
	if (!field.source_ids?.length || !Array.isArray(field.value)) return [];
	return (field.value as FeeItem[])
		.filter((fee) => typeof fee?.amount_usd === "number" && Number.isFinite(fee.amount_usd) && fee.amount_usd >= 0)
		.map((fee) => ({ name: fee.name, amountUsd: fee.amount_usd as number, unit: fee.unit ?? null, notes: fee.notes ?? null }));
}

/**
 * A fee charged by the SolarAPP+ or Symbium platform itself (processing,
 * administration, application or revision fees), not a city permit fee or a
 * utility interconnection fee. A city fee that merely names the platform
 * ("Residential Photovoltaic System via SolarAPP+", "SolarApp+ OTC Permit
 * Fee") is not a platform fee.
 */
export function isPlatformFee(fee: { name: string; notes?: string | null }): boolean {
	const name = fee.name ?? "";
	const notes = fee.notes ?? "";
	if (!/solar\s?app|symbium/i.test(name)) return false;
	if (/\b(processing|administration|administrative|application|platform|add-on|design revision)\b/i.test(name)) return true;
	return /charged (by|through) (the )?(solar\s?app|symbium)|paid (directly )?to (the )?(solar\s?app|symbium)/i.test(notes);
}

/** City permit or utility interconnection fee amounts (platform fees excluded). */
export function cityOrUtilityFees(record: LocalityRecord): RecordFee[] {
	return publishedFees(record).filter((fee) => !isPlatformFee(fee));
}

const IOU_SHORT_NAMES: Array<[RegExp, string]> = [
	[/^southern california edison\b/i, "SCE"],
	[/^pacific gas (?:&|and) electric\b/i, "PG&E"],
	[/^san diego gas (?:&|and) electric\b/i, "SDG&E"],
];

/**
 * Display name for a utility: a trailing parenthetical is used only when it
 * is an abbreviation ("(SCE)", "(SMUD)"); a descriptive parenthetical ("(an
 * Exelon company)", "(Electric Division, City of Lompoc)") is dropped in
 * favour of the name before it. A "d/b/a" name wins, corporate suffixes are
 * removed, and the three California IOUs always get their usual short names.
 */
export function canonicalUtilityName(value: string | null | undefined): string | null {
	if (!value || !value.trim()) return null;
	let base = value.trim();
	const dba = base.match(/\bd\/b\/a\s+(.+?)\s*$/i);
	if (dba) base = dba[1];
	const paren = base.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
	let name = base;
	if (paren) {
		const inner = paren[2].trim();
		name = /^[A-Z][A-Za-z0-9&.\-]{1,9}$/.test(inner) ? inner : paren[1].trim();
	}
	name = name.replace(/,?\s+(?:Inc\.?|LLC|L\.L\.C\.|Company|Corporation)$/i, "").trim();
	for (const [pattern, short] of IOU_SHORT_NAMES) if (pattern.test(name)) return short;
	return name || utilityShortName(value);
}
