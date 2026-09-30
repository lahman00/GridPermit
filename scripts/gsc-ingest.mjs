#!/usr/bin/env node
// Reusable GSC (Google Search Console) export ingestion pipeline.
//
// Google Search Console's own export UI never gives you query text AND
// landing page in the same row unless you filter one page at a time, so the
// raw exports in output/gsc-demand-2026-09-23/ come in two disjoint shapes:
//
//   - "page" shape:  key,clicks,impressions,ctr_pct,position[,family,monetization_state]
//                    (key = the landing page URL; no query text)
//   - "query" shape: query,clicks,impressions,ctr_pct,position
//                    (query text; no landing page)
//
// This script auto-detects which shape each input CSV is (by column names
// present, not column order or file name), validates and normalizes every
// row, deduplicates across files (the CSVs are overlapping slices of the
// same underlying 28-day pull), fills in city/utility/page_type/commercial
// intent/money-page flags wherever they can be derived with confidence, and
// writes a single stable-schema CSV plus a sorted money-query queue.
//
// It never joins a query to a landing page it wasn't actually exported
// with — the unknown dimension is always the literal string "UNKNOWN", never
// a guess. See enrichRow() below for exactly what is/isn't inferred.
//
// Usage:
//   node scripts/gsc-ingest.mjs [csv-file-or-directory]
//   (defaults to output/gsc-demand-2026-09-23/ if no argument is given)
//
// Fails closed: any malformed numeric field, empty required field, or
// conflicting duplicate row throws immediately and writes nothing.

import { readFile, readdir, writeFile, mkdir, stat as statAsync } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyCommercialIntent, classifyMoneyQueryBucket, MONEY_QUERY_BUCKET_ORDER } from "./lib/money-query-classifier.mjs";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const LOCALITIES_DIR = path.join(REPO_ROOT, "data", "localities");
const VERIFIED_LIST_PATH = path.join(REPO_ROOT, "data", "revenue", "compare-solar-production-verified.json");
const DEFAULT_INPUT_DIR = path.join(REPO_ROOT, "output", "gsc-demand-2026-09-23");
// Overridable so tests (and any one-off run against a different export) can
// write to an isolated temp directory instead of silently overwriting the
// real, committed output/revenue-intelligence/ files - the bug that first
// motivated this override: running `npm test` against a tiny synthetic
// fixture used to permanently clobber the real 407-row normalized output
// with a 3-row test fixture as a side effect. Real usage never sets this.
const OUTPUT_DIR = process.env.GSC_INGEST_OUTPUT_DIR
	? path.resolve(process.env.GSC_INGEST_OUTPUT_DIR)
	: path.join(REPO_ROOT, "output", "revenue-intelligence");

// Confirmed elsewhere in this project's docs as the real 28-day window these
// exports cover (output/gsc-demand-2026-09-23/ was pulled on 2026-09-23).
const WINDOW_START = "2026-08-27";
const WINDOW_END = "2026-09-23";

const SITE_ORIGIN = "https://mygridpermit.com";
const SITE_HOST = "mygridpermit.com";

// The first-lead priority cohort (see PROJECT context) — first_lead_route is
// true only for these three, and only when the row's city was confidently
// resolved (never guessed).
const FIRST_LEAD_CITIES = new Set(["escondido", "hemet", "pomona"]);

// Mirrors src/lib/state-meta.ts's STATE_META (slug -> code, inverted). Kept
// as a separate literal here for the same isolation reason documented in
// scripts/data-quality-check.mjs's VALID_STATE_CODES: this script must run
// under plain `node` (no TS loader), so it cannot import the .ts module.
const STATE_SLUG_TO_CODE = {
	california: "CA",
	"rhode-island": "RI",
	delaware: "DE",
	vermont: "VT",
	colorado: "CO",
	arizona: "AZ",
	hawaii: "HI",
	oregon: "OR",
	"new-mexico": "NM",
	nevada: "NV",
	illinois: "IL",
	"new-jersey": "NJ",
	utah: "UT",
	maryland: "MD",
	virginia: "VA",
	"north-carolina": "NC",
	"south-carolina": "SC",
	georgia: "GA",
	wisconsin: "WI",
	minnesota: "MN",
	connecticut: "CT",
	massachusetts: "MA",
	"new-hampshire": "NH",
	maine: "ME",
	michigan: "MI",
	washington: "WA",
	idaho: "ID",
	florida: "FL",
	kentucky: "KY",
	indiana: "IN",
	tennessee: "TN",
	louisiana: "LA",
	ohio: "OH",
	pennsylvania: "PA",
	alaska: "AK",
	"new-york": "NY",
	"west-virginia": "WV",
	oklahoma: "OK",
	texas: "TX",
	mississippi: "MS",
	arkansas: "AR",
	alabama: "AL",
	montana: "MT",
	"north-dakota": "ND",
	"south-dakota": "SD",
	wyoming: "WY",
	iowa: "IA",
	kansas: "KS",
	missouri: "MO",
	nebraska: "NE",
};

// Non-locality top-level static pages that are never a locality/blog route.
const SITE_PAGE_SLUGS = new Set([
	"about",
	"contact",
	"privacy",
	"terms",
	"permits",
	"permit-path",
	"how-it-works",
	"pro",
	"for-installers",
	"partners",
	"search",
]);

export const NORMALIZED_HEADER = [
	"query",
	"landing_page",
	"clicks",
	"impressions",
	"ctr",
	"position",
	"window_start",
	"window_end",
	"state",
	"city",
	"utility",
	"page_type",
	"commercial_intent",
	"money_page",
	"partner_eligible",
	"cta_present",
	"first_lead_route",
];

// --- generic CSV read/write (RFC4180-ish: quoted fields, doubled-quote
//     escaping, embedded commas; no dependency on any CSV package) --------

export function parseCsv(content) {
	const rows = [];
	let row = [];
	let field = "";
	let inQuotes = false;
	let i = 0;
	const len = content.length;
	while (i < len) {
		const ch = content[i];
		if (inQuotes) {
			if (ch === '"') {
				if (content[i + 1] === '"') {
					field += '"';
					i += 2;
					continue;
				}
				inQuotes = false;
				i += 1;
				continue;
			}
			field += ch;
			i += 1;
			continue;
		}
		if (ch === '"') {
			inQuotes = true;
			i += 1;
			continue;
		}
		if (ch === ",") {
			row.push(field);
			field = "";
			i += 1;
			continue;
		}
		if (ch === "\r") {
			i += 1;
			continue;
		}
		if (ch === "\n") {
			row.push(field);
			field = "";
			rows.push(row);
			row = [];
			i += 1;
			continue;
		}
		field += ch;
		i += 1;
	}
	if (field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	const nonEmptyRows = rows.filter((r) => !(r.length === 1 && r[0] === ""));
	if (nonEmptyRows.length === 0) {
		throw new Error("gsc-ingest: CSV content has no rows");
	}
	const header = nonEmptyRows[0].map((h) => h.trim());
	return { header, rows: nonEmptyRows.slice(1) };
}

function csvEscapeField(value) {
	const str = String(value);
	if (/[",\n\r]/.test(str)) {
		return '"' + str.replace(/"/g, '""') + '"';
	}
	return str;
}

function rowsToCsv(header, rows) {
	const lines = [header.join(",")];
	for (const row of rows) lines.push(row.map(csvEscapeField).join(","));
	return lines.join("\n") + "\n";
}

// --- format auto-detection --------------------------------------------------

/**
 * @param {string[]} header
 * @returns {"page"|"query"|"unsupported"}
 */
export function detectCsvFormat(header) {
	const set = new Set(header.map((h) => h.trim().toLowerCase()));
	const hasKey = set.has("key");
	const hasQuery = set.has("query");
	const hasClicks = set.has("clicks");
	const hasImpressions = set.has("impressions");
	const hasCtr = set.has("ctr_pct");
	const hasPosition = set.has("position");
	const hasNumericCore = hasClicks && hasImpressions && hasCtr && hasPosition;
	if (hasKey && hasNumericCore) return "page";
	if (hasQuery && !hasKey && hasNumericCore) return "query";
	return "unsupported";
}

function buildHeaderIndex(header) {
	const idx = {};
	header.forEach((name, i) => {
		idx[name.trim().toLowerCase()] = i;
	});
	return idx;
}

function extractRawRows(fileName, header, dataRows, format) {
	const idx = buildHeaderIndex(header);
	return dataRows.map((cols, i) => ({
		format,
		query: format === "query" ? cols[idx.query] : null,
		landingPageRaw: format === "page" ? cols[idx.key] : null,
		clicksRaw: cols[idx.clicks],
		impressionsRaw: cols[idx.impressions],
		ctrRaw: cols[idx.ctr_pct],
		positionRaw: cols[idx.position],
		family: idx.family !== undefined ? cols[idx.family] : null,
		monetizationState: idx.monetization_state !== undefined ? cols[idx.monetization_state] : null,
		sourceFile: fileName,
		rowNumber: i + 2, // +1 for 0-index, +1 for the header line
	}));
}

// --- URL normalization ------------------------------------------------------

/**
 * Normalizes a landing-page URL to the site's actual served format:
 * https, bare mygridpermit.com host, trailing slash on directory-style
 * paths, no query string/fragment. Throws on anything that isn't a
 * mygridpermit.com URL or absolute path — refuses to guess at a host.
 */
export function normalizeLandingPage(raw, context = "") {
	if (raw == null || String(raw).trim() === "") {
		throw new Error(`gsc-ingest: empty landing page URL ${context}`);
	}
	const trimmed = String(raw).trim();
	let url;
	try {
		if (/^https?:\/\//i.test(trimmed)) {
			url = new URL(trimmed);
		} else if (trimmed.startsWith("/")) {
			url = new URL(trimmed, SITE_ORIGIN);
		} else {
			throw new Error("not an absolute URL or site-relative path");
		}
	} catch (err) {
		throw new Error(`gsc-ingest: malformed landing page URL "${raw}" ${context}: ${err.message}`);
	}
	const host = url.hostname.replace(/^www\./i, "").toLowerCase();
	if (host !== SITE_HOST) {
		throw new Error(
			`gsc-ingest: landing page host "${url.hostname}" is not ${SITE_HOST} ${context} — refusing to guess a rewrite: "${raw}"`,
		);
	}
	let pathname = url.pathname;
	if (pathname === "") pathname = "/";
	if (!pathname.endsWith("/") && !/\.[a-z0-9]+$/i.test(pathname)) {
		pathname += "/";
	}
	return `${SITE_ORIGIN}${pathname}`;
}

// --- numeric validation (fail closed) --------------------------------------

function contextSuffix(context) {
	return context ? ` ${context}` : "";
}

export function parseNonNegativeInteger(value, fieldName, context = "") {
	if (value === undefined || value === null || String(value).trim() === "") {
		throw new Error(`gsc-ingest: missing required field "${fieldName}"${contextSuffix(context)}`);
	}
	const trimmed = String(value).trim();
	if (!/^\d+$/.test(trimmed)) {
		throw new Error(
			`gsc-ingest: field "${fieldName}" must be a non-negative integer, got "${value}"${contextSuffix(context)}`,
		);
	}
	return Number(trimmed);
}

export function parseCtrPct(value, context = "") {
	if (value === undefined || value === null || String(value).trim() === "") {
		throw new Error(`gsc-ingest: missing required field "ctr_pct"${contextSuffix(context)}`);
	}
	const n = Number(String(value).trim());
	if (!Number.isFinite(n)) {
		throw new Error(`gsc-ingest: field "ctr_pct" is not a number: "${value}"${contextSuffix(context)}`);
	}
	if (n < 0 || n > 100) {
		throw new Error(`gsc-ingest: field "ctr_pct" out of the required 0-100 range: "${value}"${contextSuffix(context)}`);
	}
	return n;
}

export function parsePosition(value, context = "") {
	if (value === undefined || value === null || String(value).trim() === "") {
		throw new Error(`gsc-ingest: missing required field "position"${contextSuffix(context)}`);
	}
	const n = Number(String(value).trim());
	if (!Number.isFinite(n)) {
		throw new Error(`gsc-ingest: field "position" is not a number: "${value}"${contextSuffix(context)}`);
	}
	if (n <= 0) {
		throw new Error(`gsc-ingest: field "position" must be a positive number: "${value}"${contextSuffix(context)}`);
	}
	return n;
}

/**
 * Validates and normalizes one raw extracted row into the shared internal
 * shape. Throws (fails closed) on any malformed field instead of coercing.
 */
export function validateAndNormalizeRawRow(raw) {
	const context = `(file=${raw.sourceFile}, row=${raw.rowNumber})`;
	let query = "UNKNOWN";
	let landing_page = "UNKNOWN";

	if (raw.format === "query") {
		if (raw.query == null || String(raw.query).trim() === "") {
			throw new Error(`gsc-ingest: empty query text ${context}`);
		}
		query = String(raw.query).trim();
	} else if (raw.format === "page") {
		landing_page = normalizeLandingPage(raw.landingPageRaw, context);
	} else {
		throw new Error(`gsc-ingest: unrecognized row format "${raw.format}" ${context}`);
	}

	const clicks = parseNonNegativeInteger(raw.clicksRaw, "clicks", context);
	const impressions = parseNonNegativeInteger(raw.impressionsRaw, "impressions", context);
	const ctr = parseCtrPct(raw.ctrRaw, context);
	const position = parsePosition(raw.positionRaw, context);

	if (clicks > impressions) {
		throw new Error(
			`gsc-ingest: clicks (${clicks}) exceeds impressions (${impressions}) ${context} — refusing to silently accept impossible data`,
		);
	}

	return {
		query,
		landing_page,
		clicks,
		impressions,
		ctr,
		position,
		window_start: WINDOW_START,
		window_end: WINDOW_END,
		family: raw.family,
		monetization_state: raw.monetizationState,
		sourceFile: raw.sourceFile,
	};
}

// --- dedup -------------------------------------------------------------------

/**
 * Drops exact duplicates (same query+landing_page+metrics, seen in more than
 * one source file — the CSVs are overlapping slices of one export). Throws
 * if the same (query, landing_page) pair appears with DIFFERENT metrics,
 * since silently picking one would misrepresent the data.
 */
export function dedupeRows(rows) {
	const seen = new Map();
	const result = [];
	for (const row of rows) {
		const key = `${row.query}\u0000${row.landing_page}`;
		const metricsKey = `${row.clicks}\u0000${row.impressions}\u0000${row.ctr}\u0000${row.position}`;
		const prior = seen.get(key);
		if (prior) {
			if (prior.metricsKey !== metricsKey) {
				throw new Error(
					`gsc-ingest: conflicting duplicate rows for query="${row.query}" landing_page="${row.landing_page}": ` +
						`[${prior.metricsKey.replace(/\u0000/g, ",")}] from ${prior.sourceFile} vs ` +
						`[${metricsKey.replace(/\u0000/g, ",")}] from ${row.sourceFile}`,
				);
			}
			continue;
		}
		seen.set(key, { metricsKey, sourceFile: row.sourceFile });
		result.push(row);
	}
	return result;
}

// --- locality lookups --------------------------------------------------------

// Mirrors src/lib/locality-guide.ts's citySlug()/stripDiacritics() exactly
// (same isolation reasoning as that file's own comment: no import
// dependency between the rendering-side lib and this offline script).
function stripDiacritics(str) {
	return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function citySlug(cityValue) {
	return stripDiacritics(cityValue)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export async function loadLocalityIndex(localitiesDir) {
	const files = (await readdir(localitiesDir)).filter((f) => f.endsWith(".json"));
	const byStateCity = new Map();
	const byCityName = new Map();
	for (const file of files) {
		const raw = await readFile(path.join(localitiesDir, file), "utf8");
		let data;
		try {
			data = JSON.parse(raw);
		} catch (err) {
			throw new Error(`gsc-ingest: malformed locality JSON in ${file}: ${err.message}`);
		}
		const state = data.state;
		const cityValue = data.city?.value;
		if (!state || !cityValue) continue; // structural completeness is scripts/validate-record.mjs's job, not ours
		const record = {
			state,
			city: cityValue,
			utility: data.utility?.value ?? "UNKNOWN",
			county: data.county?.value ?? "UNKNOWN",
			file,
		};
		byStateCity.set(`${state}::${citySlug(cityValue)}`, record);
		const nameKey = cityValue.toLowerCase();
		if (!byCityName.has(nameKey)) byCityName.set(nameKey, []);
		byCityName.get(nameKey).push(record);
	}
	return { byStateCity, byCityName };
}

export async function loadVerifiedCitySlugs(verifiedPath) {
	const raw = await readFile(verifiedPath, "utf8");
	const data = JSON.parse(raw);
	if (!Array.isArray(data.verified_city_slugs)) {
		throw new Error(`gsc-ingest: ${verifiedPath} is missing a verified_city_slugs array`);
	}
	return new Set(data.verified_city_slugs);
}

// --- free-text city inference (queries, and non-structured URL slugs) ------

function normalizeText(text) {
	return text
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

function containsWholeWordPhrase(haystack, phrase) {
	const normalizedPhrase = normalizeText(phrase);
	if (normalizedPhrase === "") return false;
	const escaped = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
	return new RegExp(`(?:^|\\s)${escaped}(?:$|\\s)`, "i").test(` ${haystack} `);
}

/**
 * Finds a confident, unambiguous city mention in free text (a search query,
 * or a de-hyphenated URL slug). Returns null — never a guess — when no city
 * name is found, when more than one distinct city name matches (e.g. a
 * query mentioning two different cities), or when the matched name itself
 * is ambiguous across states (three real collisions exist in this dataset:
 * "Newark" in CA and NJ, "Richmond" in CA and VA, "Lincoln" in CA and NE).
 */
export function findConfidentCityMatch(text, localityIndex) {
	const normalized = normalizeText(text);
	if (normalized === "") return null;
	const matchedNames = [];
	for (const name of localityIndex.byCityName.keys()) {
		if (containsWholeWordPhrase(normalized, name)) matchedNames.push(name);
	}
	if (matchedNames.length === 0) return null;
	// Keep only maximal matches: drop a matched name that is itself a
	// whole-word substring of another matched name (e.g. drop "covina" when
	// "west covina" also matched the same text).
	const maximal = matchedNames.filter(
		(name) => !matchedNames.some((other) => other !== name && containsWholeWordPhrase(other, name)),
	);
	const uniqueMaximal = [...new Set(maximal)];
	if (uniqueMaximal.length !== 1) return null;
	const records = localityIndex.byCityName.get(uniqueMaximal[0]);
	if (!records || records.length !== 1) return null;
	const rec = records[0];
	return { state: rec.state, city: rec.city, utility: rec.utility };
}

// --- page_type from URL structure -------------------------------------------

/**
 * Classifies a normalized pathname purely from its URL structure (no
 * content is fetched). See docs read for this task: only
 * src/layouts/LocalityGuideLayout.astro (used exclusively by
 * src/pages/**\/solar-permit-guide.astro pages) renders InstallerCTA /
 * CompareSolarPricesCTA — county/utility hubs, state and city index pages,
 * blog posts, and static site pages never do.
 */
export function classifyPageType(pathname) {
	const segments = pathname.split("/").filter(Boolean);
	if (segments.length === 0) return "homepage";
	const [first, second, third] = segments;
	if (first === "blog") return segments.length === 1 ? "blog_index" : "blog_post";
	if (SITE_PAGE_SLUGS.has(first) && segments.length === 1) return "site_page";
	const stateCode = STATE_SLUG_TO_CODE[first];
	if (!stateCode) return "other";
	if (segments.length === 1) return "state_index";
	if (second === "county" && segments.length >= 3) return "county_hub";
	if (second === "utility" && segments.length >= 3) return "utility_hub";
	if (third === "solar-permit-guide") return stateCode === "CA" ? "ca_locality_guide" : "nonca_locality_guide";
	if (segments.length === 2) return stateCode === "CA" ? "ca_locality_index" : "nonca_locality_index";
	return "other";
}

const LOCALITY_PAGE_TYPES = new Set(["ca_locality_guide", "nonca_locality_guide", "ca_locality_index", "nonca_locality_index"]);
const CTA_ELIGIBLE_PAGE_TYPES = new Set(["ca_locality_guide", "nonca_locality_guide"]);

// --- row enrichment ----------------------------------------------------------

/**
 * Fills in state/city/utility/page_type/commercial_intent/money_page/
 * partner_eligible/cta_present/first_lead_route on a validated, deduplicated
 * row. Every inference is either a structural URL lookup against
 * data/localities/*.json or a confident (non-ambiguous) text match — see
 * findConfidentCityMatch(). Anything not confidently derivable stays
 * "UNKNOWN".
 */
export function enrichRow(row, { localityIndex, verifiedSlugs }) {
	let state = "UNKNOWN";
	let city = "UNKNOWN";
	let utility = "UNKNOWN";
	let pageType = "UNKNOWN";
	let citySlugValue = null;

	if (row.landing_page !== "UNKNOWN") {
		const url = new URL(row.landing_page);
		pageType = classifyPageType(url.pathname);
		const segments = url.pathname.split("/").filter(Boolean);
		const stateCode = STATE_SLUG_TO_CODE[segments[0]] ?? null;
		if (LOCALITY_PAGE_TYPES.has(pageType)) {
			citySlugValue = segments[1];
			state = stateCode ?? "UNKNOWN";
			if (stateCode) {
				const rec = localityIndex.byStateCity.get(`${stateCode}::${citySlugValue}`);
				if (rec) {
					city = rec.city;
					utility = rec.utility;
				}
			}
		}
	}

	// Free-text city inference fallback: the query text itself, or (for blog
	// posts/unclassified pages only — structured locality pages are already
	// resolved above via the URL, not guessed from words in the slug) the
	// de-hyphenated URL slug.
	if (city === "UNKNOWN") {
		const candidates = [];
		if (row.query !== "UNKNOWN") candidates.push(row.query);
		if (row.landing_page !== "UNKNOWN" && (pageType === "blog_post" || pageType === "other")) {
			candidates.push(new URL(row.landing_page).pathname.replace(/[-/]/g, " "));
		}
		for (const text of candidates) {
			const match = findConfidentCityMatch(text, localityIndex);
			if (match) {
				city = match.city;
				state = match.state;
				utility = match.utility;
				break;
			}
		}
	}

	const classificationText = [
		row.query !== "UNKNOWN" ? row.query : "",
		row.landing_page !== "UNKNOWN" ? new URL(row.landing_page).pathname.replace(/[-/]/g, " ") : "",
	]
		.join(" ")
		.trim();
	const commercial_intent = classifyCommercialIntent(classificationText);

	const isVerifiedCaLocalityGuide = pageType === "ca_locality_guide" && citySlugValue && verifiedSlugs.has(citySlugValue);
	const money_page = row.landing_page === "UNKNOWN" ? false : Boolean(isVerifiedCaLocalityGuide);
	const partner_eligible = money_page;

	let cta_present;
	if (row.landing_page === "UNKNOWN") {
		cta_present = "UNKNOWN";
	} else if (CTA_ELIGIBLE_PAGE_TYPES.has(pageType)) {
		cta_present = money_page;
	} else {
		cta_present = false;
	}

	const first_lead_route = city === "UNKNOWN" ? "UNKNOWN" : FIRST_LEAD_CITIES.has(city.toLowerCase());

	return {
		...row,
		state,
		city,
		utility,
		page_type: pageType,
		commercial_intent,
		money_page,
		partner_eligible,
		cta_present,
		first_lead_route,
	};
}

// --- CSV field formatting ----------------------------------------------------

function formatValue(v) {
	if (v === true) return "TRUE";
	if (v === false) return "FALSE";
	if (v === null || v === undefined) return "UNKNOWN";
	return v;
}

// --- CLI ---------------------------------------------------------------------

async function collectCsvFiles(inputPath) {
	const st = await statAsync(inputPath);
	if (st.isDirectory()) {
		const files = (await readdir(inputPath)).filter((f) => f.toLowerCase().endsWith(".csv"));
		return files.map((f) => path.join(inputPath, f)).sort();
	}
	return [inputPath];
}

export async function runIngest(inputArg = DEFAULT_INPUT_DIR, outputDirArg = OUTPUT_DIR) {
	const inputPath = path.isAbsolute(inputArg) ? inputArg : path.resolve(REPO_ROOT, inputArg);
	const normalizedOutputPath = path.join(outputDirArg, "GSC_NORMALIZED.csv");
	const moneyQueueOutputPath = path.join(outputDirArg, "MONEY_QUERY_QUEUE.csv");
	const csvFiles = await collectCsvFiles(inputPath);
	if (csvFiles.length === 0) {
		throw new Error(`gsc-ingest: no .csv files found at ${inputPath}`);
	}

	const localityIndex = await loadLocalityIndex(LOCALITIES_DIR);
	const verifiedSlugs = await loadVerifiedCitySlugs(VERIFIED_LIST_PATH);

	const allRawRows = [];
	const skippedFiles = [];
	let totalDataRows = 0;
	for (const file of csvFiles) {
		const content = await readFile(file, "utf8");
		const { header, rows } = parseCsv(content);
		const format = detectCsvFormat(header);
		if (format === "unsupported") {
			skippedFiles.push(path.basename(file));
			continue;
		}
		totalDataRows += rows.length;
		const rawRows = extractRawRows(path.basename(file), header, rows, format);
		for (const raw of rawRows) allRawRows.push(validateAndNormalizeRawRow(raw));
	}

	const deduped = dedupeRows(allRawRows);
	const enriched = deduped.map((row) => enrichRow(row, { localityIndex, verifiedSlugs }));

	await mkdir(path.dirname(normalizedOutputPath), { recursive: true });
	const normalizedRows = enriched.map((row) => NORMALIZED_HEADER.map((col) => formatValue(row[col])));
	await writeFile(normalizedOutputPath, rowsToCsv(NORMALIZED_HEADER, normalizedRows), "utf8");

	const bucketed = enriched.map((row) => ({
		...row,
		bucket: classifyMoneyQueryBucket({
			clicks: row.clicks,
			impressions: row.impressions,
			position: row.position,
			moneyPage: row.money_page,
			commercialIntent: row.commercial_intent,
		}),
	}));
	const bucketRank = (b) => MONEY_QUERY_BUCKET_ORDER.indexOf(b);
	bucketed.sort((a, b) => {
		const diff = bucketRank(a.bucket) - bucketRank(b.bucket);
		if (diff !== 0) return diff;
		if (b.clicks !== a.clicks) return b.clicks - a.clicks;
		return b.impressions - a.impressions;
	});
	const queueHeader = [...NORMALIZED_HEADER, "bucket"];
	const queueRows = bucketed.map((row) => queueHeader.map((col) => formatValue(row[col])));
	await writeFile(moneyQueueOutputPath, rowsToCsv(queueHeader, queueRows), "utf8");

	const bucketCounts = {};
	for (const b of MONEY_QUERY_BUCKET_ORDER) bucketCounts[b] = 0;
	for (const row of bucketed) bucketCounts[row.bucket] += 1;

	let unknownCity = 0;
	let unknownQuery = 0;
	let unknownLandingPage = 0;
	let monetizationStateMismatches = 0;
	for (const row of enriched) {
		if (row.city === "UNKNOWN") unknownCity += 1;
		if (row.query === "UNKNOWN") unknownQuery += 1;
		if (row.landing_page === "UNKNOWN") unknownLandingPage += 1;
		if (row.monetization_state === "CSP_PRODUCTION_BASELINE" && row.money_page !== true) monetizationStateMismatches += 1;
		if (row.monetization_state === "CSP_EXPANSION_CANDIDATE" && row.money_page !== false) monetizationStateMismatches += 1;
	}

	return {
		csvFilesProcessed: csvFiles.length - skippedFiles.length,
		csvFilesSkipped: skippedFiles,
		totalDataRowsRead: totalDataRows,
		uniqueRowsAfterDedup: deduped.length,
		bucketCounts,
		unknownCity,
		unknownQuery,
		unknownLandingPage,
		monetizationStateMismatches,
		normalizedOutputPath: normalizedOutputPath,
		moneyQueueOutputPath: moneyQueueOutputPath,
	};
}

async function main() {
	const inputArg = process.argv[2] ?? DEFAULT_INPUT_DIR;
	const summary = await runIngest(inputArg);
	console.log(
		`gsc-ingest: processed ${summary.csvFilesProcessed} CSV file(s); skipped ${summary.csvFilesSkipped.length} unsupported/aggregate-shaped file(s)${
			summary.csvFilesSkipped.length ? ` (${summary.csvFilesSkipped.join(", ")})` : ""
		}`,
	);
	console.log(`gsc-ingest: ${summary.totalDataRowsRead} raw data rows read -> ${summary.uniqueRowsAfterDedup} unique rows after dedup`);
	console.log(`gsc-ingest: bucket distribution: ${JSON.stringify(summary.bucketCounts)}`);
	console.log(
		`gsc-ingest: UNKNOWN counts — city: ${summary.unknownCity}, query: ${summary.unknownQuery}, landing_page: ${summary.unknownLandingPage}`,
	);
	console.log(`gsc-ingest: monetization_state/money_page cross-check mismatches: ${summary.monetizationStateMismatches}`);
	console.log(`gsc-ingest: wrote ${summary.normalizedOutputPath}`);
	console.log(`gsc-ingest: wrote ${summary.moneyQueueOutputPath}`);
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
	main().catch((err) => {
		console.error(err.stack ?? String(err));
		process.exit(1);
	});
}
