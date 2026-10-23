// Tests for balanced related-city selection (src/lib/related-balance.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { buildLocalityIndexEntries, buildRelatedLocalities } from "../src/lib/locality-guide.ts";
import { balancedRelatedMap, observationLockedRecordIds, relatedForPage } from "../src/lib/related-balance.ts";
import { validateRegistry } from "../src/lib/content-links.ts";

const registry = JSON.parse(readFileSync("data/content-links/registry.json", "utf8"));
const cfg = registry.balanced_related ?? { state: "CA", counties: [], limit: 6, max_pages: 0, pages: [], control_pages: [] };
const t = registry.balanced_related ? test : test.skip; // rolled back = block removed
const recordsById = new Map(readdirSync("data/localities").filter((f) => f.endsWith(".json")).map((f) => {
	const r = JSON.parse(readFileSync(`data/localities/${f}`, "utf8"));
	return [r.record_id, r];
}));
const evaluation = [];
for (const f of readdirSync("output").filter((f) => f.endsWith("-evaluation.json"))) evaluation.push(...(JSON.parse(readFileSync(`output/${f}`, "utf8")).records ?? []));
const entries = buildLocalityIndexEntries(evaluation, recordsById);
const locked = observationLockedRecordIds(entries, registry.rollout.locality_pages);
const members = entries.filter((e) => e.state === cfg.state && cfg.counties.includes(e.county));

function inboundWithin(map) {
	const inbound = new Map(members.map((m) => [m.recordId, 0]));
	for (const m of members) for (const r of map(m)) if (inbound.has(r.recordId)) inbound.set(r.recordId, inbound.get(r.recordId) + 1);
	return inbound;
}

t("the registry's explicit page list is exactly the READY guides of the listed counties", () => {
	assert.deepEqual(members.map((m) => m.guideUrl).sort(), [...cfg.pages].sort());
	assert.ok(cfg.pages.length <= cfg.max_pages);
	assert.deepEqual(validateRegistry(registry, readdirSync("src/content/blog").map((f) => `/blog/${f.replace(/\.md$/, "")}/`)), []);
});

t("pages outside the listed counties get exactly the existing list", () => {
	const outside = entries.filter((e) => !(e.state === cfg.state && cfg.counties.includes(e.county)));
	assert.ok(outside.length > 300);
	for (const e of outside.filter((_, i) => i % 7 === 0)) {
		assert.deepEqual(relatedForPage(e, entries, cfg, locked), buildRelatedLocalities(e, entries, 6), e.recordId);
	}
	assert.deepEqual(relatedForPage(members[0], entries, undefined, locked), buildRelatedLocalities(members[0], entries, 6));
});

t("every unlocked sibling guide is linked, where the existing cut leaves some with none", () => {
	const map = balancedRelatedMap(entries, { state: cfg.state, counties: cfg.counties, limit: cfg.limit, lockedRecordIds: locked });
	const before = inboundWithin((m) => buildRelatedLocalities(m, entries, cfg.limit));
	const after = inboundWithin((m) => map.get(m.recordId));
	const unlocked = members.filter((m) => !locked.has(m.recordId));
	assert.ok(unlocked.filter((m) => before.get(m.recordId) === 0).length >= 4, "baseline has starved unlocked guides");
	assert.equal(unlocked.filter((m) => after.get(m.recordId) === 0).length, 0);
	const spread = (map2) => Math.max(...unlocked.map((m) => map2.get(m.recordId))) - Math.min(...unlocked.map((m) => map2.get(m.recordId)));
	assert.ok(spread(after) <= 3);
	assert.ok(spread(after) < spread(before));
});

t("pages under measurement keep exactly the inbound links they have today, from the same donors", () => {
	const map = balancedRelatedMap(entries, { state: cfg.state, counties: cfg.counties, limit: cfg.limit, lockedRecordIds: locked });
	const lockedMembers = members.filter((m) => locked.has(m.recordId));
	assert.ok(lockedMembers.length >= 2);
	for (const target of lockedMembers) {
		const donors = (listOf) => members.filter((d) => d.recordId !== target.recordId && listOf(d).some((r) => r.recordId === target.recordId)).map((d) => d.recordId).sort();
		assert.deepEqual(donors((d) => map.get(d.recordId)), donors((d) => buildRelatedLocalities(d, entries, cfg.limit)), target.recordId);
	}
});

t("balanced lists stay relevant and bounded: same state, never self, at most the limit, drawn from the existing candidates", () => {
	const map = balancedRelatedMap(entries, { state: cfg.state, counties: cfg.counties, limit: cfg.limit, lockedRecordIds: locked });
	for (const m of members) {
		const list = map.get(m.recordId);
		const allowed = new Set(buildRelatedLocalities(m, entries, Infinity).map((r) => r.recordId));
		assert.ok(list.length <= cfg.limit, m.recordId);
		assert.ok(list.every((r) => r.recordId !== m.recordId && r.state === m.state && allowed.has(r.recordId)), m.recordId);
		assert.equal(new Set(list.map((r) => r.recordId)).size, list.length);
		assert.ok(list.every((r) => r.county === m.county), "13 cities in the county, so every pick is a same-county city");
	}
});

t("pages in an experiment or observation window keep their existing list", () => {
	const map = balancedRelatedMap(entries, { state: cfg.state, counties: cfg.counties, limit: cfg.limit, lockedRecordIds: locked });
	const lockedMembers = members.filter((m) => locked.has(m.recordId));
	assert.ok(lockedMembers.length >= 2, "Mountain View and Los Gatos are in the PTO link pilot");
	for (const m of lockedMembers) assert.deepEqual(map.get(m.recordId), buildRelatedLocalities(m, entries, cfg.limit), m.recordId);
});

t("selection is deterministic and independent of input order", () => {
	const a = balancedRelatedMap(entries, { state: cfg.state, counties: cfg.counties, limit: cfg.limit, lockedRecordIds: locked });
	const b = balancedRelatedMap([...entries].reverse(), { state: cfg.state, counties: cfg.counties, limit: cfg.limit, lockedRecordIds: locked });
	for (const m of members) assert.deepEqual(a.get(m.recordId).map((r) => r.recordId), b.get(m.recordId).map((r) => r.recordId), m.recordId);
});

t("synthetic county of ten: inbound counts differ by at most two (existing cut: far more)", () => {
	const mk = (i) => ({ recordId: `r${i}`, city: `City ${String.fromCharCode(65 + i)}`, county: "X County", utility: "U (U)", generationSupplierName: null, completenessPct: 100, lastVerified: "2026-10-01", citySlug: `c${i}`, guideUrl: `/s/c${i}/`, state: "CA", stateName: "California", stateSlug: "california" });
	const es = Array.from({ length: 10 }, (_, i) => mk(i));
	const map = balancedRelatedMap(es, { state: "CA", counties: ["X County"], limit: 6, lockedRecordIds: new Set() });
	const inbound = new Map(es.map((e) => [e.recordId, 0]));
	for (const lst of map.values()) for (const r of lst) inbound.set(r.recordId, inbound.get(r.recordId) + 1);
	assert.ok(Math.max(...inbound.values()) - Math.min(...inbound.values()) <= 2);
	const legacy = new Map(es.map((e) => [e.recordId, 0]));
	for (const e of es) for (const r of buildRelatedLocalities(e, es, 6)) legacy.set(r.recordId, legacy.get(r.recordId) + 1);
	assert.ok(Math.max(...legacy.values()) - Math.min(...legacy.values()) > 1, "the existing cut is unbalanced");
});

t("the measurement control is a same-state county of similar size, unlocked and disjoint from the rollout", () => {
	const control = new Set(cfg.control_pages);
	assert.ok(control.size >= 10);
	assert.ok(cfg.pages.every((p) => !control.has(p)));
	const riverside = entries.filter((e) => e.state === "CA" && e.county === "Riverside County" && !locked.has(e.recordId));
	assert.deepEqual(riverside.map((e) => e.guideUrl).sort(), [...cfg.control_pages].sort());
	// A control must not be touched by the rollout.
	const map = balancedRelatedMap(entries, { state: cfg.state, counties: cfg.counties, limit: cfg.limit, lockedRecordIds: locked });
	for (const e of riverside) assert.ok(!map.has(e.recordId));
});
