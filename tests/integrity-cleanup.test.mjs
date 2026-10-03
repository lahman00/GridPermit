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

test("Loma Linda uses the current solar-specific fee and requirements, while keeping the generic timeline out", () => {
	const ll = byId("ca-san-bernardino-loma-linda-sce");
	assert.equal(ll.timeline_days.value, null);
	assert.equal(formatTimeline(ll.timeline_days.value).label, "Not yet verified.");

	const fees = new Map((ll.permit_fees.value ?? []).map((f) => [f.name, f.amount_usd]));
	assert.equal(fees.get("Residential Solar Photovoltaic Permit"), 275);
	assert.equal(fees.get("Residential Solar Photovoltaic Permit - each kW above 15 kW"), 15);
	assert.deepEqual(ll.permit_fees.source_ids, ["S8"]);

	const names = (ll.required_documents.value ?? []).map((d) => d.name).join(" | ");
	assert.match(names, /Two sets of plans/);
	assert.match(names, /Single-line diagram/);
	assert.match(names, /Roof-load calculations/);
	assert.deepEqual(ll.required_documents.source_ids, ["S7"]);

	const source7 = ll.sources.find((s) => s.id === "S7");
	const source8 = ll.sources.find((s) => s.id === "S8");
	assert.match(source7?.url ?? "", /Residential%20Solar%20Minimum%20Requirements\.pdf/);
	assert.match(source8?.url ?? "", /Planning%20and%20Building%20Fees%20Nov2025\.docx/);

	// The generic FAQ figures must not reappear as solar data.
	const solarData = JSON.stringify({ f: ll.permit_fees.value, t: ll.timeline_days.value });
	assert.doesNotMatch(solarData, /39\.5|15 to 30 working days/i);
});

test("Banning uses Building & Safety as the permit authority and keeps BEU program charges out of permit fees", () => {
	const b = byId("ca-riverside-banning-beu");
	assert.equal(b.permit_authority.value, "City of Banning Building & Safety Division");
	assert.match(b.permit_url.value, /\/944\/Solar-Permits$/);
	assert.match(b.eligibility_constraints.value.program_or_pathway, /Banning Electric.*Symbium.*Building & Safety/s);
	assert.equal(b.permit_fees.value, null);
	assert.match(b.permit_fees.notes ?? "", /utility\/interconnection program/i);
	assert.match(b.interconnection_url.notes ?? "", /\$500 utility-program contribution/i);
	assert.match(b.interconnection_url.notes ?? "", /\$245 production meter/i);
	assert.match(b.interconnection_url.notes ?? "", /\$255 utility application\/plan-check\/inspection review/i);
	const s4 = b.sources.find((s) => s.id === "S4");
	const s5 = b.sources.find((s) => s.id === "S5");
	assert.match(s4?.url ?? "", /\/944\/Solar-Permits$/);
	assert.match(s5?.url ?? "", /\/71\/Building-Safety$/);
});

// ---------------------------------------------------------------- Lane B

// Phrases a timeline note uses when it admits the figure is a utility/interconnection stage rather
// than the permitting authority's own review.
const UTILITY_STAGE_NOTE =
	/utility[- ]side|utility interconnection (timeline|stage)|covers only[^.]*\b(utility|GWP|interconnection)\b|\bnot the (City|County)( of [A-Z][\w ]*?)?['’]?s own (building[- ])?permit|initial review of (your|the) [^.]*interconnection|Electric (Utility|Department)['’]?s? (own )?(initial|application|plan)|LEU['’]?s (pre-approval )?review|Net Metering application review/i;

// Records reviewed in this cleanup whose timeline_days was a utility stage and has been removed.
const FIXED_UTILITY_STAGE = {
	"ca-riverside-banning-beu": [/application review can take up to 45 days/i, /plan check up to a further 45 days/i, /utility stages/i],
	"ca-san-joaquin-lodi-leu": [/pre-approval review[^.]*up to two weeks/i, /ten business days/],
	"ca-shasta-shasta-lake-slmu": [/Electric Department 30 days[^.]*initial review/i, /separate building permit application/],
	"ok-oklahoma-oklahomacity-oge": [/Net Metering application review process is 30 business days/i, /up to seven business days/],
	"wv-kanawha-charleston-appalachianpower": [/within 10 business days/, /further 10 business days/, /Those are utility steps, not a City permit review time/],
	"de-new-castle-new-castle-county-delmarva": [/approximately 77 business days/, /utility's full process[^.]*not a County permit review time/],
	"mi-washtenaw-annarbor-dte": [/approximately six weeks/, /within 10 business days/, /not a City of Ann Arbor permit review time/],
};

// Known, reported, not-yet-fixed records with the same defect. The set must match exactly: a new
// record with the defect fails the test, and fixing one of these forces its removal from the list.
// (Currently empty: Charleston, New Castle County and Ann Arbor were the last three.)
const KNOWN_UNFIXED_UTILITY_STAGE = new Set([]);

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

test("no record cites a QA, dev or staging hostname as a source or interconnection link (Ann Arbor regression)", () => {
	const STAGING_HOST = /^(aem-)?(qa|dev|stg|stage|staging|uat|test)\d*[.-]|[.-](qa|dev|stg|staging|uat)\d*\./i;
	const urls = (r) => [
		...r.sources.map((s) => s.url),
		r.permit_url?.value,
		r.interconnection_url?.value,
	].filter(Boolean);
	for (const r of records) {
		for (const u of urls(r)) {
			let host;
			try {
				host = new URL(u).hostname;
			} catch {
				continue;
			}
			assert.doesNotMatch(host, STAGING_HOST, `${r.record_id}: ${u}`);
		}
	}
});

test("Ann Arbor cites production DTE sources for the interconnection claims it makes", () => {
	const a = byId("mi-washtenaw-annarbor-dte");
	const ids = new Set(a.interconnection_url.source_ids);
	for (const id of ["S2", "S3", "S4"]) {
		assert.ok(ids.has(id), id);
		const s = a.sources.find((x) => x.id === id);
		assert.match(new URL(s.url).hostname, /(^|\.)dteenergy\.com$/, s.url);
	}
	// The $50 Level 1 fee is DTE's, shown beside the City's $0 fee, and cites the DTE procedures document.
	assert.ok(a.permit_fees.source_ids.includes("S4"));
});
