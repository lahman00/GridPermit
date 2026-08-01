import { test } from "node:test";
import assert from "node:assert/strict";

import { relatedPostsForUtility } from "../src/lib/related-posts.ts";

function makePosts() {
	return [
		{ title: "PG&E post", description: "d", url: "/blog/a/", category: "PG&E", displayDate: "x", sortDate: "2026-07-27", hasExactDate: true },
		{ title: "SCE post", description: "d", url: "/blog/b/", category: "SCE", displayDate: "x", sortDate: "2026-07-26", hasExactDate: true },
		{ title: "SDG&E post", description: "d", url: "/blog/c/", category: "SDG&E", displayDate: "x", sortDate: "2026-07-27", hasExactDate: true },
		{ title: "Incentives post", description: "d", url: "/blog/d/", category: "Incentives", displayDate: "x", sortDate: "2026-07-27", hasExactDate: true },
		{ title: "Battery comparison post", description: "d", url: "/blog/e/", category: "Battery Comparisons", displayDate: "x", sortDate: "2026-07-27", hasExactDate: false },
		{ title: "Battery economics post", description: "d", url: "/blog/f/", category: "Battery Economics", displayDate: "x", sortDate: "2026-07-20", hasExactDate: false },
	];
}

test("relatedPostsForUtility returns the direct category match first", () => {
	const posts = makePosts();
	const related = relatedPostsForUtility(posts, "PG&E");
	assert.ok(related.some((p) => p.url === "/blog/a/"));
});

test("relatedPostsForUtility fills remaining slots with fallback categories when direct matches are fewer than the limit", () => {
	const posts = makePosts();
	const related = relatedPostsForUtility(posts, "PG&E", 3);
	assert.equal(related.length, 3);
	assert.equal(related[0].url, "/blog/a/");
	// The other 2 slots come from fallback categories (Incentives, Battery
	// Comparisons, Battery Economics), never from an unrelated direct
	// category like SCE or SDG&E.
	assert.ok(!related.some((p) => p.category === "SCE" || p.category === "SDG&E"));
});

test("relatedPostsForUtility never duplicates a post that's both a direct and fallback match", () => {
	const posts = makePosts();
	const related = relatedPostsForUtility(posts, "PG&E", 10);
	const urls = related.map((p) => p.url);
	assert.equal(new Set(urls).size, urls.length);
});

test("relatedPostsForUtility falls back entirely to general categories for a utility with no direct match (e.g. a municipal utility)", () => {
	const posts = makePosts();
	const related = relatedPostsForUtility(posts, "Pasadena Water and Power", 3);
	assert.equal(related.length, 3);
	assert.ok(related.every((p) => ["Incentives", "Battery Comparisons", "Battery Economics"].includes(p.category)));
});

test("relatedPostsForUtility handles a null utility short name without crashing", () => {
	const posts = makePosts();
	assert.doesNotThrow(() => relatedPostsForUtility(posts, null));
	const related = relatedPostsForUtility(posts, null, 2);
	assert.equal(related.length, 2);
});

test("relatedPostsForUtility respects the limit parameter", () => {
	const posts = makePosts();
	const related = relatedPostsForUtility(posts, "PG&E", 1);
	assert.equal(related.length, 1);
	assert.equal(related[0].url, "/blog/a/");
});
