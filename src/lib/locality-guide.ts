// Reusable data-shaping logic for locality guide pages (e.g.
// src/pages/california/oakland/solar-permit-guide.astro). Every function here
// is pure and driven entirely by the locality JSON record — no locality fact
// is hardcoded. See docs/PILOT_EVALUATION.md Section 3 for which fields are
// approved to show, and docs/DATA_ARCHITECTURE.md Section 4 for the rule this
// module enforces: never display a value without its confidence and source,
// and never blend a null/unverified field into looking like a real answer.

import { STATE_META, stateMeta, stateName, stateSlug } from "./state-meta.ts";

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

export interface FeeItem {
	name: string;
	amount_usd?: number | null;
	unit?: string | null;
	notes?: string | null;
}

export interface EligibilityConstraints {
	property_types: string[];
	system_size_kw_ac_max: number | null;
	system_size_kw_dc_max: number | null;
	thermal_capacity_kw_max: number | null;
	program_or_pathway: string | null;
	other_conditions: string[];
}

// Matches data/schema.json's $defs.contactItem exactly: every field is
// independently nullable (not just optional) — real records legitimately
// set e.g. `"name": null` when a contact is known only by role.
export interface OfficialContact {
	role?: string | null;
	name?: string | null;
	phone?: string | null;
	email?: string | null;
	url?: string | null;
}

// Matches data/schema.json's timeline_days.value shape: when non-null, all
// three keys are always present, but min_days/max_days/notes are each
// independently nullable (a real record can confirm "no stated timeline"
// without a specific day count).
export interface TimelineValue {
	min_days: number | null;
	max_days: number | null;
	notes?: string | null;
}

// Only the fields this template actually renders — not a full port of
// data/schema.json. `city`, `county`, `utility`, and `last_verified` are
// required because docs/PILOT_EVALUATION.md Section 2 confirms they're
// populated in every pilot record; every other field may be null ("not yet
// researched") and the template must render NOT_VERIFIED for it.
export interface LocalityRecord {
	record_id: string;
	// USPS 2-letter state code (e.g. "CA", "RI", "DE", "VT") — explicit state
	// identity, schema v1.4.0+. See src/lib/state-meta.ts.
	state: string;
	city: FieldEnvelope<string>;
	// Nullable: a statewide-scoped record (e.g. Vermont's centralized PUC
	// net-metering process, which has no county-level AHJ) legitimately has
	// no county — see vt-statewide-vermont-gmp.json.
	county: FieldEnvelope<string | null>;
	utility: FieldEnvelope<string>;
	generation_supplier: FieldEnvelope<GenerationSupplier | null>;
	permit_authority: FieldEnvelope<string | null>;
	permit_url: FieldEnvelope<string | null>;
	interconnection_url: FieldEnvelope<string | null>;
	timeline_days: FieldEnvelope<TimelineValue | null>;
	battery_programs: FieldEnvelope<BatteryProgram[] | null>;
	rebates: FieldEnvelope<BatteryProgram[] | null>;
	permit_fees: FieldEnvelope<FeeItem[] | null>;
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

// A CSS class for the visual confidence badge — same tiering as
// confidenceLabel, exposed separately so the layout never has to parse the
// label string back apart to decide how to color it.
export function confidenceBadgeClass(confidence: unknown): string {
	if (typeof confidence !== "number") return "badge-unknown";
	if (confidence >= 0.8) return "badge-high";
	if (confidence >= 0.5) return "badge-medium";
	if (confidence > 0) return "badge-low";
	return "badge-none";
}

export function buildSourceResolver(sources: SourceRef[] | null | undefined) {
	const byId = new Map((sources || []).map((s) => [s.id, s]));
	return function sourcesFor(sourceIds?: string[] | null): SourceRef[] {
		return (sourceIds || [])
			.map((id) => byId.get(id))
			.filter((s): s is SourceRef => Boolean(s));
	};
}

// Every program on record is shown — status is never a display filter.
// Hiding "unknown"-status programs (the status nearly every SGIP citation
// carries, since re-confirming live program status wasn't in scope for most
// collection sessions) previously made real, sourced program data disappear
// entirely, rendering "No currently verified active battery program is
// available" on pages that actually had one on file — the opposite of this
// site's own promise to "show only what we can verify." The per-item
// "Status on file: <status> — verify current status before relying on
// this" caveat already renders for every item and is what protects against
// treating "unknown"/"expired" as guaranteed-current, so no filter is
// needed on top of it.
export function getDisplayablePrograms(
	value: BatteryProgram[] | null | undefined,
): BatteryProgram[] {
	return value || [];
}

export interface TimelineDisplay {
	isSameDaySolarAppOnly: boolean;
	label: string;
	standardPathCaveat: string | null;
}

// Trust rule: never render a general "same day" claim. A 0/0 range means
// same-day review only for projects meeting the jurisdiction's own
// expedited-review eligibility, with no verified timeline for the standard
// permit path — both facts must show together. The label deliberately does
// not name a specific platform (e.g. "SolarAPP+") unless a given record's
// own sources confirm that platform — many jurisdictions run their own
// same-day/expedited program (a proprietary portal, an in-house electrical
// permit fast-track, etc.) that is not SolarAPP+, and naming the wrong
// platform would be an unsupported claim.
// A record can also have a non-null timeline_days object with min_days/
// max_days themselves null (e.g. Santa Ana: the source describes review
// speed qualitatively but states no day range) — that must render
// NOT_VERIFIED, never the literal string "null–null days".
export function formatTimeline(td: TimelineValue): TimelineDisplay {
	const isSameDaySolarAppOnly = td.min_days === 0 && td.max_days === 0;
	if (isSameDaySolarAppOnly) {
		return {
			isSameDaySolarAppOnly: true,
			label: "Same-day review for eligible expedited-permit projects",
			standardPathCaveat: "No verified standard-path permit timeline is available.",
		};
	}
	if (td.min_days === null || td.max_days === null) {
		return { isSameDaySolarAppOnly: false, label: NOT_VERIFIED, standardPathCaveat: null };
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

// `state` is a USPS 2-letter code (e.g. "CA", "RI") — the URL's state
// segment is always derived from it via src/lib/state-meta.ts, never
// hardcoded, so a locality's page always lives under its own state's path
// and two same-named cities in different states can never collide.
export function guideUrlForCitySlug(state: string, slug: string): string {
	return `/${stateSlug(state)}/${slug}/solar-permit-guide/`;
}

export function cityIndexUrlForCitySlug(state: string, slug: string): string {
	return `/${stateSlug(state)}/${slug}/`;
}

export function stateIndexUrl(state: string): string {
	return `/${stateSlug(state)}/`;
}

// California has two separate pages (a full hero/marketing index at
// /california/ and a dedicated guide-list index at
// /california/solar-permit-guides/) — both pre-existing and indexed. A new
// state starts with far fewer READY records, so it gets one combined
// index+guide-list page at /<state-slug>/ instead of two thin pages; see
// docs/DATA_ARCHITECTURE.md's multi-state section. Revisit splitting a
// state's index once it has enough content to justify two pages.
export function stateGuidesIndexUrl(state: string): string {
	return state === "CA" ? "/california/solar-permit-guides/" : `/${stateSlug(state)}/`;
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

// Deliberately does NOT include the utility name in the title. Utility
// names in this dataset range from short IOU abbreviations ("PG&E") to long
// municipal-department names ("City of Healdsburg Electric Department", 38
// chars) — including the latter in the title pushes it past Google's SERP
// display width and truncates it mid-name, cutting off the " | GridPermit"
// brand tag. City name alone, at any length in this dataset, stays safely
// short — see tests/locality-guide.test.mjs for the length assertion run
// against every real record, not just the worst case. Utility context still
// appears in the description and prominently on the page itself.
export function buildPageMeta(record: LocalityRecord, pagePath: string): PageMeta {
	const canonicalUrl = `${SITE_ORIGIN}${pagePath}`;
	const shortName = utilityShortName(record.utility.value);
	// State code (not full name) keeps titles short across all four
	// supported states and disambiguates same-named cities across state
	// lines (e.g. Newark, CA vs Newark, DE) — see docs/DATA_ARCHITECTURE.md
	// and tests/locality-guide.test.mjs's title-uniqueness regression test.
	const title = `${record.city.value}, ${record.state} Solar Permit Guide | GridPermit`;
	// "official permit portal" replaces the old generic "permit authority"
	// phrasing: every READY record has a populated permit_url (a required
	// field for READY status), so this is true for every page it renders on
	// — not aspirational copy. Added 2026-08-15 after GSC Search Analytics
	// showed a real query ("aliso viejo permit portal", position 5.6, 0%
	// CTR on 8 impressions) where a page ranking on page 1 wasn't earning
	// clicks because nothing in the snippet signaled it links to the actual
	// official portal a searcher with that intent is looking for.
	const description =
		`${record.city.value}, ${record.state} solar permit guide: official permit portal, fees, and requirements — ` +
		`sourced and confidence-scored. Verified ${record.last_verified}.`;
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
	const state = stateMeta(record.state);
	return [
		{ name: "Home", url: `${SITE_ORIGIN}/` },
		{ name: state.name, url: `${SITE_ORIGIN}/${state.slug}/` },
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
	const generationSupplier = record.generation_supplier.value;
	const timelineValue = record.timeline_days?.value ?? null;

	if (record.utility.value) {
		faqs.push({
			q: `What utility serves solar customers in ${record.city.value}, ${stateName(record.state)}?`,
			a:
				`${record.utility.value} is the interconnection and distribution utility for ${record.city.value}.` +
				(generationSupplier
					? ` The default electricity generation supplier is ${generationSupplier.name}, a ${
							generationSupplier.type === "cca" ? "Community Choice Aggregator (CCA)" : generationSupplier.type
						}, separate from ${record.utility.value}.`
					: ""),
		});
	}

	if (timelineValue) {
		const td = timelineValue;
		const timeline = formatTimeline(td);
		const baseAnswer =
			td.notes ??
			(td.min_days !== null && td.max_days !== null ? `${td.min_days}–${td.max_days} days.` : NOT_VERIFIED);
		faqs.push({
			q: timeline.isSameDaySolarAppOnly
				? `How long does an expedited-eligible residential solar permit take in ${record.city.value}?`
				: `How long does a residential solar permit take in ${record.city.value}?`,
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
	county: string | null;
	utility: string;
	generationSupplierName: string | null;
	completenessPct: number;
	lastVerified: string;
	citySlug: string;
	guideUrl: string;
	// USPS 2-letter state code and its display metadata — carried on every
	// entry so cross-state lists (search, "related cities") can filter/label
	// by state instead of assuming California.
	state: string;
	stateName: string;
	stateSlug: string;
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
		const state = stateMeta(record.state);
		entries.push({
			recordId: evalRecord.record_id,
			city: record.city.value,
			county: record.county?.value ?? null,
			utility: record.utility.value,
			generationSupplierName: record.generation_supplier.value?.name ?? null,
			completenessPct: evalRecord.completeness_pct,
			lastVerified: record.last_verified,
			citySlug: slug,
			guideUrl: guideUrlForCitySlug(record.state, slug),
			state: state.code,
			stateName: state.name,
			stateSlug: state.slug,
		});
	}
	// Sort by state first (fixed registration order, not alphabetical — see
	// SUPPORTED_STATE_CODES) then city name, so a multi-state list groups
	// naturally by state instead of interleaving same-letter cities from
	// different states.
	const stateOrder = new Map(Object.keys(STATE_META).map((code, i) => [code, i]));
	return entries.sort(
		(a, b) => (stateOrder.get(a.state) ?? 99) - (stateOrder.get(b.state) ?? 99) || a.city.localeCompare(b.city),
	);
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

export interface RelatedLocalityEntry extends LocalityIndexEntry {
	// Why this entry was surfaced — shown as the visible reason on the page
	// so a "related" link reads as an actual relationship, not a random pick.
	relation: "county" | "utility" | "supplier";
}

// Curated, bounded "related localities" for a city's cross-link section —
// replaces linking to every other READY guide (which, at 80+ published
// cities, produces a page-length link list with no relevance signal and
// dilutes the value of any single link). Ranks candidates by how directly
// they relate to `current`: same county first, then same utility, then same
// generation supplier (CCA/municipal) — each candidate keeps only its
// single best-matching reason, and unrelated cities are never included
// (there is no "fill the rest randomly" fallback). Deterministic: ties
// within a relation break by city name (the same alphabetical order
// buildLocalityIndexEntries already sorts by), so the result never depends
// on object/array iteration order. `limit` bounds the total so this never
// grows into a link farm as the dataset grows — see docs/DATA_ARCHITECTURE.md
// on why a bounded, relevance-ranked list is preferred over an exhaustive one.
export function buildRelatedLocalities(
	current: LocalityIndexEntry,
	allEntries: LocalityIndexEntry[],
	limit: number = 6,
): RelatedLocalityEntry[] {
	// Same-state only: a "related locality" must never cross state lines —
	// county/utility/generation-supplier names are not unique across states
	// (see docs/DATA_ARCHITECTURE.md multi-state section), so filtering to
	// `current.state` first is required for correctness, not just relevance.
	const candidates = excludeCurrentEntry(allEntries, current.recordId).filter((e) => e.state === current.state);
	// Compared by short name (e.g. "PG&E"), not the raw full utility string —
	// this dataset has more than one full-name spelling on file for the same
	// utility (e.g. "Pacific Gas & Electric (PG&E)" vs "Pacific Gas and
	// Electric Company (PG&E)" — utility.value was researched independently
	// per record across many batches, and both spellings are equally
	// accurate quotes of PG&E's own materials, so this is not a data error to
	// fix in the records themselves). Comparing raw strings would silently
	// fail to relate two same-utility cities that happened to use different
	// spellings.
	const currentUtilityShort = utilityShortName(current.utility);
	const scored: RelatedLocalityEntry[] = [];
	for (const c of candidates) {
		let relation: RelatedLocalityEntry["relation"] | null = null;
		if (current.county && c.county && c.county === current.county) relation = "county";
		else if (currentUtilityShort && utilityShortName(c.utility) === currentUtilityShort) relation = "utility";
		else if (
			current.generationSupplierName &&
			c.generationSupplierName &&
			c.generationSupplierName === current.generationSupplierName
		) {
			relation = "supplier";
		}
		if (relation) scored.push({ ...c, relation });
	}
	const rank = { county: 0, utility: 1, supplier: 2 };
	scored.sort((a, b) => rank[a.relation] - rank[b.relation] || a.city.localeCompare(b.city));
	// De-duplicate by recordId in case a future data shape ever let a
	// candidate match on paper more than once — keeps its first (best-rank)
	// occurrence, since scored is already sorted best-first at this point.
	const seen = new Set<string>();
	const deduped = scored.filter((e) => (seen.has(e.recordId) ? false : (seen.add(e.recordId), true)));
	return deduped.slice(0, limit);
}

// Human-readable label for why a related-locality link was surfaced —
// shown next to the link so "related" reads as a real relationship.
export function relationLabel(relation: RelatedLocalityEntry["relation"]): string {
	if (relation === "county") return "same county";
	if (relation === "utility") return "same utility";
	return "same generation supplier";
}
