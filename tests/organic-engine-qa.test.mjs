// Unit tests for scripts/organic-engine-qa.mjs: the snapshot extractor and the
// baseline-vs-candidate comparison policy.
import { test } from "node:test";
import assert from "node:assert/strict";
import { compareSnapshots, extractPageFacts } from "../scripts/organic-engine-qa.mjs";

const registry = {
	resources: [{ url: "/blog/a/" }],
	rollout: { max_locality_pages: 2, locality_pages: ["/california/x/solar-permit-guide/"], utility_hubs: [], articles: [] },
};
const page = (over = {}) => ({
	title: "T",
	canonical: ["https://mygridpermit.com/x/"],
	robots: [],
	h1: 1,
	jsonld_hash: "h",
	jsonld_blocks: 1,
	internal_links: ["/blog/a/"].slice(0, 0),
	external_links_hash: "e",
	external_link_count: 1,
	track_click: { permit_guide_clicked: 1 },
	duplicate_ids: [],
	img_without_alt: 0,
	bytes: 1000,
	...over,
});
const snap = (pages) => ({ pages, sitemap: Object.keys(pages), robots_txt_hash: "r" });
const X = "/california/x/solar-permit-guide/";

test("extractPageFacts reads canonical, robots, jsonld, links and tracked clicks", () => {
	const html = `<html><head><title>A &amp; B</title><link rel="canonical" href="https://mygridpermit.com/x/"><meta name="robots" content="noindex"><script type="application/ld+json">{"b":1,"a":2}</script></head><body><h1>h</h1><a href="/blog/a/#top" data-track-click="internal_resource_clicked">x</a><a href="https://example.com/">e</a><div id="d"></div><div id="d"></div><img src="i"></body></html>`;
	const f = extractPageFacts(html);
	assert.equal(f.title, "A & B");
	assert.deepEqual(f.canonical, ["https://mygridpermit.com/x/"]);
	assert.deepEqual(f.robots, ["noindex"]);
	assert.deepEqual(f.internal_links, ["/blog/a/"]);
	assert.equal(f.external_link_count, 1);
	assert.deepEqual(f.track_click, { internal_resource_clicked: 1 });
	assert.deepEqual(f.duplicate_ids, ["d"]);
	assert.equal(f.img_without_alt, 1);
	assert.equal(f.h1, 1);
});

test("an additive internal link on a rollout page passes", () => {
	const base = snap({ [X]: page(), "/blog/a/": page() });
	const head = snap({
		[X]: page({ internal_links: ["/blog/a/"], track_click: { permit_guide_clicked: 1, internal_resource_clicked: 1 }, bytes: 1300 }),
		"/blog/a/": page(),
	});
	const r = compareSnapshots(base, head, registry);
	assert.deepEqual(r.failures, []);
	assert.equal(r.summary.pages_changed, 1);
});

test("changes to canonical, robots, jsonld, title or partner links fail", () => {
	const base = snap({ [X]: page(), "/blog/a/": page() });
	for (const over of [{ canonical: ["https://x/"] }, { robots: ["noindex"] }, { jsonld_hash: "z" }, { title: "U" }, { external_links_hash: "q" }]) {
		const head = snap({ [X]: page({ internal_links: ["/blog/a/"], bytes: 1100, ...over }), "/blog/a/": page() });
		assert.ok(compareSnapshots(base, head, registry).failures.length > 0, JSON.stringify(over));
	}
});

test("link changes outside the rollout, removed links and unexpected targets fail", () => {
	const base = snap({ [X]: page({ internal_links: ["/blog/a/"] }), "/other/": page(), "/blog/a/": page() });
	const outside = snap({ [X]: page({ internal_links: ["/blog/a/"], track_click: { permit_guide_clicked: 1, internal_resource_clicked: 1 }, bytes: 1100 }), "/other/": page({ internal_links: ["/blog/a/"], bytes: 1100 }), "/blog/a/": page() });
	assert.ok(compareSnapshots(base, outside, registry).failures.some((f) => f.includes("not in the rollout")));
	const removed = snap({ [X]: page({ internal_links: [], bytes: 900 }), "/other/": page(), "/blog/a/": page() });
	assert.ok(compareSnapshots(base, removed, registry).failures.some((f) => f.includes("removed links")));
	const unexpected = snap({ [X]: page({ internal_links: ["/blog/a/", "/blog/zzz/"], bytes: 1100 }), "/other/": page(), "/blog/a/": page(), "/blog/zzz/": page() });
	assert.ok(compareSnapshots(base, unexpected, registry).failures.some((f) => f.includes("unexpected new link target")));
});

test("a rollout page the engine did not change is reported as dead config", () => {
	const base = snap({ [X]: page(), "/blog/a/": page() });
	assert.ok(compareSnapshots(base, base, registry).failures.some((f) => f.includes("unchanged by engine")));
});

test("noindex link targets and sitemap omissions fail", () => {
	const base = snap({ [X]: page(), "/blog/a/": page() });
	const head = snap({ [X]: page({ internal_links: ["/blog/a/"], bytes: 1100 }), "/blog/a/": page({ robots: ["noindex"] }) });
	assert.ok(compareSnapshots(base, head, registry).failures.some((f) => f.includes("noindex")));
	const head2 = { ...snap({ [X]: page({ internal_links: ["/blog/a/"], bytes: 1100 }), "/blog/a/": page() }), sitemap: [X] };
	const base2 = { ...base, sitemap: [X] };
	assert.ok(compareSnapshots(base2, head2, registry).failures.some((f) => f.includes("missing from sitemap")));
});
