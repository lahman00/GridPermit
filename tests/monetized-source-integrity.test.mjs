import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isCompareSolarServedLocality } from "../src/lib/compare-solar-prices.ts";
import { hasVerifiedUnambiguousUtility } from "../src/lib/utility-split-guard.ts";
import { formatTimeline } from "../src/lib/locality-guide.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "data/localities");
const records = readdirSync(dir)
	.filter((n) => n.endsWith(".json"))
	.map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")));
const byId = (id) => records.find((r) => r.record_id === id);

// Same served-locality + unambiguous-utility gate the production CTA applies.
const monetized = records.filter(
	(r) => r.state === "CA" && isCompareSolarServedLocality("CA", r.city.value) && hasVerifiedUnambiguousUtility(r),
);

test("the monetized cohort selected by the production gate is large enough to be meaningful", () => {
	assert.ok(monetized.length > 50, `got ${monetized.length}`);
});

test("a utility-stage duration is never shown as a permit timeline on a page with a paid route (Glendale regression)", () => {
	for (const r of monetized) {
		const td = r.timeline_days.value;
		if (!td) continue;
		const notes = td.notes ?? "";
		assert.doesNotMatch(
			notes,
			/initial review of your PV Interconnection|interconnection[- ]application review|GWP Solar Team|\bcovers only\b[^.]*\b(GWP|utility|interconnection)\b/i,
			`${r.record_id}: timeline notes describe a utility-only stage`,
		);
	}
});

test("Glendale: no permit timeline is displayed, and the true 3-5 business day GWP review time is kept as interconnection context", () => {
	const g = byId("ca-los-angeles-glendale-gwp");
	assert.equal(g.timeline_days.value, null);
	assert.equal(formatTimeline(g.timeline_days.value).label, "Not yet verified.");
	assert.match(g.interconnection_url.notes, /initial review of the PV Interconnection Application[^.]*3-5 business days/);
	assert.match(g.interconnection_url.notes, /utility's review stage only/);
	assert.match(g.interconnection_url.notes, /7-10 working days/);
});

test("Baldwin Park no longer uses the superseded FY 2020-21 fee schedule", () => {
	const b = byId("ca-los-angeles-baldwin-park-sce");
	const s9 = b.sources.find((s) => s.id === "S9");
	assert.ok(s9);
	assert.doesNotMatch(s9.title, /2020\s*(?:to|[-–])\s*2021/i);
	assert.match(s9.title, /FY 2025-26/);
	assert.doesNotMatch(b.permit_fees.notes ?? "", /indicative rather than confirmed-current/i);
});

test("Baldwin Park: fee cites the current City-wide schedule, flags the separate plan-review fee as unverified, and eligibility rests on the municipal code", () => {
	const b = byId("ca-los-angeles-baldwin-park-sce");
	assert.deepEqual(b.permit_fees.source_ids, ["S9"]);
	const s9 = b.sources.find((s) => s.id === "S9");
	assert.match(s9.title, /FY 2025-26/);
	assert.match(s9.url, /baldwinpark\.com\/DocumentCenter\/View\/3937/);
	assert.match(b.permit_fees.notes, /plan-review fee is not verified/);
	assert.ok(b.permit_fees.confidence >= 0.8);
	const e = b.eligibility_constraints;
	assert.equal(e.value.system_size_kw_ac_max, 10);
	assert.deepEqual(e.source_ids, ["S10"]);
	assert.match(b.sources.find((s) => s.id === "S10").url, /codelibrary\.amlegal\.com\/codes\/baldwinpark/);
	// The five-working-day code commitment depends on a checklist the City site does not publish: it must not be shown as a timeline.
	assert.equal(b.timeline_days.value, null);
});

test("every fee amount on a paid-route page cites a source that exists on the record", () => {
	for (const r of monetized) {
		const env = r.permit_fees;
		if (!(env.value ?? []).some((f) => f.amount_usd != null)) continue;
		assert.ok((env.source_ids ?? []).length > 0, `${r.record_id}: fee has no source id`);
		const ids = new Set(r.sources.map((s) => s.id));
		for (const id of env.source_ids) assert.ok(ids.has(id), `${r.record_id}: unknown fee source ${id}`);
	}
});
