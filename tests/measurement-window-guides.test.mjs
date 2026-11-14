// Guards for guides published while the search-snippet measurement is running
// (docs/growth/TRAFFIC_GROWTH_20261111.md, window closes 2026-12-16):
// existing guides must not change because a new guide was published, and the
// optional organizer note must stay scoped and accurate.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
	MEASUREMENT_WINDOW_CLOSES,
	NEW_GUIDES_DURING_MEASUREMENT,
	isNewGuideDuringMeasurement,
	relatedPoolFor,
} from "../src/lib/measurement-window-guides.ts";
import { buildLocalityIndexEntries, buildRelatedLocalities, citySlug } from "../src/lib/locality-guide.ts";
import { isSnippetLocked } from "../src/lib/guide-snippet.ts";
import { observationLockedRecordIds } from "../src/lib/related-balance.ts";
import { SOLAR_ORGANIZER } from "../src/lib/solar-organizer.ts";
import { stateMeta } from "../src/lib/state-meta.ts";

const ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

function loadEntries() {
	const recordsById = new Map();
	for (const name of readdirSync(path.join(ROOT, "data/localities")).filter((n) => n.endsWith(".json"))) {
		const record = JSON.parse(read(`data/localities/${name}`));
		recordsById.set(record.record_id, record);
	}
	const evaluated = readdirSync(path.join(ROOT, "output"))
		.filter((n) => n.endsWith("-evaluation.json"))
		.flatMap((n) => JSON.parse(read(`output/${n}`)).records ?? []);
	return { recordsById, evaluated, entries: buildLocalityIndexEntries(evaluated, recordsById) };
}

test("an existing guide never sees a new guide; a new guide sees everything", () => {
	const entries = [{ recordId: "co-denver-denver-xcel" }, ...[...NEW_GUIDES_DURING_MEASUREMENT].map((recordId) => ({ recordId }))];
	assert.deepEqual(relatedPoolFor("co-denver-denver-xcel", entries), [{ recordId: "co-denver-denver-xcel" }]);
	for (const id of NEW_GUIDES_DURING_MEASUREMENT) {
		assert.equal(isNewGuideDuringMeasurement(id), true);
		assert.equal(relatedPoolFor(id, entries).length, entries.length);
	}
	assert.equal(isNewGuideDuringMeasurement("co-denver-denver-xcel"), false);
	assert.equal(isNewGuideDuringMeasurement(null), false);
	assert.match(MEASUREMENT_WINDOW_CLOSES, /^\d{4}-\d{2}-\d{2}$/);
});

test("every existing guide keeps the related list it had before the new guides", () => {
	const { entries } = loadEntries();
	const before = entries.filter((e) => !NEW_GUIDES_DURING_MEASUREMENT.has(e.recordId));
	assert.ok(before.length >= 351, "all previously published guides are present");
	let sameStateAsNewGuide = 0;
	for (const current of before) {
		const expected = buildRelatedLocalities(current, before, 6).map((r) => r.recordId);
		const actual = buildRelatedLocalities(current, relatedPoolFor(current.recordId, entries), 6).map((r) => r.recordId);
		assert.deepEqual(actual, expected, current.recordId);
		assert.ok(actual.every((id) => !NEW_GUIDES_DURING_MEASUREMENT.has(id)), current.recordId);
		if (entries.some((e) => NEW_GUIDES_DURING_MEASUREMENT.has(e.recordId) && e.state === current.state)) sameStateAsNewGuide += 1;
	}
	// Without the pool the new guides would be offered to their same-state siblings.
	assert.ok(sameStateAsNewGuide >= 1, "at least one existing guide shares a state with a new guide");
});

test("each new guide is a real, READY, published record and is reachable", () => {
	const { recordsById, evaluated, entries } = loadEntries();
	const toml = read("netlify.toml");
	const registry = JSON.parse(read("data/content-links/registry.json"));
	const locked = observationLockedRecordIds(entries, registry.rollout.locality_pages);
	for (const id of NEW_GUIDES_DURING_MEASUREMENT) {
		const record = recordsById.get(id);
		assert.ok(record, `${id}: record exists`);
		assert.equal(evaluated.find((e) => e.record_id === id)?.readiness, "READY", `${id}: READY`);
		const slug = citySlug(record.city.value);
		const state = stateMeta(record.state).slug;
		const page = `src/pages/${state}/${slug}/solar-permit-guide.astro`;
		const pagePath = `/${state}/${slug}/solar-permit-guide/`;
		assert.ok(existsSync(path.join(ROOT, page)), `${id}: ${page}`);
		assert.match(read(page), new RegExp(`data/localities/${id}\\.json`));
		assert.ok(toml.includes(`from = "/${state}/${slug}/"`), `${id}: city redirect`);
		// A new guide belongs to no locked measurement group: it is its own group.
		assert.equal(locked.has(id), false, `${id}: not in an observation window`);
		assert.equal(
			isSnippetLocked({ recordId: id, pagePath, lockedRecordIds: locked, balancedRelated: registry.balanced_related, heldPaths: new Set() }),
			false,
		);
	}
});

test("the layout wires the pool and shows the organizer note only on new guides", () => {
	const layout = read("src/layouts/LocalityGuideLayout.astro");
	assert.match(layout, /relatedPoolFor\(record\.record_id, allReadyEntries\)/);
	assert.match(layout, /const isNewGuide = isNewGuideDuringMeasurement\(record\.record_id\);/);
	assert.equal(layout.match(/<OrganizerNote\b/g)?.length, 1);
	assert.match(layout, /\{isNewGuide && <OrganizerNote \/>\}/);
});

test("the organizer note is optional, scoped and tied to the one product constant", () => {
	const note = read("src/components/OrganizerNote.astro");
	assert.match(note, /import \{ SOLAR_ORGANIZER, organizerCheckout \} from "\.\.\/lib\/solar-organizer";/);
	assert.match(note, /\{organizerCheckout && \(/, "rendered only while the verified checkout exists");
	assert.match(note, /href=\{SOLAR_ORGANIZER\.path\}/);
	assert.match(note, /SOLAR_ORGANIZER\.priceCents \/ 100/);
	assert.match(note, /data-track-click="internal_resource_clicked"/);
	assert.match(note, /the optional \{SOLAR_ORGANIZER\.title\}/);
	assert.match(note, /It is a blank planning tool, not a permit research or filing service\./);
	// The same sentence the Permit Path page already uses.
	assert.ok(read("src/pages/permit-path.astro").includes("It is a blank planning tool, not a permit research or filing service."));
	assert.doesNotMatch(note, /guarantee|approved faster|get your permit|engineer|we file|whop\.com/i);
	assert.equal(SOLAR_ORGANIZER.priceCents, 900);
	assert.equal(SOLAR_ORGANIZER.path, "/solar-project-organizer/");
});

test("new guides say the utility depends on the address; existing guides keep their utility answer", async () => {
	const { buildFaqs } = await import("../src/lib/locality-guide.ts");
	const { hasVerifiedUnambiguousUtility } = await import("../src/lib/utility-split-guard.ts");
	for (const id of NEW_GUIDES_DURING_MEASUREMENT) {
		const record = JSON.parse(read(`data/localities/${id}.json`));
		// Both records tell the reader to check their own address in the utility notes.
		assert.match(record.utility.notes, /your (own address|electric bill)/);
		const utilityFaq = buildFaqs(record, { addressLevelUtility: true })[0];
		assert.match(utilityFaq.a, /^It depends on the address\./);
		assert.doesNotMatch(utilityFaq.a, /is the interconnection and distribution utility for/);
		// Pathway text must never be read as an automated permit path by the snippet or Permit Path logic.
		assert.doesNotMatch(record.eligibility_constraints.value.program_or_pathway, /solarapp|symbium|automated|instant/i);
		// Null fee amounts render as "amount not verified"; taxes belong in the notes.
		assert.ok(record.permit_fees.value.every((fee) => typeof fee.amount_usd === "number"));
	}
	// Aurora's own sources say other utilities serve parts of the city, so it stays an address check.
	assert.equal(hasVerifiedUnambiguousUtility(JSON.parse(read("data/localities/co-arapahoe-aurora-xcel.json"))), false);
	assert.match(read("src/layouts/LocalityGuideLayout.astro"), /buildFaqs\(record, \{ addressLevelUtility: isNewGuide \}\)/);
	const denver = JSON.parse(read("data/localities/co-denver-denver-xcel.json"));
	assert.match(buildFaqs(denver)[0].a, /is the interconnection and distribution utility for Denver\./);
	assert.deepEqual(buildFaqs(denver), buildFaqs(denver, {}));
});

test("the state index marks only new address-level guides", () => {
	const page = read("src/pages/[state]/index.astro");
	assert.match(page, /NEW_GUIDES_DURING_MEASUREMENT/);
	assert.match(page, /addressLevelUtilityIds\.has\(entry\.recordId\) && " \(depends on the address\)"/);
});
