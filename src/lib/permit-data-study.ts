// California solar permit data: one row per published (READY) California city
// guide, built only from fields already on that city's verified record. This
// module aggregates and formats; it never estimates or fills in a fact a
// record does not state. A blank cell means our record's structured fields do
// not state it, not that the city lacks it.
//
// Automated path: the record's pathway field is read first (the same rule the
// Permit Path checker uses). Because some records state SolarAPP+ or Symbium
// in another sourced field (a required SolarAPP+ approval document, a fee, an
// inspection step, a condition, the permit page URL or a cited city page),
// those fields are read too, and the row says which field the path came
// from. Research notes are never read for this.

import { SITE_ORIGIN, buildLocalityIndexEntries, type EvaluationRecordSummary, type LocalityRecord } from "./locality-guide.ts";
import { AUTOMATED_PATH_PATTERN, canonicalUtilityName, isPlatformFee, publishedFees, type RecordFee } from "./record-facts.ts";
import { hasVerifiedUnambiguousUtility } from "./utility-split-guard.ts";

export { AUTOMATED_PATH_PATTERN };

export type AutomatedKind = "SolarAPP+" | "Symbium" | "SolarAPP+ and Symbium" | "Other automated";
// Express, over-the-counter or self-issued paths are shown, but never counted as automated.
export const EXPRESS_KIND = "Express or over-the-counter";
export type DataPathKind = AutomatedKind | typeof EXPRESS_KIND;
export type PathEvidence =
	| "pathway field"
	| "conditions"
	| "required documents"
	| "inspection steps"
	| "fees"
	| "permit page address"
	| "cited official page"
	| "platform's jurisdiction list";

// Fee entries that need a source re-check before they are shown (record data
// issues found in review). They stay on the city guide; this table omits them.
export const FEE_RECHECK: Record<string, string> = {
	"ca-riverside-riverside-rpu": "unit looks inconsistent with the fee band; re-checking",
	"ca-riverside-norco-sce": "amount and the cap named in the entry disagree; re-checking",
	"ca-santa-cruz-scotts-valley-pge": "units recorded as kWh; re-checking",
	"ca-placer-roseville-re": "amount far above other residential entries; re-checking",
};

// Fee names that a record lists next to SolarAPP+ or Symbium and that are
// that platform's or path's own fees, not the city's permit fee. Data view
// only; the guides and their descriptions are unchanged.
export const PATH_FEE_NAMES: Record<string, string[]> = {
	"ca-contra-costa-antioch-pge": ["Energy storage add-on fee"],
	"ca-contra-costa-lafayette-pge": ["Solar system review fee", "Energy storage add-on fee"],
	"ca-contra-costa-hercules-pge": ["Solar system review fee", "Energy storage add-on fee"],
	"ca-san-diego-la-mesa-sdge": ["Instant Review (SB 379/Symbium) expedited fee"],
};

// "solar app" must not continue into a word ("solar application" is not SolarAPP+).
const SOLARAPP = /solar\s?-?app(?![a-z])/i;
const EVIDENCE_PATTERN =
	/solar\s?-?app(?![a-z])|symbium|instant (?:solar )?permit|automated (?:solar )?(?:permit|permitting|plan review)|auto-?issued|real[- ]time (?:permit|review)|automatic[- ]permitting/i;
const URL_EVIDENCE_PATTERN = /solar-?app(?![a-z])|symbium|instant-solar|automatic-permitting|automated-solar/i;
// Negative or hedged statements never count as evidence.
const NEGATION_PATTERN =
	/coming soon|not (?:yet )?(?:available|offered|accepted|in use)|unavailable|no longer|discontinued|does not (?:use|offer|accept)|not confirmed|unconfirmed|not independently|wasn't independently|independent reporting/i;
const VENDOR_HOSTS = /(^|\.)(gosolarapp\.org|solar-app\.org|solarapp\.nrel\.gov|nrel\.gov|symbium\.com)$/i;
const NON_RESIDENTIAL_FEE = /commercial|multi-?family|non-?residential|sample total|other solar permits|penalt|re-?inspection/i;
const EXPRESS_PATTERN = /\bexpress\b|self[- ]issu|no plan (?:check|review)|without (?:plan )?review|over[- ]the[- ]counter|fast[- ]path/i;
const MIN_EVIDENCE_CONFIDENCE = 0.7;

/** Smallest kW or kVA number named in a fee entry, if any ("51kW-250kW" gives 51). */
export function sizeFloorKw(name: string): number | null {
	const range = name.match(/(\d+(?:\.\d+)?)\s*(?:kw|kva)?\s*(?:–|-|to)\s*\d+(?:\.\d+)?\s*(?:kw|kva)\b/i);
	if (range) return Number(range[1]);
	const values = [...name.matchAll(/(\d+(?:\.\d+)?)\s?(?:kw|kva)\b/gi)].map((m) => Number(m[1]));
	return values.length ? Math.min(...values) : null;
}

/** A fee tier for systems of 50 kW or more is commercial scale, not residential. */
export function isCommercialTier(name: string): boolean {
	const floor = sizeFloorKw(name);
	return floor !== null && floor >= 50;
}

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
	automatedKind: DataPathKind | null;
	automatedEvidence: PathEvidence | null;
	automatedEvidenceText: string | null;
	evidenceConfidence: number | null;
	pathwayText: string | null;
	pathwayConfidence: number | null;
	utility: string | null;
	utilitySplit: boolean;
	fees: PermitDataFee[];
	platformFees: PermitDataFee[];
	feeRecheck: string | null;
	lastVerified: string;
}

export interface PermitDataSummary {
	total: number;
	automated: number;
	fromPathwayField: number;
	fromOtherFields: number;
	lowConfidencePathway: number;
	express: number;
	platformListOnly: number;
	byKind: Record<AutomatedKind, number>;
	withCityOrUtilityFee: number;
	withPlatformFeeOnly: number;
	feeRecheck: number;
	utilities: { name: string; count: number }[];
	splitUtility: number;
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

export function kindFromText(text: string): AutomatedKind {
	const app = SOLARAPP.test(text);
	const sym = /symbium/i.test(text);
	if (app && sym) return "SolarAPP+ and Symbium";
	if (app) return "SolarAPP+";
	if (sym) return "Symbium";
	return "Other automated";
}

const affirmative = (text: string | null | undefined, pattern = EVIDENCE_PATTERN): text is string =>
	typeof text === "string" && pattern.test(text) && !NEGATION_PATTERN.test(text);

const sourced = (field: { source_ids?: string[] | null } | null | undefined) => Boolean(field?.source_ids?.length);
const confident = (field: { confidence?: number; source_ids?: string[] | null } | null | undefined) =>
	sourced(field) && typeof field?.confidence === "number" && field.confidence >= MIN_EVIDENCE_CONFIDENCE;

function hostOf(url: string | null | undefined): string | null {
	const safe = httpUrlOrNull(url);
	return safe ? new URL(safe).hostname : null;
}

// Fields whose values describe a page's content. Identity fields (city,
// county, permit office name) can come from a page title alone, so a source
// that only backs those is not evidence that its page was read.
const CONTENT_FIELDS = [
	"eligibility_constraints",
	"required_documents",
	"inspection_steps",
	"permit_fees",
	"timeline_days",
	"permit_url",
	"interconnection_url",
] as const;

/** Highest confidence of any content field that cites this source id. */
export function sourceBackingConfidence(record: LocalityRecord, sourceId: string): number {
	let best = 0;
	const fields = record as unknown as Record<string, unknown>;
	for (const key of CONTENT_FIELDS) {
		const value = fields[key];
		if (!value || typeof value !== "object" || Array.isArray(value)) continue;
		const envelope = value as { confidence?: unknown; source_ids?: unknown };
		if (Array.isArray(envelope.source_ids) && envelope.source_ids.includes(sourceId) && typeof envelope.confidence === "number") {
			best = Math.max(best, envelope.confidence);
		}
	}
	return best;
}

export interface PathEvidenceResult {
	kind: DataPathKind;
	evidence: PathEvidence;
	text: string;
	confidence: number | null;
}

/** Where the record states an automated (or, failing that, express) path, in a fixed order. */
export function automatedPathEvidence(record: LocalityRecord): PathEvidenceResult | null {
	const eligibility = record.eligibility_constraints;
	const program = eligibility?.value?.program_or_pathway ?? null;
	const eligibilityConfidence = typeof eligibility?.confidence === "number" ? eligibility.confidence : null;
	if (program && AUTOMATED_PATH_PATTERN.test(program) && !NEGATION_PATTERN.test(program)) {
		const ids = eligibility?.source_ids ?? [];
		const sourcesById = new Map((record.sources ?? []).map((src) => [src.id, src]));
		const hosts = ids.map((id) => hostOf(sourcesById.get(id)?.url)).filter((h): h is string => Boolean(h));
		const vendorOnly = hosts.length > 0 && hosts.every((h) => VENDOR_HOSTS.test(h));
		return {
			kind: kindFromText(program) as AutomatedKind,
			evidence: vendorOnly ? "platform's jurisdiction list" : "pathway field",
			text: program,
			confidence: eligibilityConfidence,
		};
	}
	const candidates: Array<[PathEvidence, string | null | undefined, { confidence?: number; source_ids?: string[] | null } | null | undefined]> = [];
	for (const c of eligibility?.value?.other_conditions ?? []) candidates.push(["conditions", c, eligibility]);
	for (const d of record.required_documents?.value ?? []) candidates.push(["required documents", d?.name, record.required_documents]);
	for (const st of record.inspection_steps?.value ?? []) candidates.push(["inspection steps", st, record.inspection_steps]);
	for (const f of record.permit_fees?.value ?? []) candidates.push(["fees", f?.name, record.permit_fees]);
	for (const [evidence, text, field] of candidates) {
		if (confident(field) && affirmative(text)) return { kind: kindFromText(text), evidence, text, confidence: field?.confidence ?? null };
	}
	const permitUrl = confident(record.permit_url) ? httpUrlOrNull(record.permit_url.value) : null;
	if (permitUrl && URL_EVIDENCE_PATTERN.test(new URL(permitUrl).pathname)) {
		return { kind: kindFromText(permitUrl), evidence: "permit page address", text: permitUrl, confidence: record.permit_url.confidence ?? null };
	}
	for (const source of record.sources ?? []) {
		const url = httpUrlOrNull(source.url);
		if (!url || VENDOR_HOSTS.test(new URL(url).hostname)) continue;
		const backing = sourceBackingConfidence(record, source.id);
		if (backing < MIN_EVIDENCE_CONFIDENCE) continue;
		if (affirmative(source.title)) return { kind: kindFromText(source.title), evidence: "cited official page", text: source.title, confidence: backing };
		if (URL_EVIDENCE_PATTERN.test(new URL(url).pathname)) return { kind: kindFromText(url), evidence: "cited official page", text: url, confidence: backing };
	}
	// Express, over-the-counter or self-issued: shown, never counted as automated.
	if (sourced(eligibility) && affirmative(program, EXPRESS_PATTERN)) {
		return { kind: EXPRESS_KIND, evidence: "pathway field", text: program as string, confidence: eligibilityConfidence };
	}
	for (const c of eligibility?.value?.other_conditions ?? []) {
		if (sourced(eligibility) && affirmative(c, EXPRESS_PATTERN)) return { kind: EXPRESS_KIND, evidence: "conditions", text: c, confidence: eligibilityConfidence };
	}
	return null;
}

export const isAutomatedRow = (row: Pick<PermitDataRow, "automatedKind" | "automatedEvidence">) =>
	Boolean(row.automatedKind && row.automatedKind !== EXPRESS_KIND && row.automatedEvidence !== "platform's jurisdiction list");

function displayFee(fee: RecordFee): PermitDataFee {
	return { name: fee.name, amountUsd: fee.amountUsd, unit: fee.unit };
}

export function normalizeCounty(state: string, county: string | null | undefined): string | null {
	if (!county) return null;
	const value = county.trim();
	if (state === "CA" && !/\bcounty\b/i.test(value) && !/san francisco/i.test(value)) return `${value} County`;
	return value;
}

export function toPermitDataRow(record: LocalityRecord, guideUrl: string): PermitDataRow {
	const evidence = automatedPathEvidence(record);
	const eligibility = record.eligibility_constraints;
	const recheck = FEE_RECHECK[record.record_id] ?? null;
	const pathFeeNames = new Set(PATH_FEE_NAMES[record.record_id] ?? []);
	const fees = publishedFees(record);
	const isPathFee = (f: RecordFee) => isPlatformFee(f) || pathFeeNames.has(f.name);
	return {
		recordId: record.record_id,
		city: record.city.value,
		county: normalizeCounty(record.state, record.county?.value),
		guideUrl,
		permitAuthority: record.permit_authority?.source_ids?.length ? record.permit_authority.value : null,
		permitUrl: record.permit_url?.source_ids?.length ? httpUrlOrNull(record.permit_url.value) : null,
		automatedKind: evidence?.kind ?? null,
		automatedEvidence: evidence?.evidence ?? null,
		automatedEvidenceText: evidence ? evidence.text.slice(0, 200) : null,
		evidenceConfidence: evidence?.confidence ?? null,
		pathwayText: eligibility?.value?.program_or_pathway ?? null,
		pathwayConfidence: typeof eligibility?.confidence === "number" ? eligibility.confidence : null,
		utility: canonicalUtilityName(record.utility?.value),
		utilitySplit: !hasVerifiedUnambiguousUtility(record),
		fees: recheck
			? []
			: fees.filter((f) => !isPathFee(f) && !NON_RESIDENTIAL_FEE.test(f.name) && !isCommercialTier(f.name)).map(displayFee),
		platformFees: fees.filter(isPathFee).map(displayFee),
		feeRecheck: recheck,
		lastVerified: record.last_verified,
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
	const byKind: Record<AutomatedKind, number> = { "SolarAPP+": 0, Symbium: 0, "SolarAPP+ and Symbium": 0, "Other automated": 0 };
	const utilityCounts = new Map<string, number>();
	let fromPathwayField = 0;
	let lowConfidencePathway = 0;
	let automated = 0;
	for (const row of rows) {
		if (isAutomatedRow(row)) {
			automated += 1;
			byKind[row.automatedKind as AutomatedKind] += 1;
			if (row.automatedEvidence === "pathway field") {
				fromPathwayField += 1;
				if ((row.pathwayConfidence ?? 0) < 0.7) lowConfidencePathway += 1;
			}
		}
		if (!row.utilitySplit) {
			const name = row.utility ?? "Not recorded";
			utilityCounts.set(name, (utilityCounts.get(name) ?? 0) + 1);
		}
	}
	const dates = rows.map((row) => row.lastVerified).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
	return {
		total: rows.length,
		automated,
		fromPathwayField,
		fromOtherFields: automated - fromPathwayField,
		lowConfidencePathway,
		express: rows.filter((r) => r.automatedKind === EXPRESS_KIND).length,
		platformListOnly: rows.filter((r) => r.automatedEvidence === "platform's jurisdiction list").length,
		byKind,
		withCityOrUtilityFee: rows.filter((r) => r.fees.length).length,
		withPlatformFeeOnly: rows.filter((r) => !r.fees.length && r.platformFees.length && !r.feeRecheck).length,
		feeRecheck: rows.filter((r) => r.feeRecheck).length,
		utilities: [...utilityCounts.entries()]
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
		splitUtility: rows.filter((r) => r.utilitySplit).length,
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

export function utilityLabel(row: Pick<PermitDataRow, "utility" | "utilitySplit">): string {
	if (row.utilitySplit) return row.utility ? `Split territory (${row.utility} listed)` : "Split territory";
	return row.utility ?? "";
}

// RFC 4180 quoting, plus a guard so a spreadsheet never evaluates a cell that
// starts like a formula.
export function csvCell(value: unknown): string {
	let text = value === null || value === undefined ? "" : String(value);
	if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
	return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const CSV_COLUMNS = [
	"record_id",
	"city",
	"county",
	"permit_office",
	"automated_path",
	"automated_path_found_in",
	"automated_path_text_as_recorded",
	"path_evidence_confidence",
	"pathway_field_as_recorded",
	"pathway_field_confidence",
	"interconnection_utility",
	"utility_split_territory",
	"city_or_utility_fees",
	"platform_fees",
	"fee_note",
	"last_verified",
	"gridpermit_guide_url",
	"official_permit_url",
] as const;

// A UTF-8 byte order mark so spreadsheet apps read "San José" and "≤" correctly.
export const CSV_BOM = "﻿";

export function permitDataCsv(rows: PermitDataRow[]): string {
	const lines = [CSV_COLUMNS.join(",")];
	for (const row of rows) {
		lines.push(
			[
				row.recordId,
				row.city,
				row.county,
				row.permitAuthority,
				row.automatedKind ?? "",
				row.automatedEvidence ?? "",
				row.automatedEvidenceText,
				row.evidenceConfidence,
				row.pathwayText,
				row.pathwayConfidence,
				row.utility,
				row.utilitySplit ? "yes" : "no",
				row.fees.map(formatFee).join("; "),
				row.platformFees.map(formatFee).join("; "),
				row.feeRecheck ? `fee entry withheld: ${row.feeRecheck}` : "",
				row.lastVerified,
				`${SITE_ORIGIN}${row.guideUrl}`,
				row.permitUrl,
			]
				.map(csvCell)
				.join(","),
		);
	}
	return `${CSV_BOM}${lines.join("\r\n")}\r\n`;
}

export const PERMIT_DATA_PATH = "/california/solar-permit-data/";
export const PERMIT_DATA_CSV_PATH = "/california/solar-permit-data.csv";
export const CEC_DASHBOARD_URL = "https://www.energy.ca.gov/residential-solar-permitting-program-dashboard";
