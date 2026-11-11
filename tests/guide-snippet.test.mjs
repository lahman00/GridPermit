// Fact-bearing search descriptions for city guides: built only from the
// record's own verified fields, never longer than 160 characters, never
// applied to a guide inside a measurement or observation window, and held
// back on a pre-registered one-in-four holdout.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
	MAX_DESCRIPTION_LENGTH,
	MIN_PATH_CONFIDENCE,
	buildFactDescription,
	checkedMonth,
	isSnippetHoldout,
	isSnippetLocked,
	snippetFacts,
	stableHash,
} from "../src/lib/guide-snippet.ts";
import { automatedKindFor, canonicalUtilityName, cityOrUtilityFees } from "../src/lib/record-facts.ts";
import { buildLocalityIndexEntries, citySlug, guideUrlForCitySlug } from "../src/lib/locality-guide.ts";
import { observationLockedRecordIds } from "../src/lib/related-balance.ts";
import { COMMERCIAL_SEO_PROFILES } from "../src/lib/commercial-seo-profiles.ts";
import { QUICK_ANSWER_PILOTS } from "../src/lib/quick-answer-pilots.ts";
import { PERMIT_PATHWAY_RECORD_IDS } from "../src/lib/permit-pathway-answer.ts";
import { hasVerifiedUnambiguousUtility } from "../src/lib/utility-split-guard.ts";

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
	return { recordsById, entries: buildLocalityIndexEntries(evaluated, recordsById) };
}

const sourcedList = (field) => Array.isArray(field?.value) && field.value.length > 0 && Boolean(field.source_ids?.length);

test("checked month is derived from the record date only", () => {
	assert.equal(checkedMonth("2026-08-09"), "Aug 2026");
	assert.equal(checkedMonth("2026-12-01"), "Dec 2026");
	assert.equal(checkedMonth("2026-13-01"), null);
	assert.equal(checkedMonth("Aug 2026"), null);
	assert.equal(checkedMonth(undefined), null);
});

test("every claim in a description is backed by the record", () => {
	const { recordsById, entries } = loadData();
	let built = 0;
	for (const entry of entries) {
		const record = recordsById.get(entry.recordId);
		const text = buildFactDescription(record);
		if (!text) continue;
		built += 1;
		const id = entry.recordId;
		assert.ok(text.length <= MAX_DESCRIPTION_LENGTH, `${id}: ${text.length}`);
		assert.ok(text.startsWith(`${record.city.value}, ${record.state} solar permit guide:`), id);
		assert.ok(text.endsWith(`Checked ${checkedMonth(record.last_verified)}.`), id);
		const eligibility = record.eligibility_constraints;
		const kind = automatedKindFor(eligibility?.value?.program_or_pathway);
		const confident = (eligibility?.confidence ?? 0) >= MIN_PATH_CONFIDENCE;
		assert.ok(!text.includes("SolarAPP+") || (kind === "SolarAPP+" && confident), `${id} SolarAPP+ claim`);
		assert.ok(!text.includes("Symbium") || (kind === "Symbium" && confident), `${id} Symbium claim`);
		assert.ok(!text.includes("automated permit path") || (kind === "Other automated" && confident), `${id} automated claim`);
		assert.ok(!text.includes("published fees") || cityOrUtilityFees(record).length > 0, `${id} fee claim`);
		assert.ok(!text.includes("document checklist") || sourcedList(record.required_documents), `${id} documents claim`);
		assert.ok(!text.includes("inspection steps") || sourcedList(record.inspection_steps), `${id} inspections claim`);
		if (!hasVerifiedUnambiguousUtility(record)) assert.ok(text.includes("utility interconnection"), `${id} split utility named`);
		assert.doesNotMatch(text, /confidence-scored|guarantee|instant approval|fastest|portal link|company interconnection|, Inc\.|LLC/i, id);
	}
	assert.ok(built >= entries.length * 0.9, `expected most guides to get a description, got ${built}/${entries.length}`);
});

test("utility names in descriptions are readable short names", () => {
	assert.equal(canonicalUtilityName("Southern California Edison (SCE)"), "SCE");
	assert.equal(canonicalUtilityName("Southern California Edison"), "SCE");
	assert.equal(canonicalUtilityName("Pacific Gas and Electric Company (PG&E)"), "PG&E");
	assert.equal(canonicalUtilityName("San Diego Gas & Electric (SDG&E)"), "SDG&E");
	assert.equal(canonicalUtilityName("PECO (an Exelon company)"), "PECO");
	assert.equal(canonicalUtilityName("Delmarva Power (an Exelon company)"), "Delmarva Power");
	assert.equal(canonicalUtilityName("Appalachian Power (an AEP company)"), "Appalachian Power");
	assert.equal(canonicalUtilityName("Lompoc Utilities (Electric Division, City of Lompoc)"), "Lompoc Utilities");
	assert.equal(canonicalUtilityName("Chugach Electric Association, Inc."), "Chugach Electric Association");
	assert.equal(canonicalUtilityName("Entergy Arkansas, LLC"), "Entergy Arkansas");
	assert.equal(canonicalUtilityName("Nevada Power Company d/b/a NV Energy"), "NV Energy");
	assert.equal(canonicalUtilityName("Sacramento Municipal Utility District (SMUD)"), "SMUD");
	assert.equal(canonicalUtilityName("Azusa Light & Water"), "Azusa Light & Water");
	assert.equal(canonicalUtilityName(null), null);
	const { recordsById } = loadData();
	for (const id of ["pa-philadelphia-philadelphia-peco", "de-new-castle-new-castle-county-delmarva", "wv-kanawha-charleston-appalachianpower"]) {
		const record = recordsById.get(id);
		if (!record) continue;
		const text = buildFactDescription(record) ?? "";
		assert.doesNotMatch(text, /company interconnection/, id);
	}
});

test("platform fees alone never produce a 'published fees' claim", () => {
	const base = { name: "SolarAPP+ processing fee", amount_usd: 25, unit: "flat" };
	const record = (fees) => ({ permit_fees: { value: fees, confidence: 0.9, source_ids: ["S1"] } });
	assert.equal(cityOrUtilityFees(record([base])).length, 0);
	assert.equal(cityOrUtilityFees(record([{ ...base, name: "SolarAPP+ design revision (4th and later)" }])).length, 0);
	assert.equal(cityOrUtilityFees(record([{ name: "SolarAPP+ fee", amount_usd: 35, notes: "Paid directly to the SolarAPP+ platform." }])).length, 0);
	assert.equal(cityOrUtilityFees(record([{ name: "Residential Photovoltaic System via SolarAPP+", amount_usd: 385 }])).length, 1);
	assert.equal(cityOrUtilityFees(record([{ name: "SolarApp+ OTC Permit Fee", amount_usd: 120 }])).length, 1);
	assert.equal(cityOrUtilityFees(record([{ name: "Residential interconnection fee", amount_usd: 330 }])).length, 1);
	assert.equal(cityOrUtilityFees({ permit_fees: { value: [base], confidence: 0.5, source_ids: ["S1"] } }).length, 0);
});

test("missing or unsourced facts are left out, and statewide records keep the old sentence", () => {
	const { recordsById, entries } = loadData();
	const record = structuredClone(recordsById.get(entries[0].recordId));
	record.permit_authority = { value: record.permit_authority.value, source_ids: [] };
	assert.equal(buildFactDescription(record), null);
	const bare = structuredClone(recordsById.get(entries[0].recordId));
	bare.required_documents = { value: [], source_ids: [] };
	bare.inspection_steps = { value: null };
	const facts = snippetFacts(bare);
	assert.equal(facts.documents, false);
	assert.equal(facts.inspections, false);
	assert.doesNotMatch(buildFactDescription(bare) ?? "", /document checklist|inspection steps/);
	const statewide = [...recordsById.values()].find((r) => /\(/.test(r.city?.value ?? ""));
	if (statewide) assert.equal(buildFactDescription(statewide), null);
});

test("the holdout is a stable one-in-four split", () => {
	assert.equal(stableHash("abc"), stableHash("abc"));
	assert.notEqual(stableHash("ca-a"), stableHash("ca-b"));
	const { entries } = loadData();
	const held = entries.filter((e) => isSnippetHoldout(e.recordId)).length;
	const share = held / entries.length;
	assert.ok(share > 0.17 && share < 0.33, `holdout share ${share.toFixed(3)}`);
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
});

test("the layout keeps profile copy first, honours locks and the holdout, and falls back", () => {
	assert.match(layout, /const snippetHoldout = isSnippetHoldout\(record\.record_id\);/);
	assert.match(
		layout,
		/commercialSeoProfile\?\.description \?\?\s*\(snippetLocked \|\| snippetHoldout \? null : buildFactDescription\(record\)\) \?\?\s*baselineMeta\.description;/,
	);
	assert.match(layout, /lockedRecordIds: observationLocked,/);
	assert.match(layout, /balancedRelated: contentLinkRegistry\.balanced_related,/);
	assert.match(layout, /heldPaths: FIRST_LEAD_SPRINT_PATHS,/);
});
