// Pure, build-time search index construction + client-reusable matching
// logic for the site search (src/pages/search.astro). No astro:content
// dependency here — callers pass in already-computed locality/blog post
// lists, so this stays unit-testable with plain node:test.
import type { LocalityIndexEntry } from "./locality-guide";
import type { PostSummary } from "./blog-posts";

export interface SearchEntry {
	title: string;
	description: string;
	url: string;
	category: string;
}

// Static pages worth surfacing in search that aren't generated from any
// data file — titles/descriptions copied verbatim from each page's own
// existing <title>/description meta, not invented here.
const STATIC_PAGES: SearchEntry[] = [
	{
		title: "GridPermit — California Solar & Battery Savings Estimator",
		description: "An educational, California-only starting point for home solar and battery payback questions.",
		url: "/",
		category: "Page",
	},
	{
		title: "California Solar Permit Guide",
		description: "How California residential solar permitting works: permit vs. interconnection, SolarAPP+, inspections, and batteries.",
		url: "/california/",
		category: "Guide",
	},
	{
		title: "Calculation Methodology",
		description: "An exact, honest description of what GridPermit's California solar and battery estimator does and doesn't calculate today.",
		url: "/methodology/",
		category: "Page",
	},
	{
		title: "How It Works",
		description: "Learn how GridPermit's California-only solar and battery estimator works in three simple steps.",
		url: "/how-it-works/",
		category: "Page",
	},
	{
		title: "About GridPermit",
		description: "Learn about GridPermit, an independent educational resource for California residential solar and battery storage decisions.",
		url: "/about/",
		category: "Page",
	},
];

export function buildSearchIndex(params: {
	localityEntries: LocalityIndexEntry[];
	blogPosts: PostSummary[];
}): SearchEntry[] {
	const entries: SearchEntry[] = [...STATIC_PAGES];

	entries.push({
		title: "California Solar Permit Guides",
		description: "Index of every verified California city solar permit guide that clears GridPermit's READY threshold.",
		url: "/california/solar-permit-guides/",
		category: "Guide",
	});

	for (const e of params.localityEntries) {
		entries.push({
			title: `${e.city} Solar Permit Guide`,
			description: e.generationSupplierName ? `${e.utility} · ${e.generationSupplierName}` : e.utility,
			url: e.guideUrl,
			category: "California Guide",
		});
	}

	entries.push({
		title: "Solar & Battery Guides Blog",
		description: "California-focused solar, battery, and utility rate guides.",
		url: "/blog/",
		category: "Page",
	});

	for (const p of params.blogPosts) {
		entries.push({
			title: p.title,
			description: p.description,
			url: p.url,
			category: `Blog · ${p.category}`,
		});
	}

	return entries;
}

// Deterministic relevance rank for a match — lower is more relevant. A
// query matching the title outranks one that only matches the description,
// so typing a city or page name surfaces that exact result first instead of
// wherever it happens to sit in the index's build order.
function matchRank(entry: SearchEntry, q: string): number {
	const title = entry.title.toLowerCase();
	if (title === q) return 0;
	if (title.startsWith(q)) return 1;
	if (title.includes(q)) return 2;
	if (entry.category.toLowerCase().includes(q)) return 3;
	return 4; // matched only in the description
}

// Instant, client-side substring match across title/description/category —
// no external search service, no network request. Results are ranked by
// relevance (see matchRank); ties keep their original index-build order via
// a stable sort, so results are fully deterministic for a given query.
export function searchEntries(entries: SearchEntry[], query: string): SearchEntry[] {
	const q = query.trim().toLowerCase();
	if (!q) return [];
	return entries
		.map((entry, index) => ({ entry, index }))
		.filter(({ entry }) => `${entry.title} ${entry.description} ${entry.category}`.toLowerCase().includes(q))
		.sort((a, b) => {
			const rankDiff = matchRank(a.entry, q) - matchRank(b.entry, q);
			return rankDiff !== 0 ? rankDiff : a.index - b.index;
		})
		.map(({ entry }) => entry);
}
