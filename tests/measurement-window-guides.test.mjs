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

test("existing and earlier pilot guides keep their pools; Longmont can see all guides", () => {
	const entries = [{ recordId: "co-denver-denver-xcel" }, ...[...NEW_GUIDES_DURING_MEASUREMENT].map((recordId) => ({ recordId }))];
	assert.deepEqual(relatedPoolFor("co-denver-denver-xcel", entries), [{ recordId: "co-denver-denver-xcel" }]);
	for (const id of NEW_GUIDES_DURING_MEASUREMENT) {
		assert.equal(isNewGuideDuringMeasurement(id), true);
		const hidden = id === "co-boulder-longmont-multi" ? [] : id === "co-jefferson-arvada-multi" ? ["co-boulder-longmont-multi"] : ["co-boulder-longmont-multi", "co-jefferson-arvada-multi"];
		assert.deepEqual(relatedPoolFor(id, entries), entries.filter((entry) => !hidden.includes(entry.recordId)));
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
		// Each record tells the reader to check their own address in the utility notes.
		assert.match(record.utility.notes, /your (own address|electric bill)/);
		const utilityFaq = buildFaqs(record, { addressLevelUtility: true })[0];
		assert.match(utilityFaq.a, /^It depends on the address\./);
		assert.doesNotMatch(utilityFaq.a, /is the interconnection and distribution utility for/);
		// Pathway text must never be read as an automated permit path by the snippet or Permit Path logic.
		assert.doesNotMatch(record.eligibility_constraints.value.program_or_pathway, /solarapp|symbium|automated|instant/i);
		// Null fee amounts render as "amount not verified"; taxes belong in the notes.
		assert.ok(record.permit_fees.value.every((fee) => fee.amount_usd === null || typeof fee.amount_usd === "number"));
	}
	// Aurora's own sources say other utilities serve parts of the city, so it stays an address check.
	assert.equal(hasVerifiedUnambiguousUtility(JSON.parse(read("data/localities/co-arapahoe-aurora-xcel.json"))), false);
	assert.match(read("src/layouts/LocalityGuideLayout.astro"), /buildFaqs\(record, \{ addressLevelUtility: isNewGuide, documentContext: hasDocumentContext, combinedDocumentChecklist: isLongmontGuide \}\)/);
	const denver = JSON.parse(read("data/localities/co-denver-denver-xcel.json"));
	assert.match(buildFaqs(denver)[0].a, /is the interconnection and distribution utility for Denver\./);
	assert.deepEqual(buildFaqs(denver), buildFaqs(denver, {}));
});

test("the state index marks only new address-level guides", () => {
	const page = read("src/pages/[state]/index.astro");
	assert.match(page, /NEW_GUIDES_DURING_MEASUREMENT/);
	assert.match(page, /addressLevelUtilityIds\.has\(entry\.recordId\) && " \(depends on the address\)"/);
});

test("Lakewood does not turn an old general fee schedule into a solar price or review promise", () => {
	const record = JSON.parse(read("data/localities/co-jefferson-lakewood-xcel.json"));
	assert.equal(record.timeline_days.value, null);
	assert.ok(record.permit_fees.value.every((fee) => fee.amount_usd === null));
	assert.match(record.permit_fees.notes, /January 1, 2021/);
	assert.match(record.required_documents.value[0].name, /professional engineer/i);
	assert.match(record.inspection_steps.value.join(" "), /framing inspection is required when the roof structure needs upgrading/i);
	assert.match(record.eligibility_constraints.value.other_conditions.join(" "), /O-2024-20/);
});

test("program eligibility is displayed only on the four approved guides and survives the measurement window", () => {
	const layout = read("src/layouts/LocalityGuideLayout.astro");
	const scoped = layout.match(/const showProgramEligibility = new Set\(\[([\s\S]*?)\]\)\.has\(record.record_id\);/);
	assert.ok(scoped);
	assert.deepEqual([...scoped[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort(), [
		"co-arapahoe-aurora-xcel", "co-jefferson-arvada-multi", "co-jefferson-lakewood-xcel", "co-larimer-fort-collins-fcu",
	]);
	assert.equal(layout.match(/showProgramEligibility && p\.eligibility &&/g)?.length, 3);
	assert.equal(layout.match(/data-program-eligibility/g)?.length, 3);
	assert.doesNotMatch(scoped[0], /isNewGuide|MEASUREMENT/);
	const fortCollins = JSON.parse(read("data/localities/co-larimer-fort-collins-fcu.json"));
	assert.match(fortCollins.rebates.value[0].eligibility, /Participating Solar Contractor/);
	assert.match(fortCollins.rebates.value[1].eligibility, /640/);
	assert.match(fortCollins.eligibility_constraints.value.other_conditions.join(" "), /existing generation and participation in Community Solar/);
});


test("Arvada cannot change the related lists of the three already-published Colorado pilots", () => {
 const { entries } = loadEntries();
 const before = entries.filter((e) => !["co-jefferson-arvada-multi", "co-boulder-longmont-multi"].includes(e.recordId));
 for (const id of ["co-arapahoe-aurora-xcel", "co-larimer-fort-collins-fcu", "co-jefferson-lakewood-xcel"]) {
  const current = entries.find((e) => e.recordId === id);
  assert.deepEqual(buildRelatedLocalities(current, relatedPoolFor(id, entries), 6), buildRelatedLocalities(current, before, 6));
 }
});

test("Arvada keeps utility choice, process uncertainty and the posted-document caveat", async () => {
 const record = JSON.parse(read("data/localities/co-jefferson-arvada-multi.json"));
 const { hasVerifiedUnambiguousUtility } = await import("../src/lib/utility-split-guard.ts");
 const { buildFaqs } = await import("../src/lib/locality-guide.ts");
 assert.equal(hasVerifiedUnambiguousUtility(record), false);
 assert.equal(record.generation_supplier.value, null);
 assert.equal(record.timeline_days.value, null);
 assert.match(record.utility.value, /Xcel Energy or United Power/);
 assert.deepEqual(record.interconnection_url.source_ids, ["X1", "UP2"]);
 assert.deepEqual(record.permit_fees.value.map((x) => x.amount_usd), [55, 55]);
 assert.match(record.permit_fees.notes, /Use tax and other project charges/);
 assert.match(record.permit_fees.value[1].notes, /do not automatically add/);
 const context = record.eligibility_constraints.value.other_conditions.join(" ");
 assert.match(context, /June 1, 2026/);
 assert.match(context, /NEC 2026/);
 assert.match(context, /NEC 2023/);
 const faq = buildFaqs(record, { addressLevelUtility: true, documentContext: true }).find((x) => x.q.startsWith("What documents"));
 assert.match(faq.a, /posted solar checklist/);
 assert.match(faq.a, /Confirm the required uploads under the June 2026 process/);
 const layout = read("src/layouts/LocalityGuideLayout.astro");
 assert.match(layout, /hasDocumentContext && <p class="fact-notes" data-documents-context/);
 assert.match(layout, /documentContext: hasDocumentContext/);
 assert.match(layout, /data-utility-choice/);
});


test("Longmont preserves the related lists of all 355 previously published guides", () => {
 const { entries } = loadEntries();
 const id = "co-boulder-longmont-multi";
 const before = entries.filter((e) => e.recordId !== id);
 assert.equal(before.length, 355);
 for (const current of before) {
  const expected = buildRelatedLocalities(current, relatedPoolFor(current.recordId, before), 6);
  const actual = buildRelatedLocalities(current, relatedPoolFor(current.recordId, entries), 6);
  assert.deepEqual(actual, expected, current.recordId);
 }
});

test("Longmont keeps expedited review, jurisdiction, contractor and current-code qualifications", async () => {
 const record = JSON.parse(read("data/localities/co-boulder-longmont-multi.json"));
 const { hasVerifiedUnambiguousUtility } = await import("../src/lib/utility-split-guard.ts");
 const { buildFaqs } = await import("../src/lib/locality-guide.ts");
 assert.equal(hasVerifiedUnambiguousUtility(record), false);
 assert.equal(record.battery_programs.value, null);
 assert.equal(record.rebates.value, null);
 assert.ok(record.permit_fees.value.every((fee) => fee.amount_usd === null));
 assert.equal(record.timeline_days.value.max_days, 5);
 assert.match(record.timeline_days.value.notes, /electrical service upgrade do not qualify/);
 assert.match(record.timeline_days.value.notes, /after LPC approval/);
 assert.match(record.eligibility_constraints.value.other_conditions.join(" "), /does not establish a homeowner exception/);
 assert.match(record.interconnection_url.notes, /Do not energize/);
 const faq = buildFaqs(record, { addressLevelUtility: true, documentContext: true, combinedDocumentChecklist: true });
 const doc = faq.find((x) => x.q.startsWith("What documents"));
 assert.match(doc.a, /City and LPC submission documents/);
 assert.match(doc.a, /applies when: Roof-mounted equipment/);
 assert.match(doc.a, /LPC-served projects/);
 assert.match(doc.a, /When storage or a line-side connection/);
 assert.match(doc.a, /NEC 2020 and IRC 2021/);
 assert.match(doc.a, /proposed NEC 2026 update/);
 const timeline = faq.find((x) => x.q.startsWith("How long"));
 assert.match(timeline.a, /different review stages/);
 const layout = read("src/layouts/LocalityGuideLayout.astro");
 assert.match(layout, /const hasDocumentContext = isArvadaGuide \|\| isLongmontGuide;/);
 assert.match(layout, /5 business days for eligible expedited review/);
 assert.match(layout, /Complete qualifying applications only; electrical service upgrades are excluded/);
});
