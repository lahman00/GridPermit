// Reusable data-shaping logic for locality guide pages (e.g.
// src/pages/california/oakland/solar-permit-guide.astro). Every function here
// is pure and driven entirely by the locality JSON record — no locality fact
// is hardcoded. See docs/PILOT_EVALUATION.md Section 3 for which fields are
// approved to show, and docs/DATA_ARCHITECTURE.md Section 4 for the rule this
// module enforces: never display a value without its confidence and source,
// and never blend a null/unverified field into looking like a real answer.

export const SITE_ORIGIN = "https://mygridpermit.com";
export const NOT_VERIFIED = "Not yet verified.";

export interface SourceRef {
	id: string;
	title: string;
	url: string;
	publisher?: string;
	type?: string;
	accessed_date?: string;
}

// Every researched field is wrapped in this envelope — see
// docs/DATA_ARCHITECTURE.md for the value/confidence/source_ids/notes shape.
export interface FieldEnvelope<T> {
	value: T;
	confidence?: number;
	source_ids?: string[] | null;
	notes?: string | null;
}

export interface GenerationSupplier {
	name: string;
	type: string;
	notes?: string | null;
}

export interface BatteryProgram {
	name: string;
	description?: string;
	status: string;
}

export interface RequiredDocument {
	name: string;
	required_when?: string | null;
}

export interface EligibilityConstraints {
	property_types: string[];
	system_size_kw_ac_max: number | null;
	system_size_kw_dc_max: number | null;
	thermal_capacity_kw_max: number | null;
	program_or_pathway: string | null;
	other_conditions: string[];
}

export interface OfficialContact {
	role?: string;
	name?: string;
	phone?: string;
	email?: string;
	url?: string;
}

export interface TimelineValue {
	min_days: number;
	max_days: number;
	notes?: string | null;
}

// Only the fields this template actually renders — not a full port of
// data/schema.json. `city`, `county`, `utility`, and `last_verified` are
// required because docs/PILOT_EVALUATION.md Section 2 confirms they're
// populated in every pilot record; every other field may be null ("not yet
// researched") and the template must render NOT_VERIFIED for it.
export interface LocalityRecord {
	record_id: string;
	city: FieldEnvelope<string>;
	county: FieldEnvelope<string>;
	utility: FieldEnvelope<string>;
	generation_supplier: FieldEnvelope<GenerationSupplier | null>;
	permit_authority: FieldEnvelope<string | null>;
	permit_url: FieldEnvelope<string | null>;
	interconnection_url: FieldEnvelope<string | null>;
	timeline_days: FieldEnvelope<TimelineValue | null>;
	battery_programs: FieldEnvelope<BatteryProgram[] | null>;
	required_documents: FieldEnvelope<RequiredDocument[] | null>;
	inspection_steps: FieldEnvelope<string[] | null>;
	eligibility_constraints: FieldEnvelope<EligibilityConstraints | null>;
	official_contacts: FieldEnvelope<OfficialContact[] | null>;
	sources: SourceRef[];
	last_verified: string;
}

export interface FaqEntry {
	q: string;
	a: string;
}

export interface BreadcrumbItem {
	name: string;
	url: string;
}

export function confidenceLabel(confidence: unknown): string {
	if (typeof confidence !== "number") return "Unknown";
	if (confidence >= 0.8) return `High (${confidence})`;
	if (confidence >= 0.5) return `Medium (${confidence})`;
	if (confidence > 0) return `Low (${confidence})`;
	return `None (${confidence})`;
}

export function buildSourceResolver(sources: SourceRef[] | null | undefined) {
	const byId = new Map((sources || []).map((s) => [s.id, s]));
	return function sourcesFor(sourceIds?: string[] | null): SourceRef[] {
		return (sourceIds || [])
			.map((id) => byId.get(id))
			.filter((s): s is SourceRef => Boolean(s));
	};
}

// Trust rule: only a status of "active" counts as a currently verified
// program. "unknown" and "expired" must never be displayed as if current.
export function getActiveBatteryPrograms(
	value: BatteryProgram[] | null | undefined,
): BatteryProgram[] {
	return (value || []).filter((p) => p.status === "active");
}

export interface TimelineDisplay {
	isSameDaySolarAppOnly: boolean;
	label: string;
	standardPathCaveat: string | null;
}

// Trust rule: never render a general "same day" claim. A 0/0 range means
// same-day review only for SolarAPP+-eligible projects, with no verified
// timeline for the standard permit path — both facts must show together.
export function formatTimeline(td: TimelineValue): TimelineDisplay {
	const isSameDaySolarAppOnly = td.min_days === 0 && td.max_days === 0;
	if (isSameDaySolarAppOnly) {
		return {
			isSameDaySolarAppOnly: true,
			label: "Same-day review for eligible SolarAPP+ projects",
			standardPathCaveat: "No verified standard-path permit timeline is available.",
		};
	}
	const label =
		td.min_days === td.max_days
			? `${td.min_days} days`
			: `${td.min_days}–${td.max_days} days`;
	return { isSameDaySolarAppOnly: false, label, standardPathCaveat: null };
}

// Missing-value handling: any null/undefined field renders as NOT_VERIFIED
// rather than being silently omitted or shown as empty.
export function withFallback(
	value: string | number | null | undefined,
	fallback: string = NOT_VERIFIED,
): string | number {
	return value === null || value === undefined ? fallback : value;
}

// Extracts a short parenthetical abbreviation from a utility's own display
// name (e.g. "PG&E" out of "Pacific Gas and Electric Company (PG&E)") — still
// derived from the record, never a separately hardcoded utility name. A
// utility name with no parenthetical (e.g. a municipal utility written out in
// full) falls back to the full name as-is.
export function utilityShortName(utilityValue: string | null | undefined): string | null {
	if (!utilityValue) return null;
	const match = utilityValue.match(/\(([^)]+)\)\s*$/);
	return match ? match[1] : utilityValue;
}

function stripDiacritics(str: string): string {
	return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Same algorithm as scripts/generate-locality-pages.mjs's slugify (itself
// mirroring scripts/collect-pilot.mjs) — kept as a separate literal here too,
// so this rendering-side lib has no import dependency on the scripts/
// directory. A route is only ever considered correct if it agrees with
// whatever the generator actually wrote to disk for that record.
export function citySlug(cityValue: string): string {
	return stripDiacritics(cityValue)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function guideUrlForCitySlug(slug: string): string {
	return `/california/${slug}/solar-permit-guide/`;
}

export function cityIndexUrlForCitySlug(slug: string): string {
	return `/california/${slug}/`;
}

// The permit authority is named exactly as the record states it — never
// assumed to be "City of {city}". Falls back to NOT_VERIFIED like every
// other unresearched field.
export function resolvePermitAuthorityLabel(record: LocalityRecord): string {
	return record.permit_authority.value ?? NOT_VERIFIED;
}

export interface PageMeta {
	canonicalUrl: string;
	title: string;
	description: string;
	utilityShortName: string | null;
}

export function buildPageMeta(record: LocalityRecord, pagePath: string): PageMeta {
	const canonicalUrl = `${SITE_ORIGIN}${pagePath}`;
	const shortName = utilityShortName(record.utility.value);
	const title = `${record.city.value} Solar Permit Guide (${shortName}) | GridPermit`;
	const description =
		`Source-linked, confidence-scored solar permitting facts for ${record.city.value}, ${record.county.value}: ` +
		`permit authority, required documents, inspection steps, and eligibility — last verified ${record.last_verified}. Not permit or legal advice.`;
	return { canonicalUrl, title, description, utilityShortName: shortName };
}

export interface BreadcrumbOptions {
	// Explicit path to the city's own index page (e.g. "/california/oakland/").
	// Never derived by splitting pagePath — a route's URL shape is not a
	// reliable stand-in for its city's canonical listing path.
	cityPath: string;
	pageUrl: string;
	pageLabel?: string;
}

export function buildBreadcrumbItems(
	record: LocalityRecord,
	opts: BreadcrumbOptions,
): BreadcrumbItem[] {
	const pageLabel = opts.pageLabel ?? "Solar Permit Guide";
	return [
		{ name: "Home", url: `${SITE_ORIGIN}/` },
		{ name: "California", url: `${SITE_ORIGIN}/california/` },
		{ name: record.city.value, url: `${SITE_ORIGIN}${opts.cityPath}` },
		{ name: pageLabel, url: opts.pageUrl },
	];
}

export function buildBreadcrumbSchema(items: BreadcrumbItem[]) {
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: items.map((item, i) => ({
			"@type": "ListItem",
			position: i + 1,
			name: item.name,
			item: item.url,
		})),
	};
}

// Every FAQ answer is built entirely from record fields — a fact only
// appears here if the record itself supports it (no independently authored
// claims), and each answer that touches timeline data carries the same
// standard-path caveat shown in the visible page content.
export function buildFaqs(record: LocalityRecord): FaqEntry[] {
	const faqs: FaqEntry[] = [];
	const hasGenerationSupplier = record.generation_supplier.value !== null;
	const hasTimeline = record.timeline_days?.value != null;

	faqs.push({
		q: `What utility serves solar customers in ${record.city.value}, California?`,
		a:
			`${record.utility.value} is the interconnection and distribution utility for ${record.city.value}.` +
			(hasGenerationSupplier
				? ` The default electricity generation supplier is ${record.generation_supplier.value!.name}, a ${
						record.generation_supplier.value!.type === "cca"
							? "Community Choice Aggregator (CCA)"
							: record.generation_supplier.value!.type
					}, separate from ${record.utility.value}.`
				: ""),
	});

	if (hasTimeline) {
		const td: TimelineValue = record.timeline_days!.value;
		const timeline = formatTimeline(td);
		const baseAnswer = td.notes ?? `${td.min_days}–${td.max_days} days.`;
		faqs.push({
			q: `How long does a SolarAPP+-eligible residential solar permit take in ${record.city.value}?`,
			a: timeline.standardPathCaveat ? `${baseAnswer} ${timeline.standardPathCaveat}` : baseAnswer,
		});
	}

	if (record.required_documents.value?.length) {
		faqs.push({
			q: `What documents are required for a solar permit in ${record.city.value}?`,
			a: `Commonly required documents include: ${record.required_documents.value
				.map((d) => d.name)
				.join("; ")}.`,
		});
	}

	if (record.official_contacts.value?.length) {
		const c = record.official_contacts.value[0];
		faqs.push({
			q: `Who do I contact about solar permits in ${record.city.value}?`,
			a: `${c.role}` + (c.phone ? `, phone ${c.phone}` : "") + (c.email ? `, email ${c.email}` : "") + ".",
		});
	}

	return faqs;
}

export function buildFaqSchema(faqs: FaqEntry[]) {
	if (faqs.length === 0) return null;
	return {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: faqs.map((f) => ({
			"@type": "Question",
			name: f.q,
			acceptedAnswer: { "@type": "Answer", text: f.a },
		})),
	};
}

// The subset of output/pilot-evaluation.json's per-record fields this module
// actually reads — not a full port of that report's shape.
export interface EvaluationRecordSummary {
	record_id: string;
	readiness: string;
	completeness_pct: number;
}

export interface LocalityIndexEntry {
	recordId: string;
	city: string;
	utility: string;
	generationSupplierName: string | null;
	completenessPct: number;
	lastVerified: string;
	citySlug: string;
	guideUrl: string;
}

// Shared by both the locality index page (Phase 3) and each locality page's
// "other verified guides" cross-links (Phase 4), so the two never drift out
// of sync on which records are eligible or what their URLs are. Only
// readiness === "READY" records are included — this is the one and only
// gate on which cities get a public link; a record with no matching entry in
// `recordsById` (data missing) is silently skipped rather than crashing,
// since the evaluation report and the locality files are read independently.
export function buildLocalityIndexEntries(
	evaluationRecords: EvaluationRecordSummary[],
	recordsById: Map<string, LocalityRecord>,
): LocalityIndexEntry[] {
	const entries: LocalityIndexEntry[] = [];
	for (const evalRecord of evaluationRecords) {
		if (evalRecord.readiness !== "READY") continue;
		const record = recordsById.get(evalRecord.record_id);
		if (!record) continue;
		const slug = citySlug(record.city.value);
		entries.push({
			recordId: evalRecord.record_id,
			city: record.city.value,
			utility: record.utility.value,
			generationSupplierName: record.generation_supplier.value?.name ?? null,
			completenessPct: evalRecord.completeness_pct,
			lastVerified: record.last_verified,
			citySlug: slug,
			guideUrl: guideUrlForCitySlug(slug),
		});
	}
	return entries.sort((a, b) => a.city.localeCompare(b.city));
}

// Used by each locality page's "Other verified California guides" cross-link
// section (see LocalityGuideLayout.astro) to link to every other READY guide
// without linking to itself. Takes the same READY-filtered entry list
// buildLocalityIndexEntries produces — never a separate, possibly
// out-of-sync list of "other" cities.
export function excludeCurrentEntry(
	entries: LocalityIndexEntry[],
	currentRecordId: string,
): LocalityIndexEntry[] {
	return entries.filter((e) => e.recordId !== currentRecordId);
}
