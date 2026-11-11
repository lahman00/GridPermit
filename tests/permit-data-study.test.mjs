// California permit data page and CSV: every value comes from a READY city's
// own record, the automated-path rule matches the Permit Path checker, fees
// need a confident, sourced dollar amount, and the CSV is safe to open in a
// spreadsheet.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
	AUTOMATED_PATH_PATTERN,
	CSV_COLUMNS,
	MIN_FEE_CONFIDENCE,
	PERMIT_DATA_CSV_PATH,
	PERMIT_DATA_PATH,
	automatedKindFor,
	buildPermitDataRows,
	csvCell,
	formatFee,
	percentOf,
	permitDataCsv,
	publishedFees,
	summarizePermitData,
	toPermitDataRow,
} from "../src/lib/permit-data-study.ts";
import { ANALYTICS_EVENTS } from "../src/lib/analytics-events.ts";

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
	county: { value: "Test County", source_ids: ["S1"] },
	utility: { value: "Southern California Edison (SCE)", source_ids: ["S2"] },
	generation_supplier: { value: null },
	permit_authority: { value: "City of Alpha Building", confidence: 0.9, source_ids: ["S1"] },
	permit_url: { value: "https://www.alpha.example.gov/solar", confidence: 0.9, source_ids: ["S1"] },
	interconnection_url: { value: null },
	timeline_days: { value: null },
	battery_programs: { value: null },
	rebates: { value: null },
	permit_fees: { value: null, confidence: 0, source_ids: [] },
	required_documents: { value: null },
	inspection_steps: { value: null },
	eligibility_constraints: { value: { program_or_pathway: "SolarAPP+", other_conditions: [] }, confidence: 0.8, source_ids: ["S1"] },
	official_contacts: { value: null },
	sources: [{ id: "S1", title: "City", url: "https://www.alpha.example.gov/solar" }],
	last_verified: "2026-08-09",
	...overrides,
});

test("automated path kind follows the Permit Path checker's rule", () => {
	const checker = read("src/pages/permit-path.astro");
	assert.match(checker, /\/solarapp\|symbium\|automated\|instant\/i\.test\(program\)/);
	assert.equal(String(AUTOMATED_PATH_PATTERN), "/solarapp|symbium|automated|instant/i");
	assert.equal(automatedKindFor("SolarAPP+ (residential, roof-mounted)"), "SolarAPP+");
	assert.equal(automatedKindFor("Symbium automated permitting platform"), "Symbium");
	assert.equal(automatedKindFor("Photovoltaic Real Time (PRT) Permit (SB 379 automated real-time process)"), "Other automated");
	assert.equal(automatedKindFor("Small Residential Rooftop Solar Energy System expedited permitting"), null);
	assert.equal(automatedKindFor(null), null);
	assert.equal(automatedKindFor(""), null);
});

test("published fees need a confident, sourced, numeric amount", () => {
	const fee = (value, confidence = 0.8, source_ids = ["S1"]) => publishedFees(baseRecord({ permit_fees: { value, confidence, source_ids } }));
	assert.deepEqual(fee([{ name: "Permit", amount_usd: 300, unit: "flat fee" }]), [{ name: "Permit", amountUsd: 300, unit: "flat fee" }]);
	assert.deepEqual(fee([{ name: "Permit", amount_usd: 300 }], MIN_FEE_CONFIDENCE - 0.01), []);
	assert.deepEqual(fee([{ name: "Permit", amount_usd: 300 }], 0.9, []), []);
	assert.deepEqual(fee([{ name: "Permit", amount_usd: null, notes: "not stated" }]), []);
	assert.deepEqual(fee([{ name: "Waived", amount_usd: 0 }]), [{ name: "Waived", amountUsd: 0, unit: null }]);
	assert.deepEqual(fee([{ name: "Bad", amount_usd: -5 }]), []);
	assert.deepEqual(fee(null), []);
});

test("a row keeps only sourced, safe values", () => {
	const row = toPermitDataRow(baseRecord(), "/california/alpha/solar-permit-guide/");
	assert.equal(row.city, "Alpha");
	assert.equal(row.permitAuthority, "City of Alpha Building");
	assert.equal(row.permitUrl, "https://www.alpha.example.gov/solar");
	assert.equal(row.automatedKind, "SolarAPP+");
	assert.equal(row.pathwayConfidence, 0.8);
	assert.equal(row.utility, "SCE");

	const unsafe = toPermitDataRow(baseRecord({ permit_url: { value: "javascript:alert(1)", source_ids: ["S1"] } }), "/x/");
	assert.equal(unsafe.permitUrl, null);
	const unsourced = toPermitDataRow(baseRecord({ permit_authority: { value: "City of Alpha", source_ids: [] } }), "/x/");
	assert.equal(unsourced.permitAuthority, null);
	const standard = toPermitDataRow(baseRecord({ eligibility_constraints: { value: { program_or_pathway: "Standard plan check" }, confidence: 0.9 } }), "/x/");
	assert.equal(standard.automatedKind, null);
	assert.equal(standard.automatedProgram, null);
	assert.equal(standard.pathwayConfidence, null);
});

test("CSV cells are quoted per RFC 4180 and never start like a formula", () => {
	assert.equal(csvCell(null), "");
	assert.equal(csvCell("plain"), "plain");
	assert.equal(csvCell('a "quoted", value'), '"a ""quoted"", value"');
	assert.equal(csvCell("line\nbreak"), '"line\nbreak"');
	assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
	assert.equal(csvCell("+1"), "'+1");
	assert.equal(csvCell("@x"), "'@x");
	assert.equal(csvCell(0.7), "0.7");
	assert.equal(formatFee({ name: "Permit", amountUsd: 1200, unit: "flat fee" }), "$1,200 Permit (flat fee)");
	assert.equal(formatFee({ name: "Fee", amountUsd: 12.5, unit: null }), "$12.50 Fee");
	assert.equal(percentOf(1, 3), 33);
	assert.equal(percentOf(1, 0), 0);
});

test("real data: one row per READY California guide, consistent counts and CSV", () => {
	const { recordsById, evaluated } = loadData();
	const rows = buildPermitDataRows(evaluated, recordsById, "CA");
	const readyCa = new Set(
		evaluated.filter((r) => r.readiness === "READY" && recordsById.get(r.record_id)?.state === "CA").map((r) => r.record_id),
	);
	assert.equal(rows.length, readyCa.size);
	assert.ok(rows.length >= 250, `expected the full California set, got ${rows.length}`);
	assert.equal(new Set(rows.map((r) => r.recordId)).size, rows.length, "no duplicate cities");
	for (const row of rows) {
		assert.ok(readyCa.has(row.recordId));
		assert.match(row.guideUrl, /^\/california\/[a-z0-9-]+\/solar-permit-guide\/$/);
		const program = recordsById.get(row.recordId).eligibility_constraints?.value?.program_or_pathway ?? null;
		assert.equal(Boolean(row.automatedKind), Boolean(program && AUTOMATED_PATH_PATTERN.test(program)), row.recordId);
		if (row.permitUrl) assert.match(row.permitUrl, /^https?:\/\//);
		for (const fee of row.fees) assert.ok(Number.isFinite(fee.amountUsd) && fee.amountUsd >= 0);
	}
	const summary = summarizePermitData(rows);
	assert.equal(summary.total, rows.length);
	assert.equal(summary.automated, rows.filter((r) => r.automatedKind).length);
	assert.equal(summary.byKind["SolarAPP+"] + summary.byKind.Symbium + summary.byKind["Other automated"], summary.automated);
	assert.equal(summary.withPublishedFee, rows.filter((r) => r.fees.length).length);
	assert.equal(summary.utilities.reduce((s, u) => s + u.count, 0), rows.length);
	assert.ok(summary.verifiedFrom <= summary.verifiedTo);

	const csv = permitDataCsv(rows);
	const lines = csv.split("\r\n");
	assert.equal(lines[0], CSV_COLUMNS.join(","));
	assert.equal(lines.at(-1), "", "ends with CRLF");
	assert.ok(lines.length - 2 >= rows.length, "at least one line per row");
	assert.ok(csv.includes("https://mygridpermit.com/california/"), "absolute guide URLs");
});

test("page, CSV route, links, header rule and analytics are wired", () => {
	assert.equal(PERMIT_DATA_PATH, "/california/solar-permit-data/");
	assert.equal(PERMIT_DATA_CSV_PATH, "/california/solar-permit-data.csv");
	const page = read("src/pages/california/solar-permit-data.astro");
	assert.match(page, /"@type": "Dataset"/);
	assert.match(page, /encodingFormat: "text\/csv"/);
	assert.match(page, /creativecommons\.org\/licenses\/by\/4\.0/);
	assert.match(page, /data-track-click="permit_data_downloaded"/);
	assert.match(page, /A blank cell means\s+the fact is not in our record/);
	assert.doesNotMatch(page, /onsubmit=|onclick=/, "no inline event handlers");
	assert.ok(ANALYTICS_EVENTS.includes("permit_data_downloaded"));
	const csvRoute = read("src/pages/california/solar-permit-data.csv.ts");
	assert.match(csvRoute, /text\/csv; charset=utf-8/);
	assert.match(csvRoute, /buildPermitDataRows\(evaluated, recordsById, "CA"\)/);
	const toml = read("netlify.toml");
	assert.match(toml, /for = "\/california\/solar-permit-data\.csv"\s*\n\s*\[headers\.values\]\s*\n\s*X-Robots-Tag = "noindex"/);
	for (const hub of ["src/pages/index.astro", "src/pages/california/index.astro", "src/pages/california/solar-permit-guides.astro", "src/pages/california/solar-permit-timeline.astro"]) {
		assert.match(read(hub), /href="\/california\/solar-permit-data\/"/, hub);
	}
	assert.match(read("src/lib/sitemap-policy.ts"), /routeDates\.set\("\/california\/solar-permit-data\/", lastmod\)/);
});

test("utility names are grouped for display without changing the record", async () => {
	const { canonicalUtilityName } = await import("../src/lib/permit-data-study.ts");
	assert.equal(canonicalUtilityName("Southern California Edison (SCE)"), "SCE");
	assert.equal(canonicalUtilityName("Southern California Edison"), "SCE");
	assert.equal(canonicalUtilityName("Pacific Gas and Electric Company (PG&E)"), "PG&E");
	assert.equal(canonicalUtilityName("Pacific Gas & Electric"), "PG&E");
	assert.equal(canonicalUtilityName("San Diego Gas & Electric (SDG&E)"), "SDG&E");
	assert.equal(canonicalUtilityName("Lompoc Utilities (Electric Division, City of Lompoc)"), "Lompoc Utilities");
	assert.equal(canonicalUtilityName("Azusa Light & Water"), "Azusa Light & Water");
	assert.equal(canonicalUtilityName(null), null);
});
