// California solar permit data: one row per published (READY) California city
// guide, built only from fields already on that city's verified record. This
// module aggregates and formats; it never estimates, infers or fills in a
// fact a record does not state. An empty cell means "not in our record", not
// "the city does not offer it".
//
// The automated-path test is the same one the Permit Path checker uses
// (src/pages/permit-path.astro), so the two pages can never disagree about
// which cities record an automated or instant permit path.

import {
	SITE_ORIGIN,
	buildLocalityIndexEntries,
	utilityShortName,
	type EvaluationRecordSummary,
	type LocalityRecord,
} from "./locality-guide.ts";

export const AUTOMATED_PATH_PATTERN = /solarapp|symbium|automated|instant/i;
// Fee amounts are shown only when the record's fee field is at least this
// confident; the guides themselves show every fee with its confidence label.
export const MIN_FEE_CONFIDENCE = 0.7;

export type AutomatedKind = "SolarAPP+" | "Symbium" | "Other automated";

export interface PermitDataFee {
	name: string;
	amountUsd: number;
	unit: string | null;
}

export interface PermitDataRow {
	recordId: string;
	city: string;
	county: string | null;
	guideUrl: string;
	permitAuthority: string | null;
	permitUrl: string | null;
	automatedKind: AutomatedKind | null;
	automatedProgram: string | null;
	pathwayConfidence: number | null;
	utility: string | null;
	fees: PermitDataFee[];
	lastVerified: string;
	sourceCount: number;
}

export interface PermitDataSummary {
	total: number;
	automated: number;
	byKind: Record<AutomatedKind, number>;
	withPublishedFee: number;
	utilities: { name: string; count: number }[];
	verifiedFrom: string | null;
	verifiedTo: string | null;
}

function httpUrlOrNull(value: unknown): string | null {
	if (typeof value !== "string") return null;
	try {
		const url = new URL(value);
		return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
	} catch {
		return null;
	}
}

// Display-only: a few records name an investor-owned utility without its
// usual abbreviation. Group them under the same short name so the table
// filter and counts do not split one utility in two.
const IOU_SHORT_NAMES: Array<[RegExp, string]> = [
	[/^southern california edison\b/i, "SCE"],
	[/^pacific gas (?:&|and) electric\b/i, "PG&E"],
	[/^san diego gas (?:&|and) electric\b/i, "SDG&E"],
];

export function canonicalUtilityName(value: string | null | undefined): string | null {
	if (!value) return null;
	// "Lompoc Utilities (Electric Division, City of Lompoc)": the parenthetical is
	// a description, not an abbreviation, so keep the name before it.
	const described = value.trim().match(/^(.+?)\s*\(([^)]*,[^)]*)\)\s*$/);
	const short = described ? described[1] : utilityShortName(value);
	if (!short) return null;
	for (const [pattern, name] of IOU_SHORT_NAMES) if (pattern.test(short)) return name;
	return short;
}

export function automatedKindFor(program: string | null | undefined): AutomatedKind | null {
	if (!program || !AUTOMATED_PATH_PATTERN.test(program)) return null;
	if (/solarapp/i.test(program)) return "SolarAPP+";
	if (/symbium/i.test(program)) return "Symbium";
	return "Other automated";
}

export function publishedFees(record: LocalityRecord): PermitDataFee[] {
	const field = record.permit_fees;
	if (!field || typeof field.confidence !== "number" || field.confidence < MIN_FEE_CONFIDENCE) return [];
	if (!field.source_ids?.length || !Array.isArray(field.value)) return [];
	return field.value
		.filter((fee) => typeof fee?.amount_usd === "number" && Number.isFinite(fee.amount_usd) && fee.amount_usd >= 0)
		.map((fee) => ({ name: fee.name, amountUsd: fee.amount_usd as number, unit: fee.unit ?? null }));
}

export function toPermitDataRow(record: LocalityRecord, guideUrl: string): PermitDataRow {
	const eligibility = record.eligibility_constraints;
	const program = eligibility?.value?.program_or_pathway ?? null;
	const kind = automatedKindFor(program);
	return {
		recordId: record.record_id,
		city: record.city.value,
		county: record.county?.value ?? null,
		guideUrl,
		permitAuthority: record.permit_authority?.source_ids?.length ? record.permit_authority.value : null,
		permitUrl: record.permit_url?.source_ids?.length ? httpUrlOrNull(record.permit_url.value) : null,
		automatedKind: kind,
		automatedProgram: kind ? program : null,
		pathwayConfidence: kind && typeof eligibility?.confidence === "number" ? eligibility.confidence : null,
		utility: canonicalUtilityName(record.utility?.value),
		fees: publishedFees(record),
		lastVerified: record.last_verified,
		sourceCount: record.sources?.length ?? 0,
	};
}

/** One row per READY guide in `state`, sorted by city name. */
export function buildPermitDataRows(
	evaluationRecords: EvaluationRecordSummary[],
	recordsById: Map<string, LocalityRecord>,
	state = "CA",
): PermitDataRow[] {
	return buildLocalityIndexEntries(evaluationRecords, recordsById)
		.filter((entry) => entry.state === state)
		.map((entry) => toPermitDataRow(recordsById.get(entry.recordId) as LocalityRecord, entry.guideUrl))
		.sort((a, b) => a.city.localeCompare(b.city) || a.recordId.localeCompare(b.recordId));
}

export function summarizePermitData(rows: PermitDataRow[]): PermitDataSummary {
	const byKind: Record<AutomatedKind, number> = { "SolarAPP+": 0, Symbium: 0, "Other automated": 0 };
	const utilityCounts = new Map<string, number>();
	let withPublishedFee = 0;
	for (const row of rows) {
		if (row.automatedKind) byKind[row.automatedKind] += 1;
		if (row.fees.length) withPublishedFee += 1;
		const name = row.utility ?? "Not recorded";
		utilityCounts.set(name, (utilityCounts.get(name) ?? 0) + 1);
	}
	const dates = rows.map((row) => row.lastVerified).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
	return {
		total: rows.length,
		automated: byKind["SolarAPP+"] + byKind.Symbium + byKind["Other automated"],
		byKind,
		withPublishedFee,
		utilities: [...utilityCounts.entries()]
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
		verifiedFrom: dates[0] ?? null,
		verifiedTo: dates[dates.length - 1] ?? null,
	};
}

export function formatUsd(amount: number): string {
	return Number.isInteger(amount) ? `$${amount.toLocaleString("en-US")}` : `$${amount.toFixed(2)}`;
}

export function formatFee(fee: PermitDataFee): string {
	return `${formatUsd(fee.amountUsd)} ${fee.name}${fee.unit ? ` (${fee.unit})` : ""}`;
}

export function percentOf(part: number, whole: number): number {
	return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

// RFC 4180 quoting, plus a guard so a spreadsheet never evaluates a cell that
// starts like a formula.
export function csvCell(value: unknown): string {
	let text = value === null || value === undefined ? "" : String(value);
	if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
	return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const CSV_COLUMNS = [
	"city",
	"county",
	"permit_office",
	"automated_path",
	"automated_program_as_recorded",
	"pathway_confidence",
	"interconnection_utility",
	"published_fee_amounts",
	"last_verified",
	"gridpermit_guide_url",
	"official_permit_url",
] as const;

export function permitDataCsv(rows: PermitDataRow[]): string {
	const lines = [CSV_COLUMNS.join(",")];
	for (const row of rows) {
		lines.push(
			[
				row.city,
				row.county,
				row.permitAuthority,
				row.automatedKind ?? "",
				row.automatedProgram,
				row.pathwayConfidence,
				row.utility,
				row.fees.map(formatFee).join("; "),
				row.lastVerified,
				`${SITE_ORIGIN}${row.guideUrl}`,
				row.permitUrl,
			]
				.map(csvCell)
				.join(","),
		);
	}
	return `${lines.join("\r\n")}\r\n`;
}

export const PERMIT_DATA_PATH = "/california/solar-permit-data/";
export const PERMIT_DATA_CSV_PATH = "/california/solar-permit-data.csv";
