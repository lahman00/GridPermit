// Validates the JSON-LD every locality page actually embeds, by running the
// same builder functions the pages call (src/lib/locality-guide.ts) against
// every real record in data/localities/ — not just hand-picked fixtures.
// Catches the class of bug the mission calls out directly: a JSON-LD blob
// containing the literal string "null" or "undefined" where a real value
// belongs, which is invisible in a visual read-through but breaks a rich
// result the moment a search engine parses it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	buildFaqs,
	buildFaqSchema,
	buildBreadcrumbSchema,
	SITE_ORIGIN,
} from "../src/lib/locality-guide.ts";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const LOCALITIES_DIR = path.join(REPO_ROOT, "data", "localities");

function loadAllRecords() {
	return readdirSync(LOCALITIES_DIR)
		.filter((f) => f.endsWith(".json"))
		.map((f) => JSON.parse(readFileSync(path.join(LOCALITIES_DIR, f), "utf8")));
}

// Every string value nested anywhere in a JSON-LD object, checked for the
// literal artifacts that leak from an un-narrowed null/undefined getting
// coerced to a string during template interpolation.
function assertNoNullLeakage(obj, label) {
	const json = JSON.stringify(obj);
	assert.ok(!/\bnull\b/.test(json) || !json.includes('"null'), `${label}: JSON-LD contains a literal "null" string, not a real value`);
	assert.ok(!json.includes("undefined"), `${label}: JSON-LD contains a literal "undefined" string`);
}

test("buildBreadcrumbSchema produces valid, JSON-serializable BreadcrumbList schema with no null/undefined leakage", () => {
	const items = [
		{ name: "Home", url: `${SITE_ORIGIN}/` },
		{ name: "California", url: `${SITE_ORIGIN}/california/` },
		{ name: "Testville", url: `${SITE_ORIGIN}/california/testville/` },
	];
	const schema = buildBreadcrumbSchema(items);
	assert.equal(schema["@type"], "BreadcrumbList");
	assert.equal(schema.itemListElement.length, 3);
	for (const [i, el] of schema.itemListElement.entries()) {
		assert.equal(el["@type"], "ListItem");
		assert.equal(el.position, i + 1);
	}
	assertNoNullLeakage(schema, "breadcrumb fixture");
});

test("buildFaqs + buildFaqSchema produce valid, null-free JSON-LD for every real locality record", () => {
	const records = loadAllRecords();
	assert.ok(records.length > 0, "expected at least one locality record to test against");

	for (const record of records) {
		const faqs = buildFaqs(record);
		const schema = buildFaqSchema(faqs);

		if (faqs.length === 0) {
			assert.equal(schema, null, `${record.record_id}: buildFaqSchema should return null for an empty FAQ list`);
			continue;
		}

		assert.equal(schema["@type"], "FAQPage");
		assert.ok(Array.isArray(schema.mainEntity));
		assert.equal(schema.mainEntity.length, faqs.length);

		for (const entry of schema.mainEntity) {
			assert.equal(entry["@type"], "Question");
			assert.ok(typeof entry.name === "string" && entry.name.length > 0, `${record.record_id}: FAQ question has no text`);
			assert.equal(entry.acceptedAnswer["@type"], "Answer");
			assert.ok(typeof entry.acceptedAnswer.text === "string" && entry.acceptedAnswer.text.length > 0, `${record.record_id}: FAQ answer has no text`);
		}

		assertNoNullLeakage(schema, record.record_id);
	}
});

test("every real locality record's FAQ answers stay free of the literal 'null–null days' rendering bug", () => {
	for (const record of loadAllRecords()) {
		const faqs = buildFaqs(record);
		for (const faq of faqs) {
			assert.ok(!faq.a.includes("null–null"), `${record.record_id}: FAQ answer contains the literal 'null–null days' bug: ${faq.a}`);
			assert.ok(!/^null\s/.test(faq.a), `${record.record_id}: FAQ answer starts with a literal 'null': ${faq.a}`);
		}
	}
});
