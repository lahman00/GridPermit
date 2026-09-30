import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasVerifiedUnambiguousUtility } from "../src/lib/utility-split-guard.ts";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function loadLocality(fileName) {
	const filePath = path.join(REPO_ROOT, "data", "localities", fileName);
	return JSON.parse(readFileSync(filePath, "utf8"));
}

test("a normal single-utility record passes the guard", () => {
	// Escondido, Hemet, Pomona: the first-lead cohort's own cities. Plain
	// single-utility records with no split-territory language in the notes.
	for (const fileName of [
		"ca-san-diego-escondido-sdge.json",
		"ca-riverside-hemet-sce.json",
		"ca-los-angeles-pomona-sce.json",
	]) {
		const record = loadLocality(fileName);
		assert.equal(hasVerifiedUnambiguousUtility(record), true, fileName);
	}
});

test("a plain object with a non-null utility value and no ambiguity markers passes", () => {
	assert.equal(
		hasVerifiedUnambiguousUtility({
			record_id: "ca-example-anytown-pge",
			utility: { value: "Pacific Gas and Electric Company (PG&E)", notes: "Confirmed via the utility's own site." },
		}),
		true,
	);
});

test("a null utility.value fails closed", () => {
	assert.equal(
		hasVerifiedUnambiguousUtility({
			record_id: "ca-example-anytown-pge",
			utility: { value: null, notes: "Not yet determined." },
		}),
		false,
	);
});

test("an empty-string or whitespace utility.value fails closed", () => {
	assert.equal(hasVerifiedUnambiguousUtility({ record_id: "ca-x-y-z", utility: { value: "" } }), false);
	assert.equal(hasVerifiedUnambiguousUtility({ record_id: "ca-x-y-z", utility: { value: "   " } }), false);
});

test("a record_id using the -multi naming convention fails closed even with a non-null value", () => {
	assert.equal(
		hasVerifiedUnambiguousUtility({
			record_id: "ca-riverside-corona-multi",
			utility: { value: "Southern California Edison (SCE)", notes: "Some notes with no split language." },
		}),
		false,
	);
});

test("the real Corona record (-multi record_id) fails closed even with a sourced majority-provider utility value", () => {
	// Corona's utility.value was later filled in with a well-sourced majority
	// provider (City of Corona's own GIS map: SCE serves ~96.6%, city DWP
	// ~3.4% in unmapped pockets) - but the record_id still uses the -multi
	// suffix, since no public source resolves a specific address-level
	// boundary, and the guard must keep failing closed on that alone.
	const record = loadLocality("ca-riverside-corona-multi.json");
	assert.match(record.record_id, /-multi$/, "sanity check: Corona's record_id should still use the -multi suffix");
	assert.equal(typeof record.utility.value, "string", "sanity check: Corona's utility.value is now a sourced string, not null");
	assert.equal(hasVerifiedUnambiguousUtility(record), false);
});

test("records whose notes explicitly describe a genuine utility-territory split fail closed even though utility.value is set", () => {
	// Mission Viejo, Laguna Hills, and Laguna Niguel all have a non-null
	// utility.value (they're scoped to "the SCE-served portion") but their
	// own notes say so explicitly — this is the real-world case a pure
	// null-check or -multi-filename check alone would miss.
	for (const fileName of [
		"ca-orange-mission-viejo-sce.json",
		"ca-orange-laguna-hills-sce.json",
		"ca-orange-laguna-niguel-sce.json",
	]) {
		const record = loadLocality(fileName);
		assert.ok(typeof record.utility.value === "string" && record.utility.value.length > 0, `${fileName} sanity check`);
		assert.equal(hasVerifiedUnambiguousUtility(record), false, fileName);
	}
});

test("Moreno Valley has no split-territory markers in the current data and passes the guard", () => {
	// Moreno Valley is excluded from the first-lead cohort for separate,
	// unrelated qualification reasons (out of scope here) — but its own
	// locality record has a clean, non-split SCE utility field with no
	// ambiguity language, so the guard correctly does not block it.
	const record = loadLocality("ca-riverside-moreno-valley-sce.json");
	assert.equal(hasVerifiedUnambiguousUtility(record), true);
});

test("fails closed on malformed or unrecognized shapes rather than assuming unambiguous", () => {
	assert.equal(hasVerifiedUnambiguousUtility(null), false);
	assert.equal(hasVerifiedUnambiguousUtility(undefined), false);
	assert.equal(hasVerifiedUnambiguousUtility("ca-example-anytown-pge"), false);
	assert.equal(hasVerifiedUnambiguousUtility(42), false);
	assert.equal(hasVerifiedUnambiguousUtility({}), false);
	assert.equal(hasVerifiedUnambiguousUtility({ record_id: "ca-example-anytown-pge" }), false, "missing utility field");
	assert.equal(hasVerifiedUnambiguousUtility({ utility: { value: "PG&E" } }), false, "missing record_id");
	assert.equal(hasVerifiedUnambiguousUtility({ record_id: "", utility: { value: "PG&E" } }), false, "empty record_id");
	assert.equal(
		hasVerifiedUnambiguousUtility({ record_id: "ca-example-anytown-pge", utility: "PG&E" }),
		false,
		"utility as a bare string instead of an envelope object",
	);
	assert.equal(
		hasVerifiedUnambiguousUtility({ record_id: "ca-example-anytown-pge", utility: { value: 12345 } }),
		false,
		"non-string utility value",
	);
});
