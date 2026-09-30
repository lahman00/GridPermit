// Deterministic classifiers used by scripts/gsc-ingest.mjs:
//
//   1. classifyCommercialIntent(text) — buckets a query or a landing-page's
//      URL text into one commercial-intent category by explicit keyword
//      rule, never by fuzzy/ML-style guessing.
//   2. classifyMoneyQueryBucket(row) — the A-E "money-query" priority
//      bucket from a normalized GSC row (see docstring below).
//
// Both are pure functions (no I/O) so they can be unit-tested directly and
// reused outside the CLI.

// --- commercial-intent classification -------------------------------------
//
// Rules are checked in this fixed priority order, first match wins. Every
// keyword is matched as a whole word/phrase (word-boundary regex) against
// lowercased, punctuation-normalized text, so "express" never matches the
// "ess" battery keyword and "separate" never matches the "rate" keyword.
//
//   1. PERMIT              — the permitting/inspection process itself.
//   2. BATTERY              — storage hardware, including the SGIP storage
//                             rebate program (checked here, before the
//                             generic REBATE_RATE bucket, because SGIP is
//                             specifically a battery program).
//   3. INTERCONNECTION_PTO  — utility interconnection / Permission to
//                             Operate / net-energy-metering process.
//   4. REBATE_RATE          — non-battery financial incentives, rates and
//                             tariffs.
//   5. GENERAL_SOLAR        — mentions solar/energy but no more specific
//                             signal above.
//   6. OTHER                — no solar-relevant keyword at all (navigational
//                             queries, non-English text, etc).
//
// This ordering is a documented, deliberate tradeoff: a query or slug that
// legitimately touches two categories (e.g. "pge-zero-export-solar-battery-
// interconnection", which is both battery and interconnection) is assigned
// to whichever bucket is checked first, not both.

const COMMERCIAL_INTENT_RULES = [
	{
		bucket: "PERMIT",
		keywords: [
			"permit",
			"permits",
			"permitting",
			"solarapp",
			"building department",
			"plan review",
			"plan check",
			"inspection",
		],
	},
	{
		bucket: "BATTERY",
		keywords: [
			"battery",
			"batteries",
			"powerwall",
			"storage",
			"sgip",
			"enphase",
			"backup power",
			"ess",
		],
	},
	{
		bucket: "INTERCONNECTION_PTO",
		keywords: [
			"interconnection",
			"pto",
			"permission to operate",
			"nem",
			"nem3",
			"net metering",
			"net energy metering",
			"net surplus compensation",
		],
	},
	{
		bucket: "REBATE_RATE",
		keywords: ["rebate", "rebates", "incentive", "incentives", "rate", "rates", "tariff", "tax credit", "credit"],
	},
	{
		bucket: "GENERAL_SOLAR",
		keywords: ["solar", "photovoltaic", "energy"],
	},
];

export const COMMERCIAL_INTENT_VALUES = [
	"PERMIT",
	"INTERCONNECTION_PTO",
	"BATTERY",
	"REBATE_RATE",
	"GENERAL_SOLAR",
	"OTHER",
];

function normalizeForKeywordMatch(text) {
	return text
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

function containsWholeWordPhrase(haystack, phrase) {
	const normalizedPhrase = phrase.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
	if (normalizedPhrase === "") return false;
	const escaped = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
	return new RegExp(`(?:^|\\s)${escaped}(?:$|\\s)`, "i").test(` ${haystack} `);
}

/**
 * Classify a piece of free text (a search query, or a landing page's URL
 * segments with hyphens/underscores turned into spaces) into one of
 * COMMERCIAL_INTENT_VALUES, by explicit keyword rule.
 *
 * @param {string} text
 * @returns {string} one of COMMERCIAL_INTENT_VALUES
 */
export function classifyCommercialIntent(text) {
	if (typeof text !== "string" || text.trim() === "") return "OTHER";
	const normalized = normalizeForKeywordMatch(text);
	for (const rule of COMMERCIAL_INTENT_RULES) {
		if (rule.keywords.some((kw) => containsWholeWordPhrase(normalized, kw))) {
			return rule.bucket;
		}
	}
	return "OTHER";
}

// --- money-query bucket (A-E) ----------------------------------------------
//
// Applied to a normalized row. Checked in this fixed priority order —
// buckets are NOT mutually exclusive by definition (e.g. a row can satisfy
// both A and B), so the first matching rule below wins:
//
//   A = real clicks (>0) AND money_page
//   B = impressions >= 10 AND position <= 15 AND money_page
//   C = position in [15, 30] AND commercial_intent in
//       {PERMIT, INTERCONNECTION_PTO, BATTERY}
//   D = commercial_intent in {GENERAL_SOLAR, REBATE_RATE}
//   E = everything else
//
// `moneyPage` must already be the row's resolved boolean money_page value
// (never a guess) and `position`/`impressions`/`clicks` must already be
// validated numbers — this function does no validation of its own.

export const MONEY_QUERY_BUCKET_ORDER = ["A", "B", "C", "D", "E"];

const HIGH_VALUE_INTENTS_FOR_C = new Set(["PERMIT", "INTERCONNECTION_PTO", "BATTERY"]);
const INFORMATIONAL_INTENTS_FOR_D = new Set(["GENERAL_SOLAR", "REBATE_RATE"]);

/**
 * @param {{clicks: number, impressions: number, position: number, moneyPage: boolean, commercialIntent: string}} row
 * @returns {"A"|"B"|"C"|"D"|"E"}
 */
export function classifyMoneyQueryBucket(row) {
	const { clicks, impressions, position, moneyPage, commercialIntent } = row;

	if (clicks > 0 && moneyPage === true) return "A";
	if (impressions >= 10 && position <= 15 && moneyPage === true) return "B";
	if (position >= 15 && position <= 30 && HIGH_VALUE_INTENTS_FOR_C.has(commercialIntent)) return "C";
	if (INFORMATIONAL_INTENTS_FOR_D.has(commercialIntent)) return "D";
	return "E";
}
