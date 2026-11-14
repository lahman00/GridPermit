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

test("existing and earlier pilot guides keep their pools; Thornton can see all guides", () => {
	const entries = [{ recordId: "co-denver-denver-xcel" }, ...[...NEW_GUIDES_DURING_MEASUREMENT].map((recordId) => ({ recordId }))];
	assert.deepEqual(relatedPoolFor("co-denver-denver-xcel", entries), [{ recordId: "co-denver-denver-xcel" }]);
	for (const id of NEW_GUIDES_DURING_MEASUREMENT) {
		assert.equal(isNewGuideDuringMeasurement(id), true);
		const hidden = id === "co-adams-thornton-multi" ? [] : ["co-adams-thornton-multi", ...(id === "co-douglas-parker-multi" ? [] : ["co-douglas-parker-multi", ...(id === "co-adams-westminster-multi" ? [] : ["co-adams-westminster-multi", ...(id === "co-broomfield-broomfield-multi" ? [] : ["co-broomfield-broomfield-multi", ...(id === "co-boulder-boulder-multi" ? [] : ["co-boulder-boulder-multi", ...(id === "co-arapahoe-centennial-multi" ? [] : id === "co-boulder-longmont-multi" ? ["co-arapahoe-centennial-multi"] : id === "co-jefferson-arvada-multi" ? ["co-arapahoe-centennial-multi", "co-boulder-longmont-multi"] : ["co-arapahoe-centennial-multi", "co-boulder-longmont-multi", "co-jefferson-arvada-multi"])])])])])];
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
	assert.match(read("src/layouts/LocalityGuideLayout.astro"), /buildFaqs\(record, \{ addressLevelUtility: isNewGuide, utilityAnswer: isBoulderGuide \? record\.utility\.notes \?\? undefined : undefined, documentContext: hasDocumentContext, combinedDocumentChecklist: isLongmontGuide \|\| isCentennialGuide \|\| isBoulderGuide \|\| isBroomfieldGuide \|\| isWestminsterGuide \|\| isParkerGuide \|\| isThorntonGuide, expectedReviewTimeline: isCentennialGuide \|\| isBroomfieldGuide \|\| isParkerGuide \|\| isThorntonGuide, documentChecklistIntro: isThorntonGuide/);
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

test("program eligibility is displayed only on the seven approved guides and survives the measurement window", () => {
	const layout = read("src/layouts/LocalityGuideLayout.astro");
	const scoped = layout.match(/const showProgramEligibility = new Set\(\[([\s\S]*?)\]\)\.has\(record.record_id\);/);
	assert.ok(scoped);
	assert.deepEqual([...scoped[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort(), [
		"co-adams-westminster-multi", "co-arapahoe-aurora-xcel", "co-boulder-boulder-multi", "co-broomfield-broomfield-multi", "co-jefferson-arvada-multi", "co-jefferson-lakewood-xcel", "co-larimer-fort-collins-fcu",
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
 const before = entries.filter((e) => !["co-jefferson-arvada-multi", "co-boulder-longmont-multi", "co-arapahoe-centennial-multi", "co-boulder-boulder-multi", "co-broomfield-broomfield-multi", "co-adams-westminster-multi", "co-douglas-parker-multi", "co-adams-thornton-multi"].includes(e.recordId));
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
 const before = entries.filter((e) => e.recordId !== id && e.recordId !== "co-arapahoe-centennial-multi" && e.recordId !== "co-boulder-boulder-multi" && e.recordId !== "co-broomfield-broomfield-multi" && e.recordId !== "co-adams-westminster-multi" && e.recordId !== "co-douglas-parker-multi" && e.recordId !== "co-adams-thornton-multi");
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
 assert.match(layout, /const hasDocumentContext = isArvadaGuide \|\| isLongmontGuide \|\| isCentennialGuide \|\| isBoulderGuide \|\| isBroomfieldGuide \|\| isWestminsterGuide \|\| isParkerGuide \|\| isThorntonGuide;/);
 assert.match(layout, /5 business days for eligible expedited review/);
 assert.match(layout, /Complete qualifying applications only; electrical service upgrades are excluded/);
});


test("Centennial preserves the related lists of all 356 previously published guides", () => {
 const { entries } = loadEntries();
 const before = entries.filter((e) => e.recordId !== "co-arapahoe-centennial-multi" && e.recordId !== "co-boulder-boulder-multi" && e.recordId !== "co-broomfield-broomfield-multi" && e.recordId !== "co-adams-westminster-multi" && e.recordId !== "co-douglas-parker-multi" && e.recordId !== "co-adams-thornton-multi");
 assert.equal(before.length, 356);
 for (const current of before) {
  assert.deepEqual(buildRelatedLocalities(current, relatedPoolFor(current.recordId, entries), 6), buildRelatedLocalities(current, relatedPoolFor(current.recordId, before), 6), current.recordId);
 }
});

test("Centennial keeps first-comment timing, fee scope and utility-specific document conditions", async () => {
 const record = JSON.parse(read("data/localities/co-arapahoe-centennial-multi.json"));
 const { hasVerifiedUnambiguousUtility } = await import("../src/lib/utility-split-guard.ts");
 const { buildFaqs } = await import("../src/lib/locality-guide.ts");
 assert.equal(hasVerifiedUnambiguousUtility(record), false);
 assert.equal(record.generation_supplier.value, null);
 assert.equal(record.battery_programs.value, null);
 assert.equal(record.rebates.value, null);
 assert.deepEqual(record.interconnection_url.source_ids, ["XCEL", "CORE"]);
 assert.match(record.timeline_days.value.notes, /5 business days to first comments/);
 assert.match(record.timeline_days.value.notes, /complete submittal and payment/);
 assert.match(record.permit_fees.value[0].notes, /not a total solar permit quote/);
 assert.match(record.permit_fees.value[1].notes, /total electrical valuation/);
 assert.match(record.permit_fees.notes, /no verified effective date/);
 const faqs = buildFaqs(record, { addressLevelUtility: true, documentContext: true, combinedDocumentChecklist: true, expectedReviewTimeline: true, documentChecklistIntro: "City and utility submission documents include:" });
 const docs = faqs.find((f) => f.q.startsWith("What documents")).a;
 assert.match(docs, /three-line diagram/);
 assert.match(docs, /CORE-served properties/);
 assert.match(docs, /Xcel customers should confirm/);
 assert.doesNotMatch(docs, /City and LPC/);
 assert.match(docs, /NEC 2020/);
 assert.match(docs, /NEC 2023/);
 assert.match(faqs.find((f) => f.q.startsWith("How long")).a, /not a permit-issuance deadline/);
 assert.doesNotMatch(faqs.find((f) => f.q.startsWith("How long")).a, /upper bound is verified/);
});


test("Boulder preserves the related lists of all 357 previously published guides", () => {
 const { entries } = loadEntries();
 const before = entries.filter((e) => e.recordId !== "co-boulder-boulder-multi" && e.recordId !== "co-broomfield-broomfield-multi" && e.recordId !== "co-adams-westminster-multi" && e.recordId !== "co-douglas-parker-multi" && e.recordId !== "co-adams-thornton-multi");
 assert.equal(before.length, 357);
 for (const current of before) {
  assert.deepEqual(buildRelatedLocalities(current, relatedPoolFor(current.recordId, entries), 6), buildRelatedLocalities(current, relatedPoolFor(current.recordId, before), 6), current.recordId);
 }
});

test("Boulder keeps permit scope, conditional programs and City versus utility documents", async () => {
 const record = JSON.parse(read("data/localities/co-boulder-boulder-multi.json"));
 const { hasVerifiedUnambiguousUtility } = await import("../src/lib/utility-split-guard.ts");
 const { buildFaqs } = await import("../src/lib/locality-guide.ts");
 assert.equal(hasVerifiedUnambiguousUtility(record), false);
 assert.equal(record.timeline_days.value, null);
 assert.equal(record.eligibility_constraints.value.system_size_kw_ac_max, null);
 assert.equal(record.eligibility_constraints.value.system_size_kw_dc_max, null);
 assert.match(record.eligibility_constraints.value.other_conditions.join(" "), /under 10 kW/);
 assert.match(record.eligibility_constraints.value.other_conditions.join(" "), /typically/);
 assert.match(record.eligibility_constraints.value.other_conditions.join(" "), /August 1, 2026/);
 assert.deepEqual(record.permit_fees.value.map((f) => f.amount_usd), [69.6,139.2]);
 assert.match(record.permit_fees.notes, /not a complete project quote/);
 assert.match(record.battery_programs.value[0].eligibility, /12 months/);
 assert.match(record.battery_programs.value[0].eligibility, /parallel/);
 assert.match(record.rebates.value[0].description, /not 15% of the system price/);
 assert.match(record.rebates.value[1].eligibility, /owner-occupied/);
 assert.match(record.rebates.value[1].eligibility, /EnergySmart/);
 assert.match(record.rebates.value[1].description, /50%/);
 assert.match(record.rebates.value[1].description, /8,000/);
 const boulderFaqs = buildFaqs(record, {addressLevelUtility:true,utilityAnswer:record.utility.notes,documentContext:true,combinedDocumentChecklist:true,documentChecklistIntro:"Verified City application items and separate Xcel documents include:"});
 assert.equal(boulderFaqs[0].a, record.utility.notes);
 assert.doesNotMatch(boulderFaqs[0].a, /can differ from one address/);
 const docs = boulderFaqs.find((f) => f.q.startsWith("What documents")).a;
 assert.match(docs, /Xcel-served/);
 assert.match(docs, /structural modifications/);
 assert.match(docs, /full City solar-specific upload checklist/);
 assert.doesNotMatch(docs, /City and LPC/);
});

test("Colorado navigation is opt-in on discovery pages and leaves protected pages and the California estimator untouched", () => {
 const header = read("src/components/Header.astro");
 const home = read("src/pages/index.astro");
 const stateHub = read("src/pages/[state]/index.astro");
 const permits = read("src/pages/permits.astro");
 const search = read("src/pages/search.astro");
 const guideLayout = read("src/layouts/LocalityGuideLayout.astro");
 const blogLayout = read("src/layouts/BlogPost.astro");
 const organizer = read("src/pages/solar-project-organizer.astro");
 assert.match(header, /showColorado\?: boolean/);
 assert.match(header, /const \{ showColorado = false \} = Astro\.props/);
 assert.match(header, /\.\.\.\(showColorado \? \[\{ href: '\/colorado\/', label: 'Colorado' \}\] : \[\]\)/);
 assert.match(home, /<Header showColorado \/>/);
 assert.match(home, /<a href="\/colorado\/"><span><small>Source-linked city guides<\/small>Colorado<\/span><span aria-hidden="true">↗<\/span><\/a>/);
 assert.match(home, /California-Only Tool/);
 assert.match(home, /function isCaliforniaZip\(zip: string\): boolean/);
 assert.match(permits, /<Header showColorado \/>/);
 assert.match(search, /<Header showColorado \/>/);
 assert.match(stateHub, /<Header showColorado=\{stateCode === "CO"\} \/>/);
 assert.doesNotMatch(guideLayout, /showColorado/);
 assert.doesNotMatch(blogLayout, /showColorado/);
 assert.doesNotMatch(organizer, /showColorado/);
});


test("Broomfield preserves the related lists of all 358 previously published guides", () => {
 const { entries } = loadEntries();
 const before = entries.filter((e) => e.recordId !== "co-broomfield-broomfield-multi" && e.recordId !== "co-adams-westminster-multi" && e.recordId !== "co-douglas-parker-multi" && e.recordId !== "co-adams-thornton-multi");
 assert.equal(before.length, 358);
 for (const current of before) {
  assert.deepEqual(buildRelatedLocalities(current, relatedPoolFor(current.recordId, entries), 6), buildRelatedLocalities(current, relatedPoolFor(current.recordId, before), 6), current.recordId);
 }
});

test("Broomfield keeps unified jurisdiction, dual utility check, review goal caveat and code/homeowner conflicts", async () => {
 const record = JSON.parse(read("data/localities/co-broomfield-broomfield-multi.json"));
 const { hasVerifiedUnambiguousUtility } = await import("../src/lib/utility-split-guard.ts");
 const { buildFaqs } = await import("../src/lib/locality-guide.ts");
 assert.equal(hasVerifiedUnambiguousUtility(record), false);
 assert.equal(record.generation_supplier.value, null);
 assert.equal(record.battery_programs.value, null);
 assert.equal(record.rebates.value, null);
 assert.match(record.utility.value, /Xcel Energy or United Power/);
 assert.equal(record.county.value, "City and County of Broomfield");
 assert.equal(record.timeline_days.value.min_days, 7);
 assert.equal(record.timeline_days.value.max_days, 14);
 assert.match(record.timeline_days.value.notes, /goals, not guaranteed/);
 assert.match(record.permit_url.notes, /buildingpermits@broomfield\.org/);
 assert.match(record.permit_url.notes, /cannot be submitted using the Online Portal/);
 assert.match(record.permit_fees.notes, /65% plan review fee/);
 assert.match(record.permit_fees.notes, /4\.15%/);
 const conds = record.eligibility_constraints.value.other_conditions.join(" ");
 assert.match(conds, /2026 NEC/);
 assert.match(conds, /42 psf/);
 assert.match(conds, /Homeowner Statement/);
 const faqs = buildFaqs(record, { addressLevelUtility: true, documentContext: true, combinedDocumentChecklist: true, expectedReviewTimeline: true, documentChecklistIntro: "Broomfield solar submittal items and separate utility documents include:" });
 const docs = faqs.find((f) => f.q.startsWith("What documents")).a;
 assert.match(docs, /Broomfield solar submittal items and separate utility documents include:/);
 assert.match(docs, /Colorado Master Electrician/);
 assert.match(docs, /2026 NEC/);
 assert.match(docs, /42 psf/);
 assert.match(faqs.find((f) => f.q.startsWith("How long")).a, /not a guaranteed response or approval deadline/);
});


test("Westminster preserves the related lists of all 359 previously published guides", () => {
 const { entries } = loadEntries();
 const before = entries.filter((e) => e.recordId !== "co-adams-westminster-multi" && e.recordId !== "co-douglas-parker-multi" && e.recordId !== "co-adams-thornton-multi");
 assert.equal(before.length, 359);
 for (const current of before) {
  assert.deepEqual(buildRelatedLocalities(current, relatedPoolFor(current.recordId, entries), 6), buildRelatedLocalities(current, relatedPoolFor(current.recordId, before), 6), current.recordId);
 }
});

test("Westminster keeps dual county/utility checks, $300 base fee scope, separate ESS/MPU permits and 2018-checklist vs 2026-NEC caveat", async () => {
 const record = JSON.parse(read("data/localities/co-adams-westminster-multi.json"));
 const { hasVerifiedUnambiguousUtility } = await import("../src/lib/utility-split-guard.ts");
 const { buildFaqs } = await import("../src/lib/locality-guide.ts");
 assert.equal(hasVerifiedUnambiguousUtility(record), false);
 assert.equal(record.generation_supplier.value, null);
 assert.equal(record.timeline_days.value, null);
 assert.match(record.utility.value, /Xcel Energy or United Power/);
 assert.equal(record.county.value, "Adams and Jefferson counties");
 assert.deepEqual(record.permit_fees.value.map((f) => f.amount_usd), [300, 50]);
 assert.match(record.permit_fees.notes, /4\.25%/);
 assert.match(record.permit_fees.notes, /separate permits are required/);
 assert.match(record.rebates.value[0].description, /10 kW AC/);
 assert.match(record.battery_programs.value[0].description, /250 per kW AC/);
 const faqs = buildFaqs(record, { addressLevelUtility: true, documentContext: true, combinedDocumentChecklist: true, documentChecklistIntro: "Westminster Residential Solar submittal items and separate utility documents include:" });
 const docs = faqs.find((f) => f.q.startsWith("What documents")).a;
 assert.match(docs, /Westminster Residential Solar submittal items and separate utility documents include:/);
 assert.match(docs, /structural engineer's letter/);
 assert.match(docs, /May 7, 2018/);
 assert.match(docs, /2026 National Electrical Code/);
});

test("Parker preserves the related lists of all 360 previously published guides", () => {
 const { entries } = loadEntries();
 const before = entries.filter((e) => e.recordId !== "co-douglas-parker-multi" && e.recordId !== "co-adams-thornton-multi");
 assert.equal(before.length, 360);
 for (const current of before) {
  assert.deepEqual(buildRelatedLocalities(current, relatedPoolFor(current.recordId, entries), 6), buildRelatedLocalities(current, relatedPoolFor(current.recordId, before), 6), current.recordId);
 }
});

test("Parker keeps CORE electric cooperative check, 10-14 business day review goal caveat, $500 residential solar fee cap and 2020-checklist vs 2023/2026-NEC note", async () => {
 const record = JSON.parse(read("data/localities/co-douglas-parker-multi.json"));
 const { hasVerifiedUnambiguousUtility } = await import("../src/lib/utility-split-guard.ts");
 const { buildFaqs } = await import("../src/lib/locality-guide.ts");
 assert.equal(hasVerifiedUnambiguousUtility(record), false);
 assert.equal(record.generation_supplier.value, null);
 assert.equal(record.battery_programs.value, null);
 assert.equal(record.rebates.value, null);
 assert.match(record.utility.value, /CORE Electric Cooperative/);
 assert.equal(record.county.value, "Douglas County");
 assert.equal(record.timeline_days.value.min_days, 10);
 assert.equal(record.timeline_days.value.max_days, 14);
 assert.match(record.timeline_days.value.notes, /goal of 10–14 business days/);
 assert.deepEqual(record.permit_fees.value.map((f) => f.amount_usd), [500, null, 350]);
 assert.match(record.permit_fees.notes, /500 residential cap/);
 const faqs = buildFaqs(record, { addressLevelUtility: true, documentContext: true, combinedDocumentChecklist: true, expectedReviewTimeline: true, documentChecklistIntro: "Town of Parker eTRAKiT solar submittal items and CORE interconnection documents include:" });
 const docs = faqs.find((f) => f.q.startsWith("What documents")).a;
 assert.match(docs, /Town of Parker eTRAKiT solar submittal items and CORE interconnection documents include:/);
 assert.match(docs, /CORE Electric Cooperative Level 1 application form/);
 assert.match(docs, /2020 NEC/);
 assert.match(faqs.find((f) => f.q.startsWith("How long")).a, /not a guaranteed response or approval deadline/);
});

test("Thornton preserves the related lists of all 361 previously published guides", () => {
 const { entries } = loadEntries();
 const before = entries.filter((e) => e.recordId !== "co-adams-thornton-multi");
 assert.equal(before.length, 361);
 for (const current of before) {
  assert.deepEqual(buildRelatedLocalities(current, relatedPoolFor(current.recordId, entries), 6), buildRelatedLocalities(current, relatedPoolFor(current.recordId, before), 6), current.recordId);
 }
});

test("Thornton keeps Xcel/United Power check, rapid vs standard review goals, $500 cap + 65% plan review note, separate MPU permit and virtual inspection rules", async () => {
 const record = JSON.parse(read("data/localities/co-adams-thornton-multi.json"));
 const { hasVerifiedUnambiguousUtility } = await import("../src/lib/utility-split-guard.ts");
 const { buildFaqs } = await import("../src/lib/locality-guide.ts");
 assert.equal(hasVerifiedUnambiguousUtility(record), false);
 assert.equal(record.generation_supplier.value, null);
 assert.equal(record.battery_programs.value, null);
 assert.equal(record.rebates.value, null);
 assert.match(record.utility.value, /Xcel Energy or United Power/);
 assert.equal(record.county.value, "Adams County");
 assert.equal(record.timeline_days.value.min_days, 1);
 assert.equal(record.timeline_days.value.max_days, 8);
 assert.match(record.timeline_days.value.notes, /1-business-day review goal/);
 assert.deepEqual(record.permit_fees.value.map((f) => f.amount_usd), [500, null, 100]);
 assert.match(record.permit_fees.value[0].notes, /65% of Building Permit Fee/);
 const faqs = buildFaqs(record, { addressLevelUtility: true, documentContext: true, combinedDocumentChecklist: true, expectedReviewTimeline: true, documentChecklistIntro: "City of Thornton CityView solar submittal items and separate utility documents include:" });
 const docs = faqs.find((f) => f.q.startsWith("What documents")).a;
 assert.match(docs, /City of Thornton CityView solar submittal items and separate utility documents include:/);
 assert.match(docs, /Main Panel Upgrade/);
 assert.match(docs, /2026 NEC/);
 assert.match(faqs.find((f) => f.q.startsWith("How long")).a, /not a guaranteed response or approval deadline/);
});


