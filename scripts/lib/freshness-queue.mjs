// Content freshness and regulatory-integrity review queue. Read-only and
// incremental: it never edits a locality record. It turns signals that are
// already inside each record (source access dates, field confidence,
// verification-gap notes, dated fee schedules, SolarAPP+ claims) into a ranked
// manual-review queue, ordered by real search demand when a verified export is
// supplied. Uncertainty is queued for a human; it is never resolved by guessing.
//
// Thresholds are documented operating choices for triage, not legal findings.
// A flag means "a person should re-check the official source", never "this
// rule is wrong".

import { createHash } from "node:crypto";

export const MS_DAY = 86400000;
export const LAST_VERIFIED_NOW_DAYS = 90;
export const SOURCE_AGE_NOW_DAYS = 90;
export const SOURCE_AGE_SOON_DAYS = 60; // applied to rules that change quickly (SolarAPP+ pathway)
export const FEE_DATE_STALE_DAYS = 365;
export const LOW_CONFIDENCE = 0.7;

// Fields a homeowner or installer acts on. Interconnection is separate from the
// city permit and is judged on its own terms below.
export const CRITICAL_FIELDS = Object.freeze([
	"permit_url",
	"permit_authority",
	"permit_fees",
	"required_documents",
	"timeline_days",
	"eligibility_constraints",
	"inspection_steps",
]);

const MONTHS = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };
const VERIFICATION_GAP = /\b(?:403|429|blocked|could not (?:fetch|access|be (?:fetched|accessed))|unable to (?:fetch|access)|not (?:directly )?(?:verified|confirmed)|search[- ]engine|cloudflare)\b/i;
const UTILITY_WIDE_REUSE = /utility-level fact|PG&E-wide|SCE-wide|utility-wide|already verified for other/i;

export function daysBetween(fromIso, toIso) {
	const a = Date.parse(fromIso);
	const b = Date.parse(toIso);
	return Number.isNaN(a) || Number.isNaN(b) ? null : Math.floor((b - a) / MS_DAY);
}

function textOf(value) {
	return JSON.stringify(value ?? "");
}

// Latest dated "effective/revised/adopted <Month d, yyyy>" mention in a field.
export function latestDatedMention(fieldEnvelope) {
	const t = textOf(fieldEnvelope);
	let best = null;
	for (const m of t.matchAll(/(?:effective|revised|adopted|updated)[^"]{0,40}?(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(20\d{2})/gi)) {
		const d = new Date(Date.UTC(Number(m[3]), MONTHS[m[1].toLowerCase()], Number(m[2])));
		if (!best || d > best) best = d;
	}
	return best ? best.toISOString().slice(0, 10) : null;
}

// Fiscal-year references like "FY 2025-26". Assumes a July-June fiscal year,
// which is common for California cities but not universal: the flag is a
// prompt to re-check, labelled as an assumption.
export function fiscalYearMentions(fieldEnvelope) {
	const out = [];
	for (const m of textOf(fieldEnvelope).matchAll(/FY\s*(\d{4})\s*[-–/]\s*(\d{2,4})/g)) {
		const end = m[2].length === 2 ? Number(m[1].slice(0, 2) + m[2]) : Number(m[2]);
		out.push(end);
	}
	return out;
}

function sourcesFor(record, field) {
	const ids = new Set(record[field]?.source_ids ?? []);
	return (record.sources ?? []).filter((s) => ids.has(s.id));
}

function mentionsSolarApp(record) {
	const pw = record.eligibility_constraints?.value?.program_or_pathway ?? "";
	const docs = (record.required_documents?.value ?? []).map((d) => d.name);
	return [pw, ...docs].some((s) => /solarapp/i.test(s));
}

function add(reasons, severity, code, detail, field) {
	reasons.push({ severity, code, field: field ?? null, detail });
}

export function assessRecord(record, today) {
	const reasons = [];
	const lv = daysBetween(record.last_verified, today);
	if (lv === null) add(reasons, "HIGH", "LAST_VERIFIED_UNREADABLE", "last_verified is missing or not a date");
	else if (lv > LAST_VERIFIED_NOW_DAYS) add(reasons, "HIGH", "LAST_VERIFIED_OLD", `last verified ${lv} days ago (limit ${LAST_VERIFIED_NOW_DAYS})`);

	for (const field of CRITICAL_FIELDS) {
		const env = record[field];
		if (!env) continue;
		const srcs = sourcesFor(record, field);
		if (env.value !== null && env.value !== undefined) {
			if (typeof env.confidence === "number" && env.confidence < LOW_CONFIDENCE) add(reasons, "MEDIUM", "LOW_CONFIDENCE", `confidence ${env.confidence}`, field);
			if (srcs.length === 0) add(reasons, "HIGH", "VALUE_WITHOUT_SOURCE", "field has a value but cites no source", field);
			const oldest = srcs.map((s) => daysBetween(s.accessed_date, today)).filter((d) => d !== null).sort((a, b) => b - a)[0];
			if (oldest !== undefined && oldest > SOURCE_AGE_NOW_DAYS) add(reasons, "HIGH", "SOURCE_OLD", `oldest cited source accessed ${oldest} days ago`, field);
			if (typeof env.notes === "string" && VERIFICATION_GAP.test(env.notes)) add(reasons, "MEDIUM", "VERIFICATION_GAP_IN_NOTES", "the record's own note says direct verification was blocked or indirect", field);
		}
	}

	// Fee schedules age by calendar: re-check when the dated schedule is a year
	// old or names a fiscal year that has already ended.
	const fees = record.permit_fees;
	if (fees?.value) {
		const dated = latestDatedMention(fees);
		const age = dated ? daysBetween(dated, today) : null;
		if (age !== null && age > FEE_DATE_STALE_DAYS) add(reasons, "HIGH", "FEE_SCHEDULE_OVER_A_YEAR_OLD", `latest dated fee reference ${dated}`, "permit_fees");
		const todayYear = Number(today.slice(0, 4));
		const todayMonth = Number(today.slice(5, 7));
		const currentFyEnd = todayMonth >= 7 ? todayYear + 1 : todayYear; // July-June assumption
		// Only the newest fiscal year the field cites matters: an old FY quoted as
		// history is not a stale schedule.
		const fy = fiscalYearMentions(fees);
		const newest = fy.length ? Math.max(...fy) : null;
		if (newest !== null && newest < currentFyEnd) add(reasons, "MEDIUM", "FEE_FISCAL_YEAR_ENDED", `newest fiscal year cited ends ${newest}; assumes a July-June fiscal year`, "permit_fees");
	}

	// SolarAPP+ pathway claims move quickly; use a tighter source-age limit.
	if (mentionsSolarApp(record)) {
		const srcs = [...sourcesFor(record, "eligibility_constraints"), ...sourcesFor(record, "required_documents")];
		const oldest = srcs.map((s) => daysBetween(s.accessed_date, today)).filter((d) => d !== null).sort((a, b) => b - a)[0];
		if (oldest === undefined) add(reasons, "MEDIUM", "SOLARAPP_CLAIM_WITHOUT_SOURCE", "record lists a SolarAPP+ pathway but its eligibility and document fields cite no source", "eligibility_constraints");
		else if (oldest > SOURCE_AGE_SOON_DAYS) add(reasons, "LOW", "SOLARAPP_SOURCE_AGING", `SolarAPP+ pathway sources accessed up to ${oldest} days ago (watch limit ${SOURCE_AGE_SOON_DAYS}; age alone does not prove the pathway changed)`, "eligibility_constraints");
	}

	// Interconnection and PTO are a different authority from the city permit.
	const ic = record.interconnection_url;
	if (ic) {
		if (ic.value === null || ic.value === undefined) add(reasons, "LOW", "INTERCONNECTION_URL_MISSING", "no utility interconnection link on record", "interconnection_url");
		else if (typeof ic.confidence === "number" && ic.confidence < LOW_CONFIDENCE) {
			const reused = typeof ic.notes === "string" && UTILITY_WIDE_REUSE.test(ic.notes);
			add(reasons, reused ? "LOW" : "MEDIUM", reused ? "INTERCONNECTION_UTILITY_WIDE_REUSE" : "INTERCONNECTION_LOW_CONFIDENCE", reused ? "utility-wide link reused across cities; not city-specific" : `confidence ${ic.confidence}`, "interconnection_url");
		}
	}

	const tier = reasons.some((r) => r.severity === "HIGH") ? "REVIEW_NOW" : reasons.some((r) => r.severity === "MEDIUM") ? "REVIEW_SOON" : reasons.length ? "WATCH" : "CURRENT";
	return { tier, reasons, last_verified: record.last_verified, last_verified_age_days: lv };
}

const TIER_RANK = { REVIEW_NOW: 0, REVIEW_SOON: 1, WATCH: 2, CURRENT: 3 };

// A review is a dated, evidenced re-check of one field against its official
// source. It can only clear a flag that asks for exactly that re-check; it can
// never clear missing sources, low confidence or aging sources (those need a
// data change), and a review that found a change escalates instead of clearing.
export const REVIEW_VALID_DAYS = 90;
export const REVIEW_CLEARABLE = Object.freeze({ permit_fees: ["FEE_SCHEDULE_OVER_A_YEAR_OLD", "FEE_FISCAL_YEAR_ENDED"] });
const REVIEW_OUTCOMES = ["CONFIRMED_CURRENT", "CHANGED", "UNREACHABLE"];

// A review applies to the exact field content it checked: change the value and the
// review no longer applies.
export function fieldFingerprint(envelope) {
	return createHash("sha256").update(JSON.stringify(envelope?.value ?? null)).digest("hex");
}

const hostOf = (u) => {
	try {
		return new URL(u).hostname.replace(/^www\./, "");
	} catch {
		return null;
	}
};

export function validateReview(r) {
	const problems = [];
	if (!r || typeof r.record_id !== "string") problems.push("record_id required");
	if (!Object.keys(REVIEW_CLEARABLE).includes(r?.field)) problems.push(`field must be one of ${Object.keys(REVIEW_CLEARABLE).join(", ")}`);
	if (!REVIEW_OUTCOMES.includes(r?.outcome)) problems.push(`outcome must be one of ${REVIEW_OUTCOMES.join(", ")}`);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(r?.reviewed_on ?? "")) problems.push("reviewed_on must be YYYY-MM-DD");
	if (!/^https:\/\//.test(r?.evidence?.url ?? "")) problems.push("evidence.url must be an https official source");
	if (typeof r?.evidence?.observed !== "string" || r.evidence.observed.length < 20 || r.evidence.observed.length > 400) problems.push("evidence.observed must be a 20-400 character excerpt of what the source says");
	if (!r?.reviewer) problems.push("reviewer required");
	if (!/^[a-f0-9]{64}$/.test(r?.field_sha256 ?? "")) problems.push("field_sha256 (fingerprint of the reviewed field value) required");
	return problems;
}

// Returns assessRecord's result with review-cleared reasons marked and the tier
// recomputed. Invalid reviews are ignored and reported, never trusted.
export function applyReviews(assessment, record, reviews, today) {
	const recordId = record.record_id;
	const mine = (reviews ?? []).filter((r) => r.record_id === recordId);
	const sourceHosts = new Set((record.sources ?? []).map((s) => hostOf(s.url)).filter(Boolean));
	const rejected = [];
	const valid = mine.filter((r) => {
		const problems = validateReview(r);
		if (!problems.length) {
			if (!sourceHosts.has(hostOf(r.evidence.url))) problems.push("evidence host is not one of the record's own cited source hosts");
			if (r.field_sha256 !== fieldFingerprint(record[r.field])) problems.push("the field changed after this review");
		}
		if (problems.length) rejected.push({ record_id: recordId, problems });
		return problems.length === 0;
	});
	const reasons = assessment.reasons.map((x) => ({ ...x }));
	for (const x of reasons) {
		const rev = valid.filter((r) => r.field === x.field && (REVIEW_CLEARABLE[r.field] ?? []).includes(x.code)).sort((a, b) => b.reviewed_on.localeCompare(a.reviewed_on))[0];
		if (!rev) continue;
		const age = daysBetween(rev.reviewed_on, today);
		if (rev.outcome === "CHANGED") x.escalated_by_review = rev.reviewed_on;
		else if (rev.outcome === "CONFIRMED_CURRENT" && age !== null && age >= 0 && age <= REVIEW_VALID_DAYS) {
			x.cleared_by_review = { reviewed_on: rev.reviewed_on, reviewer: rev.reviewer, evidence_url: rev.evidence.url, owner_acknowledged: Boolean(rev.owner_acknowledged_by) };
			x.severity = "INFO";
		}
	}
	if (reasons.some((x) => x.escalated_by_review)) reasons.push({ severity: "HIGH", code: "REVIEW_FOUND_CHANGE", field: "permit_fees", detail: "a dated review found the official source differs from the record; update the record from the source" });
	const live = reasons.filter((x) => x.severity !== "INFO");
	const tier = live.some((r) => r.severity === "HIGH") ? "REVIEW_NOW" : live.some((r) => r.severity === "MEDIUM") ? "REVIEW_SOON" : live.length ? "WATCH" : "CURRENT";
	return { ...assessment, reasons, tier, rejected_reviews: rejected };
}

// records: LocalityRecord[]; options: { today, readyIds?: Set, urlFor(record), demand?: Map<path, {impressions, clicks}>, paidPaths?: Set }
export function buildFreshnessQueue(records, options) {
	const { today, readyIds = null, urlFor, demand = null, paidPaths = new Set(), reviews = [] } = options;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error("today must be YYYY-MM-DD");
	const rows = records
		.filter((r) => (readyIds ? readyIds.has(r.record_id) : true))
		.map((r) => {
			const a = applyReviews(assessRecord(r, today), r, reviews, today);
			const path = urlFor(r);
			const d = demand ? demand.get(path) : undefined;
			return {
				record_id: r.record_id,
				path,
				tier: a.tier,
				reasons: a.reasons,
				last_verified: a.last_verified,
				demand_impressions: demand ? (d ? d.impressions : "UNKNOWN") : "UNKNOWN",
				paid_route: paidPaths.has(path),
				rejected_reviews: a.rejected_reviews,
				reviews_pending_owner_acknowledgement: a.reasons.filter((x) => x.cleared_by_review && !x.cleared_by_review.owner_acknowledged).length,
			};
		});
	rows.sort((x, y) => {
		const t = TIER_RANK[x.tier] - TIER_RANK[y.tier];
		if (t) return t;
		const dx = typeof x.demand_impressions === "number" ? x.demand_impressions : -1;
		const dy = typeof y.demand_impressions === "number" ? y.demand_impressions : -1;
		if (dx !== dy) return dy - dx;
		if (x.paid_route !== y.paid_route) return x.paid_route ? -1 : 1;
		return x.record_id.localeCompare(y.record_id);
	});
	const counts = {};
	const byCode = {};
	for (const r of rows) {
		counts[r.tier] = (counts[r.tier] ?? 0) + 1;
		for (const x of r.reasons) byCode[x.code] = (byCode[x.code] ?? 0) + 1;
	}
	return {
		generated_for: today,
		policy: {
			auto_overwrite: false,
			note: "This queue never edits a record. Each item needs a person to re-check the cited official source and decide.",
			thresholds: { LAST_VERIFIED_NOW_DAYS, SOURCE_AGE_NOW_DAYS, SOURCE_AGE_SOON_DAYS, FEE_DATE_STALE_DAYS, LOW_CONFIDENCE },
		},
		counts,
		reviews_pending_owner_acknowledgement: rows.filter((r) => r.reviews_pending_owner_acknowledgement > 0).map((r) => r.record_id),
		reason_counts: byCode,
		demand_source: demand ? "supplied GSC export" : "UNKNOWN (no search export supplied)",
		rows,
	};
}
