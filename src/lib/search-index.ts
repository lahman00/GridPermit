// Pure, build-time search index construction + client-reusable matching
// logic for the site search (src/pages/search.astro). No astro:content
// dependency here — callers pass in already-computed locality/blog post
// lists, so this stays unit-testable with plain node:test.
import type { LocalityIndexEntry } from "./locality-guide";
import type { PostSummary } from "./blog-posts";
import type { CountyHubData } from "./county-hub";
import type { UtilityHubData } from "./utility-hub";

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
		title: "How Long Does a California Solar Permit Take?",
		description: "Verified review-timeline data from California cities: which offer same-day SolarAPP+ review, and typical standard-path ranges.",
		url: "/california/solar-permit-timeline/",
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
	// Optional: only county/utility groupings that already cleared the
	// genuine-value threshold (see county-hub.ts/utility-hub.ts) get their
	// own hub page, so only those are indexed here — a county or utility
	// with no hub page has nothing to link a search result to.
	countyHubs?: CountyHubData[];
	utilityHubs?: UtilityHubData[];
}): SearchEntry[] {
	const entries: SearchEntry[] = [...STATIC_PAGES];

	entries.push({
		title: "California Solar Permit Guides",
		description: "Index of every verified California city solar permit guide that clears GridPermit's READY threshold.",
		url: "/california/solar-permit-guides/",
		category: "Guide",
	});

	for (const e of params.localityEntries) {
		// State is in the title itself (not just the description) so two
		// same-named cities in different states (e.g. Newark, CA vs Newark,
		// DE) are always distinguishable at a glance in search results — see
		// docs/DATA_ARCHITECTURE.md's multi-state section. County is folded
		// into the description so a query for a county name — one of the
		// terms this index is explicitly stress-tested against — surfaces
		// every city in it, not just a city whose own name happens to match.
		const descriptionParts = [e.utility, e.generationSupplierName, e.county ? `${e.county}` : null].filter(
			(part): part is string => Boolean(part),
		);
		entries.push({
			title: `${e.city}, ${e.state} Solar Permit Guide`,
			description: descriptionParts.join(" · "),
			url: e.guideUrl,
			category: `${e.stateName} Guide`,
		});
	}

	for (const hub of params.countyHubs ?? []) {
		entries.push({
			title: `${hub.county}, ${hub.state} Solar Permit Guides`,
			description: `${hub.cities.length} verified ${hub.cities.length === 1 ? "city" : "cities"} in ${hub.county}, ${hub.stateName}: ${hub.cities.map((c) => c.city).join(", ")}.`,
			url: `/${hub.stateSlug}/county/${hub.countySlug}/`,
			category: "County",
		});
	}

	for (const hub of params.utilityHubs ?? []) {
		entries.push({
			title: `${hub.utilityShort} Solar Permit Guides (${hub.state})`,
			description: `${hub.cities.length} verified ${hub.cities.length === 1 ? "city" : "cities"} served by ${hub.utilityShort} in ${hub.stateName}: ${hub.cities.map((c) => c.city).join(", ")}.`,
			url: `/${hub.stateSlug}/utility/${hub.utilitySlug}/`,
			category: "Utility",
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
