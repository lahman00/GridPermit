// Tests for the deterministic internal-linking engine (src/lib/content-links.ts)
// and its registry (data/content-links/registry.json).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import {
	anchorFromTitle,
	recordFlags,
	scopeMatches,
	selectArticleBacklinks,
	selectHubResources,
	selectLocalityResources,
	selectResources,
	validateRegistry,
	MAX_LINKS_PER_PAGE,
} from "../src/lib/content-links.ts";
import { QUICK_ANSWER_PILOTS } from "../src/lib/quick-answer-pilots.ts";
import { COMMERCIAL_SEO_PROFILES } from "../src/lib/commercial-seo-profiles.ts";
import { PERMIT_PATHWAY_RECORD_IDS } from "../src/lib/permit-pathway-answer.ts";
import { citySlug, guideUrlForCitySlug, utilityShortName } from "../src/lib/locality-guide.ts";

const registry = JSON.parse(readFileSync("data/content-links/registry.json", "utf8"));

function readPosts() {
	const dir = "src/content/blog";
	return readdirSync(dir)
		.filter((f) => f.endsWith(".md"))
		.map((f) => {
			const raw = readFileSync(`${dir}/${f}`, "utf8");
			const title = raw.match(/^title:\s*"(.*)"\s*$/m)?.[1] ?? "";
			return { url: `/blog/${f.replace(/\.md$/, "")}/`, title, body: raw };
		});
}
const posts = readPosts();
const articleRefs = posts.map(({ url, title }) => ({ url, title }));

function localityRecords() {
	return readdirSync("data/localities")
		.filter((f) => f.endsWith(".json"))
		.map((f) => JSON.parse(readFileSync(`data/localities/${f}`, "utf8")));
}
const records = localityRecords();
const rolloutRecords = registry.rollout.locality_pages.map((url) => {
	const rec = records.find((r) => guideUrlForCitySlug(r.state, citySlug(r.city.value)) === url);
	assert.ok(rec, `rollout page has no locality record: ${url}`);
	return rec;
});

function factsFor(rec) {
	const url = guideUrlForCitySlug(rec.state, citySlug(rec.city.value));
	return {
		url,
		state: rec.state,
		utility: utilityShortName(rec.utility.value),
		citySlug: citySlug(rec.city.value),
		flags: recordFlags({
			pathway: rec.eligibility_constraints.value?.program_or_pathway ?? null,
			documentNames: (rec.required_documents.value ?? []).map((d) => d.name),
			conditions: rec.eligibility_constraints.value?.other_conditions ?? [],
		}),
	};
}

test("registry is structurally valid against the real blog collection", () => {
	assert.deepEqual(validateRegistry(registry, articleRefs.map((p) => p.url)), []);
});

test("anchorFromTitle removes only the trailing site-name suffix", () => {
	assert.equal(anchorFromTitle("PG&E Solar Installed but No PTO: What to Check | GridPermit"), "PG&E Solar Installed but No PTO: What to Check");
	assert.equal(anchorFromTitle("Plain title"), "Plain title");
	assert.equal(anchorFromTitle("A | GridPermit Guide"), "A | GridPermit Guide");
});

test("recordFlags only flags SolarAPP+ when the record text says so", () => {
	assert.deepEqual(recordFlags({ pathway: "SolarAPP+ instant permit" }), ["solarapp_pathway"]);
	assert.deepEqual(recordFlags({ documentNames: ["SolarAPP+ unique ID"] }), ["solarapp_pathway"]);
	assert.deepEqual(recordFlags({ pathway: "Expedited Electronic Submittal" }), []);
	assert.deepEqual(recordFlags({}), []);
});

test("scope matching never crosses utility, state or city", () => {
	const pge = registry.resources.find((r) => r.id === "pto-pge-installed-no-pto");
	const base = { url: "/x/", state: "CA", utility: "PG&E", citySlug: "a", flags: [] };
	assert.equal(scopeMatches(pge, base), true);
	assert.equal(scopeMatches(pge, { ...base, utility: "SCE" }), false);
	assert.equal(scopeMatches(pge, { ...base, utility: null }), false);
	assert.equal(scopeMatches(pge, { ...base, state: "NV" }), false);
	const lb = registry.resources.find((r) => r.id === "city-long-beach-express-vs-plan-review");
	assert.equal(scopeMatches(lb, { ...base, citySlug: "long-beach" }), true);
	assert.equal(scopeMatches(lb, { ...base, citySlug: "long-beach", state: "NV" }), false);
	assert.equal(scopeMatches(lb, { ...base, citySlug: "irvine" }), false);
});

test("selection is deterministic, bounded and independent of input order", () => {
	const facts = factsFor(rolloutRecords.find((r) => r.city.value === "San Mateo"));
	const a = selectLocalityResources(registry, articleRefs, facts);
	const b = selectLocalityResources(registry, [...articleRefs].reverse(), facts);
	const shuffled = { ...registry, resources: [...registry.resources].reverse() };
	const c = selectLocalityResources(shuffled, articleRefs, facts);
	assert.deepEqual(a, b);
	assert.deepEqual(a, c);
	assert.ok(a.length > 0 && a.length <= MAX_LINKS_PER_PAGE);
});

test("utility resources beat the general resource, and general fills remaining room", () => {
	const facts = { url: "/california/x/solar-permit-guide/", state: "CA", utility: "PG&E", citySlug: "x", flags: [] };
	const links = selectResources(registry, articleRefs, facts);
	assert.deepEqual(
		links.map((l) => l.relation),
		["utility", "utility", "general"],
	);
	assert.deepEqual(links.map((l) => l.id), [
		"interconnection-pge-zero-export",
		"pto-pge-installed-no-pto",
		"general-city-permit-vs-utility-pto",
	]);
});

test("a utility with no dedicated article only gets the general resource", () => {
	const facts = { url: "/california/x/solar-permit-guide/", state: "CA", utility: "SDG&E", citySlug: "x", flags: [] };
	assert.deepEqual(selectResources(registry, articleRefs, facts).map((l) => l.id), ["general-city-permit-vs-utility-pto"]);
});

test("a link already shown on the page, or the page itself, is never repeated", () => {
	const facts = { url: "/blog/city-permit-vs-utility-pto/", state: "CA", utility: "SCE", citySlug: null, flags: [] };
	assert.ok(!selectResources(registry, articleRefs, facts).some((l) => l.href === facts.url));
	const f2 = { url: "/california/x/solar-permit-guide/", state: "CA", utility: "SCE", citySlug: "x", flags: [] };
	const links = selectResources(registry, articleRefs, f2, { exclude: ["/blog/city-permit-vs-utility-pto/"] });
	assert.ok(!links.some((l) => l.href === "/blog/city-permit-vs-utility-pto/"));
});

test("fail closed: a resource whose article is missing is dropped", () => {
	const facts = { url: "/california/x/solar-permit-guide/", state: "CA", utility: "PG&E", citySlug: "x", flags: [] };
	const without = articleRefs.filter((p) => p.url !== "/blog/pge-no-pto-installer-closed/");
	assert.ok(!selectResources(registry, without, facts).some((l) => l.id === "pto-pge-installed-no-pto"));
});

test("pages outside the rollout get no links", () => {
	const facts = { url: "/california/anywhere/solar-permit-guide/", state: "CA", utility: "PG&E", citySlug: "anywhere", flags: [] };
	assert.deepEqual(selectLocalityResources(registry, articleRefs, facts), []);
	assert.deepEqual(selectHubResources(registry, articleRefs, { url: "/california/utility/sdg-e/", state: "CA", utility: "SDG&E" }), []);
	assert.deepEqual(selectArticleBacklinks(registry, "/blog/sce-guide/", [], []), []);
});

test("hub resources exclude city and record-scoped articles", () => {
	for (const hubUrl of registry.rollout.utility_hubs) {
		const utility = hubUrl.includes("pg-e") ? "PG&E" : "SCE";
		const links = selectHubResources(registry, articleRefs, { url: hubUrl, state: "CA", utility });
		assert.ok(links.length > 0);
		for (const l of links) assert.ok(["utility", "general"].includes(l.relation));
	}
});

test("rollout stays inside its cap and never includes experiment or reviewed pages", () => {
	assert.ok(registry.rollout.locality_pages.length <= registry.rollout.max_locality_pages);
	const protectedIds = new Set([
		...QUICK_ANSWER_PILOTS.keys(),
		...COMMERCIAL_SEO_PROFILES.keys(),
		...PERMIT_PATHWAY_RECORD_IDS,
	]);
	for (const rec of rolloutRecords) {
		assert.ok(!protectedIds.has(rec.record_id), `${rec.record_id} is a protected experiment/reviewed page`);
	}
});

test("every rollout page and article exists", () => {
	for (const url of registry.rollout.articles) assert.ok(posts.some((p) => p.url === url), url);
	assert.equal(rolloutRecords.length, registry.rollout.locality_pages.length);
});

test("every rolled-out locality actually resolves to links and none are duplicated", () => {
	for (const rec of rolloutRecords) {
		const links = selectLocalityResources(registry, articleRefs, factsFor(rec));
		assert.ok(links.length >= 2, `${rec.record_id} got ${links.length} links`);
		assert.equal(new Set(links.map((l) => l.href)).size, links.length);
		assert.equal(new Set(links.map((l) => l.anchor)).size, links.length);
	}
});

test("scope integrity: each utility-scoped article names its utility, each city article names its city", () => {
	for (const r of registry.resources) {
		const post = posts.find((p) => p.url === r.url);
		const hay = post.body;
		for (const u of r.scope.utilities ?? []) {
			assert.ok(post.title.includes(u), `${r.id}: title does not name ${u}`);
			assert.ok(hay.includes(u), `${r.id}: body does not name ${u}`);
		}
		for (const c of r.scope.cities ?? []) {
			const name = c.slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
			assert.ok(post.title.includes(name), `${r.id}: title does not name ${name}`);
		}
	}
});

test("article backlinks point only at rolled-out pages whose own utility matches", () => {
	const localities = rolloutRecords.map((r) => ({ ...factsFor(r), label: r.city.value }));
	const hubs = [
		{ url: "/california/utility/pg-e/", state: "CA", utility: "PG&E", label: "PG&E" },
		{ url: "/california/utility/sce/", state: "CA", utility: "SCE", label: "SCE" },
	];
	const pge = selectArticleBacklinks(registry, "/blog/pge-no-pto-installer-closed/", hubs, localities);
	assert.deepEqual(pge.filter((t) => t.kind === "utility_hub").map((t) => t.href), ["/california/utility/pg-e/"]);
	for (const t of pge.filter((x) => x.kind === "locality_guide")) {
		const rec = rolloutRecords.find((r) => guideUrlForCitySlug(r.state, citySlug(r.city.value)) === t.href);
		assert.equal(utilityShortName(rec.utility.value), "PG&E");
	}
	assert.ok(pge.length <= 5);
	const general = selectArticleBacklinks(registry, "/blog/city-permit-vs-utility-pto/", hubs, localities);
	assert.deepEqual(general.map((t) => t.href), ["/california/utility/pg-e/", "/california/utility/sce/"]);
});
