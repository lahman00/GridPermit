// California permit data page and CSV: every value comes from a READY city's
// own record; an automated path is counted only when a sourced field states
// it affirmatively (never from notes, never from "solar application", never
// from a negative or unconfirmed statement); platform fees are kept apart
// from city and utility fees; split utilities are labelled; and the CSV is
// safe to open in a spreadsheet.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
	AUTOMATED_PATH_PATTERN,
	CEC_DASHBOARD_URL,
	CSV_BOM,
	CSV_COLUMNS,
	FEE_RECHECK,
	PERMIT_DATA_CSV_PATH,
	PERMIT_DATA_PATH,
	automatedPathEvidence,
	buildPermitDataRows,
	csvCell,
	formatFee,
	kindFromText,
	normalizeCounty,
	percentOf,
	permitDataCsv,
	summarizePermitData,
	toPermitDataRow,
	utilityLabel,
} from "../src/lib/permit-data-study.ts";
import { ANALYTICS_EVENTS } from "../src/lib/analytics-events.ts";
import { hasVerifiedUnambiguousUtility } from "../src/lib/utility-split-guard.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

function loadData() {
	const recordsById = new Map();
	for (const name of readdirSync(path.join(root, "data/localities")).filter((n) => n.endsWith(".json"))) {
		const record = JSON.parse(read(`data/localities/${name}`));
		recordsById.set(record.record_id, record);
	}
	const evaluated = readdirSync(path.join(root, "output"))
		.filter((n) => n.endsWith("-evaluation.json"))
		.flatMap((n) => JSON.parse(read(`output/${n}`)).records ?? []);
	return { recordsById, evaluated };
}

const baseRecord = (overrides = {}) => ({
	record_id: "ca-test-alpha-sce",
	state: "CA",
	city: { value: "Alpha", source_ids: ["S1"] },
	county: { value: "Test", source_ids: ["S1"] },
	utility: { value: "Southern California Edison (SCE)", source_ids: ["S2"] },
	generation_supplier: { value: null },
	permit_authority: { value: "City of Alpha Building", confidence: 0.9, source_ids: ["S1"] },
	permit_url: { value: "https://www.alpha.example.gov/building", confidence: 0.9, source_ids: ["S1"] },
	interconnection_url: { value: null },
	timeline_days: { value: null },
	battery_programs: { value: null },
	rebates: { value: null },
	permit_fees: { value: null, confidence: 0, source_ids: [] },
	required_documents: { value: null },
	inspection_steps: { value: null },
	eligibility_constraints: { value: { program_or_pathway: "Standard plan check", other_conditions: [] }, confidence: 0.8, source_ids: ["S1"] },
	official_contacts: { value: null },
	sources: [{ id: "S1", title: "Building", url: "https://www.alpha.example.gov/building" }],
	last_verified: "2026-08-09",
	...overrides,
});

test("automated path: pathway field first, then other sourced fields, never notes or negatives", () => {
	const ev = (o) => automatedPathEvidence(baseRecord(o));
	assert.equal(ev({}), null);
	assert.deepEqual(ev({ eligibility_constraints: { value: { program_or_pathway: "SolarAPP+ (residential)" }, confidence: 0.8, source_ids: ["S1"] } })?.evidence, "pathway field");
	assert.equal(ev({ required_documents: { value: [{ name: "SolarAPP+ Approval ID number and approval documents" }], source_ids: ["S1"] } })?.evidence, "required documents");
	assert.equal(ev({ required_documents: { value: [{ name: "SolarAPP+ Approval Document" }], source_ids: [] } }), null, "unsourced field ignored");
	assert.equal(ev({ inspection_steps: { value: ["SolarAPP+ plans and job cards must be present"], source_ids: ["S1"] } })?.evidence, "inspection steps");
	assert.equal(ev({ permit_url: { value: "https://www.city.example.gov/1694/Solar-APP", source_ids: ["S1"] } })?.evidence, "permit page address");
	assert.equal(ev({ inspection_steps: { value: ["Installer submits the solar application through PowerClerk"], source_ids: ["S1"] } }), null, "solar application is not SolarAPP+");
	assert.equal(ev({ eligibility_constraints: { value: { program_or_pathway: "Standard", other_conditions: ["SolarAPP+ coming soon"] }, confidence: 0.8, source_ids: ["S1"] } }), null);
	assert.equal(ev({ eligibility_constraints: { value: { program_or_pathway: "Standard", other_conditions: ["Independent reporting (not confirmed) describes a Symbium pathway"] }, confidence: 0.8, source_ids: ["S1"] } }), null);
	assert.equal(ev({ permit_url: { value: "https://www.alpha.example.gov/building", source_ids: ["S1"], notes: "City page says SolarAPP+ is available" } }), null, "notes are never read");
	assert.equal(ev({ sources: [{ id: "S9", title: "SolarAPP+: What types of systems are eligible", url: "https://help.gosolarapp.org/article/43" }] }), null, "vendor pages are not city evidence");
	assert.equal(ev({ sources: [{ id: "S9", title: "SolarApp+ for Solar Installers", url: "https://www.city.example.gov/solar" }] })?.evidence, "cited city page");
	assert.equal(kindFromText("Symbium/SolarApp automated permitting portal"), "SolarAPP+ and Symbium");
	assert.equal(kindFromText("Photovoltaic Real Time (PRT) Permit"), "Other automated");
	assert.equal(String(AUTOMATED_PATH_PATTERN), "/solarapp|symbium|automated|instant/i");
});

test("fees: city and utility amounts apart from platform fees; non-residential and re-check entries left out", () => {
	const fees = (value) => toPermitDataRow(baseRecord({ permit_fees: { value, confidence: 0.85, source_ids: ["S1"] } }), "/x/");
	const row = fees([
		{ name: "Residential solar permit", amount_usd: 300, unit: "flat fee" },
		{ name: "SolarAPP+ processing fee", amount_usd: 25, unit: "flat" },
		{ name: "Commercial PV permit", amount_usd: 1000, unit: "flat" },
		{ name: "Sample total permit fee, 3 kW", amount_usd: 500, unit: "sample total" },
	]);
	assert.deepEqual(row.fees.map((f) => f.amountUsd), [300]);
	assert.deepEqual(row.platformFees.map((f) => f.amountUsd), [25]);
	for (const id of Object.keys(FEE_RECHECK)) {
		const r = toPermitDataRow(baseRecord({ record_id: id, permit_fees: { value: [{ name: "Residential", amount_usd: 175, unit: "per kW" }], confidence: 0.9, source_ids: ["S1"] } }), "/x/");
		assert.deepEqual(r.fees, [], id);
		assert.ok(r.feeRecheck, id);
	}
	assert.equal(formatFee({ name: "Permit", amountUsd: 1200, unit: "flat fee" }), "$1,200 Permit (flat fee)");
});

test("utility and county labels", () => {
	assert.equal(utilityLabel({ utility: "SCE", utilitySplit: false }), "SCE");
	assert.equal(utilityLabel({ utility: "SCE", utilitySplit: true }), "Split territory (SCE listed)");
	assert.equal(normalizeCounty("CA", "Los Angeles"), "Los Angeles County");
	assert.equal(normalizeCounty("CA", "Riverside County"), "Riverside County");
	assert.equal(normalizeCounty("CA", "City and County of San Francisco"), "City and County of San Francisco");
	assert.equal(normalizeCounty("CA", null), null);
});

test("CSV is quoted per RFC 4180, starts with a BOM and never starts a cell like a formula", () => {
	assert.equal(csvCell(null), "");
	assert.equal(csvCell('a "quoted", value'), '"a ""quoted"", value"');
	assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
	assert.equal(csvCell("@x"), "'@x");
	assert.equal(percentOf(1, 3), 33);
	const csv = permitDataCsv([toPermitDataRow(baseRecord(), "/california/alpha/solar-permit-guide/")]);
	assert.ok(csv.startsWith(CSV_BOM));
	assert.equal(csv.slice(1).split("\r\n")[0], CSV_COLUMNS.join(","));
	assert.ok(csv.endsWith("\r\n"));
});

test("real data: one row per READY California guide, labels match the records, counts add up", () => {
	const { recordsById, evaluated } = loadData();
	const rows = buildPermitDataRows(evaluated, recordsById, "CA");
	const readyCa = new Set(evaluated.filter((r) => r.readiness === "READY" && recordsById.get(r.record_id)?.state === "CA").map((r) => r.record_id));
	assert.equal(rows.length, readyCa.size);
	assert.equal(new Set(rows.map((r) => r.recordId)).size, rows.length);
	for (const row of rows) {
		const record = recordsById.get(row.recordId);
		assert.ok(readyCa.has(row.recordId));
		assert.match(row.guideUrl, /^\/california\/[a-z0-9-]+\/solar-permit-guide\/$/);
		assert.equal(row.utilitySplit, !hasVerifiedUnambiguousUtility(record), row.recordId);
		if (row.automatedEvidence) assert.doesNotMatch(row.automatedEvidenceText, /coming soon|not confirmed|solar application/i, row.recordId);
		if (row.permitUrl) assert.match(row.permitUrl, /^https?:\/\//);
		for (const fee of row.fees) assert.doesNotMatch(fee.name, /commercial|multi-?family|non-?residential|sample total/i, row.recordId);
	}
	// Records that state SolarAPP+ outside the pathway field are counted.
	const byCity = new Map(rows.map((r) => [r.city, r]));
	for (const city of ["Sacramento", "Riverside", "Sunnyvale", "Folsom", "Richmond", "Coronado"]) assert.ok(byCity.get(city)?.automatedKind, city);
	for (const city of ["Pasadena", "Redondo Beach", "Irvine"]) assert.ok(!byCity.get(city) || byCity.get(city).automatedEvidence !== "inspection steps" && byCity.get(city).automatedEvidence !== "conditions", city);
	const s = summarizePermitData(rows);
	assert.equal(s.total, rows.length);
	assert.equal(s.automated, s.fromPathwayField + s.fromOtherFields);
	assert.equal(Object.values(s.byKind).reduce((a, b) => a + b, 0), s.automated);
	assert.equal(s.utilities.reduce((a, u) => a + u.count, 0) + s.splitUtility, s.total);
	assert.ok(s.automated > s.fromPathwayField, "evidence from other fields is counted");
	const csv = permitDataCsv(rows);
	assert.ok(csv.includes("https://mygridpermit.com/california/"));
});

test("page, CSV route, links, headers and analytics are wired", () => {
	assert.equal(PERMIT_DATA_PATH, "/california/solar-permit-data/");
	assert.equal(PERMIT_DATA_CSV_PATH, "/california/solar-permit-data.csv");
	const page = read("src/pages/california/solar-permit-data.astro");
	assert.match(page, /"@type": "Dataset"/);
	assert.match(page, /creativecommons\.org\/licenses\/by\/4\.0/);
	assert.equal((page.match(/data-track-click="permit_data_downloaded"/g) ?? []).length, 2, "both CSV links are tracked");
	assert.match(page, /A blank cell means\s+our record does not state it, not that the city lacks it/);
	assert.match(page, /not<\/strong> a statewide census or an SB 379 compliance assessment|What it is not:<\/strong> a statewide census or an SB 379 compliance assessment/);
	assert.ok(page.includes("CEC_DASHBOARD_URL"));
	assert.match(CEC_DASHBOARD_URL, /^https:\/\/www\.energy\.ca\.gov\//);
	assert.doesNotMatch(page, /onsubmit=|onclick=/);
	assert.ok(ANALYTICS_EVENTS.includes("permit_data_downloaded"));
	const toml = read("netlify.toml");
	assert.match(toml, /for = "\/california\/solar-permit-data\.csv"\s*\n\s*\[headers\.values\]\s*\n\s*X-Robots-Tag = "noindex"\s*\n\s*Content-Type = "text\/csv; charset=utf-8"/);
	for (const hub of ["src/pages/index.astro", "src/pages/california/index.astro", "src/pages/california/solar-permit-guides.astro", "src/pages/california/solar-permit-timeline.astro"]) {
		assert.match(read(hub), /href="\/california\/solar-permit-data\/"/, hub);
	}
	assert.match(read("src/lib/sitemap-policy.ts"), /routeDates\.set\("\/california\/solar-permit-data\/", lastmod\)/);
});
