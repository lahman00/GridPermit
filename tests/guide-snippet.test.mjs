// Fact-bearing search descriptions for city guides: built only from the
// record's own verified fields, never longer than 160 characters, and never
// applied to a guide inside a measurement or observation window.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { MAX_DESCRIPTION_LENGTH, buildFactDescription, checkedMonth, isSnippetLocked } from "../src/lib/guide-snippet.ts";
import { publishedFees, automatedKindFor } from "../src/lib/permit-data-study.ts";
import { buildLocalityIndexEntries, citySlug, guideUrlForCitySlug } from "../src/lib/locality-guide.ts";
import { observationLockedRecordIds } from "../src/lib/related-balance.ts";
import { COMMERCIAL_SEO_PROFILES } from "../src/lib/commercial-seo-profiles.ts";
import { QUICK_ANSWER_PILOTS } from "../src/lib/quick-answer-pilots.ts";
import { PERMIT_PATHWAY_RECORD_IDS } from "../src/lib/permit-pathway-answer.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");
const registry = JSON.parse(read("data/content-links/registry.json"));
const layout = read("src/layouts/LocalityGuideLayout.astro");
const SPRINT_PATHS = new Set(
	[...layout.matchAll(/"(\/california\/[a-z0-9-]+\/solar-permit-guide\/)"/g)]
		.map((m) => m[1])
		.filter((p) => layout.indexOf(p) < layout.indexOf("isFirstLeadSprintPage")),
);

function loadData() {
	const recordsById = new Map();
	for (const name of readdirSync(path.join(root, "data/localities")).filter((n) => n.endsWith(".json"))) {
		const record = JSON.parse(read(`data/localities/${name}`));
		recordsById.set(record.record_id, record);
	}
	const evaluated = readdirSync(path.join(root, "output"))
		.filter((n) => n.endsWith("-evaluation.json"))
		.flatMap((n) => JSON.parse(read(`output/${n}`)).records ?? []);
	return { recordsById, evaluated, entries: buildLocalityIndexEntries(evaluated, recordsById) };
}

test("checked month is derived from the record date only", () => {
	assert.equal(checkedMonth("2026-08-09"), "Aug 2026");
	assert.equal(checkedMonth("2026-12-01"), "Dec 2026");
	assert.equal(checkedMonth("2026-13-01"), null);
	assert.equal(checkedMonth("Aug 2026"), null);
	assert.equal(checkedMonth(undefined), null);
});

test("every READY guide gets a bounded, record-backed description or keeps the old one", () => {
	const { recordsById, entries } = loadData();
	let built = 0;
	for (const entry of entries) {
		const record = recordsById.get(entry.recordId);
		const text = buildFactDescription(record);
		if (!text) continue;
		built += 1;
		assert.ok(text.length <= MAX_DESCRIPTION_LENGTH, `${entry.recordId}: ${text.length}`);
		assert.ok(text.startsWith(`${record.city.value}, ${record.state} solar permit:`), entry.recordId);
		assert.ok(text.endsWith(`Checked ${checkedMonth(record.last_verified)}.`), entry.recordId);
		const kind = automatedKindFor(record.eligibility_constraints?.value?.program_or_pathway);
		assert.equal(text.includes("SolarAPP+"), kind === "SolarAPP+", `${entry.recordId} SolarAPP+ claim`);
		assert.equal(text.includes("Symbium"), kind === "Symbium", `${entry.recordId} Symbium claim`);
		assert.equal(text.includes("published fees"), publishedFees(record).length > 0, `${entry.recordId} fee claim`);
		assert.doesNotMatch(text, /confidence-scored|guarantee|instant approval|fast(est)?\b/i);
	}
	assert.ok(built >= entries.length * 0.9, `expected most guides to get a description, got ${built}/${entries.length}`);
});

test("no description without a sourced permit office", () => {
	const { recordsById, entries } = loadData();
	const record = structuredClone(recordsById.get(entries[0].recordId));
	record.permit_authority = { value: record.permit_authority.value, source_ids: [] };
	assert.equal(buildFactDescription(record), null);
});

test("every guide inside a measurement or observation window is locked", () => {
	const { recordsById, entries } = loadData();
	const locked = observationLockedRecordIds(entries, registry.rollout.locality_pages);
	const pathFor = (id) => {
		const r = recordsById.get(id);
		return guideUrlForCitySlug(r.state, citySlug(r.city.value));
	};
	const check = (id) =>
		isSnippetLocked({ recordId: id, pagePath: pathFor(id), lockedRecordIds: locked, balancedRelated: registry.balanced_related, heldPaths: SPRINT_PATHS });
	for (const id of COMMERCIAL_SEO_PROFILES.keys()) assert.ok(check(id), `profile ${id}`);
	for (const pilot of QUICK_ANSWER_PILOTS.values()) assert.ok(check(pilot.recordId), `pilot ${pilot.recordId}`);
	for (const id of PERMIT_PATHWAY_RECORD_IDS) assert.ok(check(id), `pathway ${id}`);
	const byPath = new Map(entries.map((e) => [e.guideUrl, e.recordId]));
	for (const page of [
		...registry.rollout.locality_pages,
		...registry.balanced_related.pages,
		...(registry.balanced_related.control_pages ?? []),
		...SPRINT_PATHS,
	]) {
		const id = byPath.get(page);
		assert.ok(id, `held page is a READY guide: ${page}`);
		assert.ok(check(id), `held page ${page}`);
	}
	assert.equal(SPRINT_PATHS.size, 3, "the three lead-sprint guides are read from the layout");
	const unlocked = entries.filter((e) => !check(e.recordId));
	assert.ok(unlocked.length > 200, `most guides are outside any window (${unlocked.length})`);
});

test("the layout keeps profile copy first and falls back to the old description", () => {
	assert.match(
		layout,
		/const description =\s*commercialSeoProfile\?\.description \?\? \(snippetLocked \? null : buildFactDescription\(record\)\) \?\? baselineMeta\.description;/,
	);
	assert.match(layout, /lockedRecordIds: observationLocked,/);
	assert.match(layout, /balancedRelated: contentLinkRegistry\.balanced_related,/);
	assert.match(layout, /heldPaths: FIRST_LEAD_SPRINT_PATHS,/);
});
