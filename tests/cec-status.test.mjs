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
import {
	CSV_COLUMNS,
	RECORD_VS_CEC,
	buildPermitDataRows,
	permitDataCsv,
	recordVsCec,
	summarizePermitData,
} from "../src/lib/permit-data-study.ts";

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
	for (const value of RECORD_VS_CEC) assert.equal(s.cec.comparison[value], rows.filter((r) => recordVsCec(r) === value).length);
	assert.equal(Object.values(s.cec.comparison).reduce((a, b) => a + b, 0), s.cec.matched, "every matched row is classified once");
	assert.ok(s.cec.comparison.cec_platform_not_in_record >= s.cec.recordBlankCecPlatform);
	assert.ok(CSV_COLUMNS.includes("cec_reported_status"));
	// The CSV marks each row with the same comparison the page counts.
	const csv = permitDataCsv(rows).replace(/^﻿/, "").trim().split("\r\n");
	const col = csv[0].split(",").indexOf("record_vs_cec");
	assert.ok(col > 0);
	assert.equal(csv.length - 1, rows.length);
	// Without an index the rows carry no CEC value (guides never depend on it).
	assert.ok(buildPermitDataRows(evaluated, recordsById, "CA").every((r) => r.cecStatus === null));
});

test("record and CEC are compared without overstating conflicts", () => {
	const cmp = (automatedKind, cecStatus) => recordVsCec({ automatedKind, cecStatus });
	const expected = {
		"SolarAPP+": { "SolarAPP+": "consistent", Symbium: "conflict", "Custom platform": "conflict", "No platform reported": "conflict", Exempt: "conflict" },
		Symbium: { "SolarAPP+": "conflict", Symbium: "consistent", "Custom platform": "conflict", "No platform reported": "conflict", Exempt: "conflict" },
		"SolarAPP+ and Symbium": { "SolarAPP+": "consistent", Symbium: "consistent", "Custom platform": "conflict", "No platform reported": "conflict", Exempt: "conflict" },
		// Automated, platform not named: a named CEC platform adds detail; a CEC custom platform fits.
		"Other automated": {
			"SolarAPP+": "cec_platform_not_in_record",
			Symbium: "cec_platform_not_in_record",
			"Custom platform": "consistent",
			"No platform reported": "conflict",
			Exempt: "conflict",
		},
		// An express or over-the-counter path is not a platform claim.
		"Express or over-the-counter": {
			"SolarAPP+": "cec_platform_not_in_record",
			Symbium: "cec_platform_not_in_record",
			"Custom platform": "cec_platform_not_in_record",
			"No platform reported": "no_platform_in_either",
			Exempt: "no_platform_in_either",
		},
		blank: {
			"SolarAPP+": "cec_platform_not_in_record",
			Symbium: "cec_platform_not_in_record",
			"Custom platform": "cec_platform_not_in_record",
			"No platform reported": "no_platform_in_either",
			Exempt: "no_platform_in_either",
		},
	};
	for (const [kind, byCec] of Object.entries(expected)) {
		for (const [cecStatus, value] of Object.entries(byCec)) {
			assert.equal(cmp(kind === "blank" ? null : kind, cecStatus), value, `${kind} vs ${cecStatus}`);
		}
	}
	assert.equal(cmp("SolarAPP+", null), null, "no CEC match, no comparison");
});

test("the page shows the CEC column with attribution and does not change guides", () => {
	const page = read("src/pages/california/solar-permit-data.astro");
	assert.match(page, /<th scope="col">CEC status<\/th>/);
	assert.match(page, /The CEC does not certify compliance/);
	assert.match(page, /credit the CEC for it/);
	assert.match(page, /isBasedOn/);
	assert.match(page, /s\.cec\.comparison\.conflict/);
	assert.match(page, /record_vs_cec/);
	assert.match(page, /listed without a platform/, "the file lists a status; it does not say the city reported none");
	assert.doesNotMatch(page, /report none|name different things/);
	assert.doesNotMatch(read("src/layouts/LocalityGuideLayout.astro"), /cec-status|cecData/);
});
