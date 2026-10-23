// Tests for the content freshness / regulatory-integrity review queue.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyReviews, assessRecord, buildFreshnessQueue, fieldFingerprint, fiscalYearMentions, latestDatedMention, validateReview } from "../scripts/lib/freshness-queue.mjs";

const env = (value, extra = {}) => ({ value, confidence: 0.9, source_ids: ["S1"], ...extra });
function record(over = {}) {
	return {
		record_id: "ca-x-y-pge",
		last_verified: "2026-10-01",
		sources: [{ id: "S1", type: "government", accessed_date: "2026-10-01", url: "https://x.gov/", publisher: "X", title: "t" }],
		permit_url: env("https://x.gov/permit"),
		permit_authority: env("City of X"),
		permit_fees: env(null),
		required_documents: env(null),
		timeline_days: env(null),
		eligibility_constraints: env(null),
		inspection_steps: env(null),
		interconnection_url: env("https://pge.com/x"),
		...over,
	};
}
const TODAY = "2026-10-21";

test("a recent, well-sourced record is CURRENT", () => {
	const a = assessRecord(record(), TODAY);
	assert.equal(a.tier, "CURRENT");
	assert.deepEqual(a.reasons, []);
});

test("old last_verified or old cited sources are REVIEW_NOW", () => {
	assert.equal(assessRecord(record({ last_verified: "2026-06-01" }), TODAY).tier, "REVIEW_NOW");
	const old = record({ sources: [{ id: "S1", type: "government", accessed_date: "2026-06-01" }] });
	const a = assessRecord(old, TODAY);
	assert.equal(a.tier, "REVIEW_NOW");
	assert.ok(a.reasons.some((r) => r.code === "SOURCE_OLD" && r.field === "permit_url"));
});

test("a value with no source is HIGH; low confidence and verification-gap notes are MEDIUM", () => {
	assert.ok(assessRecord(record({ permit_url: env("u", { source_ids: [] }) }), TODAY).reasons.some((r) => r.code === "VALUE_WITHOUT_SOURCE"));
	const low = assessRecord(record({ permit_url: env("u", { confidence: 0.6 }) }), TODAY);
	assert.equal(low.tier, "REVIEW_SOON");
	const gap = assessRecord(record({ permit_url: env("u", { notes: "pge.com returns HTTP 403; confirmed via search engine indexing" }) }), TODAY);
	assert.ok(gap.reasons.some((r) => r.code === "VERIFICATION_GAP_IN_NOTES"));
});

test("null fields are not flagged as wrong: absence stays absence", () => {
	const a = assessRecord(record({ permit_fees: env(null, { confidence: 0 }) }), TODAY);
	assert.equal(a.tier, "CURRENT");
});

test("fee schedules age by date and by fiscal year", () => {
	const dated = env([{ name: "Fee", notes: "From the fee schedule effective July 1, 2025" }]);
	assert.equal(latestDatedMention(dated), "2025-07-01");
	assert.ok(assessRecord(record({ permit_fees: dated }), TODAY).reasons.some((r) => r.code === "FEE_SCHEDULE_OVER_A_YEAR_OLD"));
	const fy = env([{ name: "Fee", notes: "FY 2025-26 schedule" }]);
	assert.deepEqual(fiscalYearMentions(fy), [2026]);
	assert.ok(assessRecord(record({ permit_fees: fy }), TODAY).reasons.some((r) => r.code === "FEE_FISCAL_YEAR_ENDED"));
	// A historical FY quoted next to the current one is not stale.
	const both = env([{ name: "Fee", notes: "FY 2020-21 history; FY 2026-27 current" }]);
	assert.ok(!assessRecord(record({ permit_fees: both }), TODAY).reasons.some((r) => r.code === "FEE_FISCAL_YEAR_ENDED"));
	// Before July the same FY is still current.
	assert.ok(!assessRecord(record({ permit_fees: fy }), "2026-03-01").reasons.some((r) => r.code === "FEE_FISCAL_YEAR_ENDED"));
});

test("SolarAPP+ pathway claims are checked against their own sources", () => {
	const claim = record({
		eligibility_constraints: env({ program_or_pathway: "SolarAPP+ automated permitting", other_conditions: [] }),
		sources: [{ id: "S1", type: "government", accessed_date: "2026-07-01" }],
	});
	assert.ok(assessRecord(claim, TODAY).reasons.some((r) => r.code === "SOLARAPP_SOURCE_AGING"));
	const unsourced = record({ eligibility_constraints: env({ program_or_pathway: "SolarAPP+", other_conditions: [] }, { source_ids: [] }), required_documents: env(null, { source_ids: [] }) });
	assert.ok(assessRecord(unsourced, TODAY).reasons.some((r) => r.code === "SOLARAPP_CLAIM_WITHOUT_SOURCE"));
});

test("utility-wide interconnection reuse is a watch item, city-specific low confidence is not", () => {
	const reused = assessRecord(record({ interconnection_url: env("u", { confidence: 0.6, notes: "Same PG&E-wide URL, reused as a utility-level fact" }) }), TODAY);
	assert.equal(reused.tier, "WATCH");
	const specific = assessRecord(record({ interconnection_url: env("u", { confidence: 0.6, notes: "city page" }) }), TODAY);
	assert.equal(specific.tier, "REVIEW_SOON");
});

test("queue orders by tier, then known demand, then paid route, and never mutates records", () => {
	const mk = (id, over) => record({ record_id: id, ...over });
	const records = [
		mk("a", {}),
		mk("b", { permit_url: env("u", { confidence: 0.5 }) }),
		mk("c", { permit_url: env("u", { confidence: 0.5 }) }),
		mk("d", { last_verified: "2026-05-01" }),
	];
	const snapshot = JSON.stringify(records);
	const demand = new Map([["/c/", { impressions: 50 }], ["/b/", { impressions: 10 }]]);
	const q = buildFreshnessQueue(records, { today: TODAY, urlFor: (r) => `/${r.record_id}/`, demand, paidPaths: new Set(["/b/"]) });
	assert.deepEqual(q.rows.map((r) => r.record_id), ["d", "c", "b", "a"]);
	assert.equal(q.rows.find((r) => r.record_id === "a").demand_impressions, "UNKNOWN");
	assert.equal(q.policy.auto_overwrite, false);
	assert.equal(JSON.stringify(records), snapshot);
	const noDemand = buildFreshnessQueue(records, { today: TODAY, urlFor: (r) => `/${r.record_id}/` });
	assert.match(noDemand.demand_source, /UNKNOWN/);
	assert.throws(() => buildFreshnessQueue(records, { today: "yesterday", urlFor: () => "/" }));
});

const staleFees = () => record({ permit_fees: env([{ name: "Fee", notes: "Fee schedule effective July 1, 2025" }]) });
const review = (over = {}) => ({
	record_id: "ca-x-y-pge",
	field: "permit_fees",
	outcome: "CONFIRMED_CURRENT",
	reviewed_on: "2026-10-20",
	reviewer: "agent",
	field_sha256: fieldFingerprint(staleFees().permit_fees),
	evidence: { url: "https://x.gov/fees", observed: "Solar PV projects: $50 flat fee, all projects." },
	...over,
});
const apply = (rec, reviews, today = TODAY) => applyReviews(assessRecord(rec, today), rec, reviews, today);

test("a dated review that confirms the record is current clears a fee-date flag, for 90 days", () => {
	assert.equal(assessRecord(staleFees(), TODAY).tier, "REVIEW_NOW");
	const cleared = apply(staleFees(), [review()]);
	assert.equal(cleared.tier, "CURRENT");
	assert.ok(cleared.reasons.every((r) => r.severity === "INFO" && r.cleared_by_review));
	assert.equal(cleared.reasons[0].cleared_by_review.owner_acknowledged, false);
	assert.equal(apply(staleFees(), [review({ owner_acknowledged_by: "owner" })]).reasons[0].cleared_by_review.owner_acknowledged, true);
	assert.equal(apply(staleFees(), [review({ reviewed_on: "2026-06-01" })]).tier, "REVIEW_NOW");
});

test("a review applies only to the field content it checked, and only with evidence from the record's own source hosts", () => {
	const edited = record({ permit_fees: env([{ name: "Fee", notes: "Fee schedule effective July 1, 2025 (edited: now $75)" }]) });
	const r1 = apply(edited, [review()]);
	assert.equal(r1.tier, "REVIEW_NOW");
	assert.ok(r1.rejected_reviews[0].problems.some((p) => /field changed/.test(p)));
	const offHost = apply(staleFees(), [review({ evidence: { url: "https://evil.example/fees", observed: "Solar PV projects: $50 flat fee, all projects." } })]);
	assert.equal(offHost.tier, "REVIEW_NOW");
	assert.ok(offHost.rejected_reviews[0].problems.some((p) => /cited source hosts/.test(p)));
});

test("reviews cannot clear what needs a data change, other records or an unreachable source", () => {
	const lowConf = record({ permit_fees: env([{ name: "Fee", notes: "effective July 1, 2025" }], { confidence: 0.5 }) });
	const still = apply(lowConf, [review({ field_sha256: fieldFingerprint(lowConf.permit_fees) })]);
	assert.ok(still.reasons.some((r) => r.code === "LOW_CONFIDENCE" && r.severity === "MEDIUM"));
	assert.equal(apply(staleFees(), [review({ record_id: "other" })]).tier, "REVIEW_NOW");
	assert.equal(apply(staleFees(), [review({ outcome: "UNREACHABLE" })]).tier, "REVIEW_NOW");
});

test("a review that found a change escalates instead of clearing", () => {
	const r = apply(staleFees(), [review({ outcome: "CHANGED" })]);
	assert.equal(r.tier, "REVIEW_NOW");
	assert.ok(r.reasons.some((x) => x.code === "REVIEW_FOUND_CHANGE"));
});

test("malformed reviews are ignored and reported, never trusted", () => {
	assert.deepEqual(validateReview(review()), []);
	for (const bad of [{ evidence: { url: "http://x", observed: "Solar PV projects: $50 flat fee." } }, { evidence: { url: "https://x.gov", observed: "short" } }, { reviewed_on: "today" }, { reviewer: "" }, { field: "permit_url" }, { outcome: "FINE" }, { field_sha256: "abc" }]) {
		assert.ok(validateReview(review(bad)).length > 0, JSON.stringify(bad));
	}
	const r = apply(staleFees(), [review({ reviewer: "" })]);
	assert.equal(r.tier, "REVIEW_NOW");
	assert.equal(r.rejected_reviews.length, 1);
});

test("the queue lists agent-cleared records that still await the owner's acknowledgement", () => {
	const q = buildFreshnessQueue([staleFees()], { today: TODAY, urlFor: () => "/x/", reviews: [review()] });
	assert.deepEqual(q.reviews_pending_owner_acknowledgement, ["ca-x-y-pge"]);
	assert.equal(q.rows[0].tier, "CURRENT");
});

test("the checked-in review file is valid and matches the live Denver record", () => {
	const f = JSON.parse(readFileSync("data/freshness/reviews.json", "utf8"));
	assert.ok(f.reviews.length >= 1);
	for (const r of f.reviews) assert.deepEqual(validateReview(r), [], r.record_id);
	for (const r of f.reviews) {
		const rec = JSON.parse(readFileSync(`data/localities/${r.record_id}.json`, "utf8"));
		assert.equal(r.field_sha256, fieldFingerprint(rec[r.field]), `${r.record_id}: reviewed field changed; re-review it`);
	}
});
