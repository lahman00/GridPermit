import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { formatTimeline } from "../src/lib/locality-guide.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "data/localities");
const records = readdirSync(dir)
	.filter((n) => n.endsWith(".json"))
	.map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")));
const byId = (id) => records.find((r) => r.record_id === id);
const read = (p) => readFileSync(path.join(root, p), "utf8");

// ---------------------------------------------------------------- Lane A

test("a fee amount is never shown when its own note says it is not a solar figure (Loma Linda regression)", () => {
	// Scoped to the proven defect: a general building-fee range described as "not a solar-specific figure".
	// (Records that list a real, applicable fee which also covers non-solar work are a different class.)
	for (const r of records) {
		for (const f of r.permit_fees.value ?? []) {
			if (f.amount_usd == null) continue;
			assert.doesNotMatch(
				`${f.name ?? ""} ${f.notes ?? ""}`,
				/not a solar[- ]specific (figure|amount|fee)|\(general, varies by project scope\)/i,
				`${r.record_id}: ${f.name}`,
			);
		}
	}
});

test("Loma Linda shows no solar permit fee or timeline, and says why instead of showing a generic one", () => {
	const ll = byId("ca-san-bernardino-loma-linda-sce");
	assert.equal(ll.permit_fees.value, null);
	assert.deepEqual(ll.permit_fees.source_ids, []);
	assert.match(ll.permit_fees.notes, /No solar-specific permit fee/);
	assert.match(ll.permit_fees.notes, /Not shown as a solar permit fee/);
	assert.equal(ll.timeline_days.value, null);
	assert.equal(formatTimeline(ll.timeline_days.value).label, "Not yet verified.");
	// The generic 15-30 working day / $39.50 figures must not reappear as data.
	assert.doesNotMatch(JSON.stringify({ f: ll.permit_fees.value, t: ll.timeline_days.value }), /39\.5|15|30/);
});

// ---------------------------------------------------------------- Lane B

// Phrases a timeline note uses when it admits the figure is a utility/interconnection stage rather
// than the permitting authority's own review.
const UTILITY_STAGE_NOTE =
	/utility[- ]side|utility interconnection (timeline|stage)|covers only[^.]*\b(utility|GWP|interconnection)\b|\bnot the (City|County)( of [A-Z][\w ]*?)?['’]?s own (building[- ])?permit|initial review of (your|the) [^.]*interconnection|Electric (Utility|Department)['’]?s? (own )?(initial|application|plan)|LEU['’]?s (pre-approval )?review|Net Metering application review/i;

// Records reviewed in this cleanup whose timeline_days was a utility stage and has been removed.
const FIXED_UTILITY_STAGE = {
	"ca-riverside-banning-beu": [/up to 45 days[^.]*application[^.]*plan check up to a further 45 days/i, /Electric Utility's own stages/],
	"ca-san-joaquin-lodi-leu": [/pre-approval review[^.]*up to two weeks/i, /ten business days/],
	"ca-shasta-shasta-lake-slmu": [/Electric Department 30 days[^.]*initial review/i, /separate building permit application/],
	"ok-oklahoma-oklahomacity-oge": [/Net Metering application review process is 30 business days/i, /up to seven business days/],
};

// Known, reported, not-yet-fixed records with the same defect. The set must match exactly: a new
// record with the defect fails the test, and fixing one of these forces its removal from the list.
const KNOWN_UNFIXED_UTILITY_STAGE = new Set([
	"de-new-castle-new-castle-county-delmarva",
	"mi-washtenaw-annarbor-dte",
	"wv-kanawha-charleston-appalachianpower",
]);

test("a timeline whose note admits it is a utility stage is only allowed on the explicit known-follow-up list", () => {
	const flagged = records
		.filter((r) => r.timeline_days.value && UTILITY_STAGE_NOTE.test(r.timeline_days.value.notes ?? ""))
		.map((r) => r.record_id)
		.sort();
	assert.deepEqual(flagged, [...KNOWN_UNFIXED_UTILITY_STAGE].sort());
});

test("utility-stage durations were removed from timeline_days and kept, labelled, as interconnection context", () => {
	for (const [id, patterns] of Object.entries(FIXED_UTILITY_STAGE)) {
		const r = byId(id);
		assert.equal(r.timeline_days.value, null, id);
		assert.deepEqual(r.timeline_days.source_ids, [], id);
		assert.match(r.timeline_days.notes, /recorded under the interconnection field/, id);
		assert.equal(formatTimeline(r.timeline_days.value).label, "Not yet verified.", id);
		for (const p of patterns) assert.match(r.interconnection_url.notes, p, `${id}: ${p}`);
	}
});

test("changing a timeline cannot change routing: no commercial or eligibility gate reads timeline_days", () => {
	const gates = [
		"src/lib/commercial",
		"src/lib/compare-solar-prices.ts",
		"src/lib/utility-split-guard.ts",
		"src/components/InstallerCTA.astro",
		"src/components/CompareSolarPricesCTA.astro",
	];
	const files = [];
	for (const g of gates) {
		const full = path.join(root, g);
		try {
			for (const f of readdirSync(full)) files.push(path.join(g, f));
		} catch {
			files.push(g);
		}
	}
	assert.ok(files.length >= 5);
	for (const f of files) {
		if (!/\.(ts|astro|mjs)$/.test(f)) continue;
		assert.doesNotMatch(read(f), /timeline_days|timelineDays/, f);
	}
});
