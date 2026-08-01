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
		description: "Index of every verified California city solar permit guide that passed GridPermit's pilot readiness review.",
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

// Instant, client-side substring match across title/description/category —
// no external search service, no network request.
export function searchEntries(entries: SearchEntry[], query: string): SearchEntry[] {
	const q = query.trim().toLowerCase();
	if (!q) return [];
	return entries.filter((e) => `${e.title} ${e.description} ${e.category}`.toLowerCase().includes(q));
}
