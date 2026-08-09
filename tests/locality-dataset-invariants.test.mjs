// Repo-wide invariants over the full locality dataset — not scoped to any
// one batch's evaluation file, unlike tests/next-batch-targets.test.mjs and
// tests/netlify-redirects.test.mjs. Runs entirely offline against the
// checked-in JSON (no live URL checks), so it stays fast and deterministic
// while still catching the class of silent drift a manual audit found this
// session: orphaned source entries, and (checked defensively) duplicate
// record_ids or a record_id/filename mismatch.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const LOCALITIES_DIR = path.join(REPO_ROOT, "data", "localities");

const FIELD_NAMES = [
	"utility", "generation_supplier", "city", "county", "permit_authority", "permit_url",
	"interconnection_url", "battery_programs", "required_documents",
	"inspection_steps", "timeline_days", "eligibility_constraints", "permit_fees", "rebates",
	"official_contacts",
];

function loadAllRecords() {
	const files = readdirSync(LOCALITIES_DIR).filter((f) => f.endsWith(".json"));
	return files.map((f) => ({
		file: f,
		record: JSON.parse(readFileSync(path.join(LOCALITIES_DIR, f), "utf8")),
	}));
}

test("every locality record_id matches its filename", () => {
	for (const { file, record } of loadAllRecords()) {
		assert.equal(record.record_id, file.replace(".json", ""), `${file}: record_id does not match filename`);
	}
});

test("no two locality records share a record_id", () => {
	const records = loadAllRecords();
	const ids = records.map((r) => r.record.record_id);
	const seen = new Set();
	for (const id of ids) {
		assert.ok(!seen.has(id), `duplicate record_id: ${id}`);
		seen.add(id);
	}
});

test("every source_ids reference in every record resolves to a real entry in that record's own sources[]", () => {
	for (const { file, record } of loadAllRecords()) {
		const sourceIds = new Set((record.sources || []).map((s) => s.id));
		for (const fieldName of FIELD_NAMES) {
			const field = record[fieldName];
			if (!field || typeof field !== "object") continue;
			for (const sid of field.source_ids || []) {
				assert.ok(sourceIds.has(sid), `${file}: ${fieldName} references missing source ${sid}`);
			}
			if (fieldName === "required_documents" && Array.isArray(field.value)) {
				for (const doc of field.value) {
					for (const sid of doc.source_ids || []) {
						assert.ok(sourceIds.has(sid), `${file}: required_documents item '${doc.name}' references missing source ${sid}`);
					}
				}
			}
		}
	}
});

test("no locality record has an orphaned source entry (cited by nothing)", () => {
	for (const { file, record } of loadAllRecords()) {
		const usedIds = new Set();
		for (const fieldName of FIELD_NAMES) {
			const field = record[fieldName];
			if (!field || typeof field !== "object") continue;
			for (const sid of field.source_ids || []) usedIds.add(sid);
			if (fieldName === "required_documents" && Array.isArray(field.value)) {
				for (const doc of field.value) {
					for (const sid of doc.source_ids || []) usedIds.add(sid);
				}
			}
		}
		for (const source of record.sources || []) {
			assert.ok(usedIds.has(source.id), `${file}: source ${source.id} (${source.title}) is never referenced by any field`);
		}
	}
});

test("every non-null field has at least one source_id, and every null field has none (schema's own confidence rule, checked statically)", () => {
	for (const { file, record } of loadAllRecords()) {
		for (const fieldName of FIELD_NAMES) {
			const field = record[fieldName];
			if (!field || typeof field !== "object") continue;
			if (field.value === null) {
				assert.equal((field.source_ids || []).length, 0, `${file}: ${fieldName} is null but has source_ids`);
			} else {
				assert.ok((field.source_ids || []).length > 0, `${file}: ${fieldName} is non-null but has no source_ids`);
			}
		}
	}
});

test("every generated locality guide page corresponds to a locality record that exists on disk", () => {
	const californiaDir = path.join(REPO_ROOT, "src", "pages", "california");
	const cityDirs = readdirSync(californiaDir, { withFileTypes: true })
		.filter((e) => e.isDirectory())
		.map((e) => e.name)
		.filter((slug) => existsSync(path.join(californiaDir, slug, "solar-permit-guide.astro")));

	const allCitySlugs = new Set(
		// Mirrors scripts/generate-locality-pages.mjs's own slugify(): strip every
		// non-alphanumeric run (not just whitespace) so names like "St. Helena"
		// slug to "st-helena", matching the folder the generator actually writes.
		loadAllRecords().map(({ record }) =>
			record.city.value
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-+|-+$/g, ""),
		),
	);

	for (const slug of cityDirs) {
		assert.ok(allCitySlugs.has(slug), `generated page src/pages/california/${slug}/solar-permit-guide.astro has no matching locality record city slug`);
	}
});
