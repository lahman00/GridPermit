// Pure post-matching logic, split out from src/lib/blog-posts.ts so it has
// no dependency on the astro:content virtual module — that keeps this
// function testable with plain node:test (astro:content only resolves
// inside Astro's own build/dev pipeline).
import type { PostSummary } from "./blog-posts";

// Picks posts relevant to a locality page's own utility short name (e.g.
// "PG&E") by exact category match. Falls back to the next-most-relevant
// general categories (Incentives, Battery Comparisons/Economics) when the
// utility has no directly-matching post — e.g. a municipal utility like
// Pasadena Water and Power has no dedicated post, so it still gets useful,
// real related reading rather than nothing.
const FALLBACK_CATEGORIES = ["Incentives", "Battery Comparisons", "Battery Economics"];

export function relatedPostsForUtility(
	posts: PostSummary[],
	utilityShortName: string | null,
	limit: number = 3,
): PostSummary[] {
	const direct = utilityShortName ? posts.filter((p) => p.category === utilityShortName) : [];
	if (direct.length >= limit) return direct.slice(0, limit);

	const fallback = posts.filter(
		(p) => FALLBACK_CATEGORIES.includes(p.category) && !direct.some((d) => d.url === p.url),
	);
	return [...direct, ...fallback].slice(0, limit);
}
