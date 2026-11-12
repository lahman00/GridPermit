// CEC Residential Solar Permit Program Status Dashboard data: stored as
// downloaded (only three columns kept), matched to every published
// California guide by exact name, and shown on the data page as a separate,
// attributed column. The CEC data never changes a guide or a record.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildCecCityIndex, cecForCity, cecLabel, normalizeJurisdictionName } from "../src/lib/cec-status.ts";
import { CSV_COLUMNS, buildPermitDataRows, pathsDiffer, summarizePermitData } from "../src/lib/permit-data-study.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");
const cec = JSON.parse(read("data/cec/residential-solar-permitting-status-2026-11-02.json"));

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

test("the stored CEC file keeps its provenance and only the needed columns", () => {
	assert.equal(cec.data_last_updated, "2026-11-02");
	assert.match(cec.dashboard_url, /^https:\/\/www\.energy\.ca\.gov\//);
	assert.match(cec.file_url, /Residential_Solar_Permitting_Program_Data_2026-11-02_ada\.xlsx$/);
	assert.match(cec.file_sha256, /^[0-9a-f]{64}$/);
	assert.match(cec.note, /self-reported/i);
	assert.ok(cec.jurisdictions.length > 500);
	for (const j of cec.jurisdictions) {
		assert.deepEqual(Object.keys(j).sort(), ["jurisdiction", "name", "sb379_deadline", "status", "types"]);
		assert.ok(cecLabel(j.status), `known status: ${j.status}`);
	}
});

test("names match exactly after accent and punctuation normalization", () => {
	assert.equal(normalizeJurisdictionName("San José"), "san jose");
	assert.equal(normalizeJurisdictionName("St. Helena"), "st helena");
	assert.equal(normalizeJurisdictionName("Carmel-by-the-Sea"), "carmel by the sea");
	const index = buildCecCityIndex(cec);
	assert.equal(cecForCity(index, "San José")?.jurisdiction, "San Jose (City)");
	assert.equal(cecForCity(index, "City of Industry")?.jurisdiction, "Industry (City)");
	assert.equal(cecForCity(index, "San Francisco")?.types.includes("City"), true);
	assert.equal(cecForCity(index, "Ventura")?.jurisdiction, "Ventura (City)", "the city, not the county");
	assert.equal(cecForCity(index, "Nowhere Springs"), null);
});

test("every published California guide gets a CEC status, and the summary adds up", () => {
	const { recordsById, evaluated } = loadData();
	const rows = buildPermitDataRows(evaluated, recordsById, "CA", buildCecCityIndex(cec));
	assert.equal(rows.filter((r) => !r.cecStatus).length, 0, rows.filter((r) => !r.cecStatus).map((r) => r.city).join(", "));
	const s = summarizePermitData(rows);
	assert.equal(s.cec.matched, rows.length);
	assert.equal(Object.values(s.cec.byStatus).reduce((a, b) => a + b, 0), s.cec.matched);
	assert.equal(s.cec.platformReported, s.cec.byStatus["SolarAPP+"] + s.cec.byStatus.Symbium + s.cec.byStatus["Custom platform"]);
	assert.equal(s.cec.pathsDiffer, rows.filter(pathsDiffer).length);
	assert.ok(CSV_COLUMNS.includes("cec_reported_status"));
	// Without an index the rows carry no CEC value (guides never depend on it).
	assert.ok(buildPermitDataRows(evaluated, recordsById, "CA").every((r) => r.cecStatus === null));
});

test("record and CEC disagreements are detected, not hidden", () => {
	const row = (automatedKind, cecStatus) => ({ automatedKind, automatedEvidence: automatedKind ? "pathway field" : null, cecStatus });
	assert.equal(pathsDiffer(row("SolarAPP+", "SolarAPP+")), false);
	assert.equal(pathsDiffer(row("SolarAPP+", "Custom platform")), true);
	assert.equal(pathsDiffer(row("Symbium", "Symbium")), false);
	assert.equal(pathsDiffer(row("SolarAPP+ and Symbium", "Symbium")), false);
	assert.equal(pathsDiffer(row("Express or over-the-counter", "Custom platform")), false);
	assert.equal(pathsDiffer(row("Express or over-the-counter", "No platform reported")), true);
	assert.equal(pathsDiffer(row(null, "SolarAPP+")), false, "a blank record is a gap, counted separately");
	assert.equal(pathsDiffer(row("SolarAPP+", null)), false);
});

test("the page shows the CEC column with attribution and does not change guides", () => {
	const page = read("src/pages/california/solar-permit-data.astro");
	assert.match(page, /<th scope="col">CEC status<\/th>/);
	assert.match(page, /The CEC does not certify compliance/);
	assert.match(page, /credit the CEC for it/);
	assert.match(page, /isBasedOn/);
	assert.doesNotMatch(read("src/layouts/LocalityGuideLayout.astro"), /cec-status|cecData/);
});
