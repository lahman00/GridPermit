// Single source of truth for "all blog posts" — used by both
// src/pages/blog/index.astro (the blog index) and
// src/layouts/LocalityGuideLayout.astro ("Related articles" on each locality
// page), so the two never maintain independent copies of the same post list
// or category assignments.
import { getCollection } from "astro:content";

export interface PostSummary {
	title: string;
	description: string;
	url: string;
	category: string;
	displayDate: string;
	sortDate: string; // ISO date used only for ordering, not necessarily rendered verbatim
	// True only for posts with a real, exact pubDate from their own
	// frontmatter — the 3 standalone posts state only "Updated July 2026"
	// (no day), so BlogPosting JSON-LD (which requires datePublished) is
	// only ever emitted for posts where this is true.
	hasExactDate: boolean;
}

// Editorial category labels keyed by each markdown post's own
// content-collection id — grouping existing posts by the utility/topic
// already stated in their own title, not adding a new claim.
const CATEGORY_BY_ID: Record<string, string> = {
	"pge-nem3-calculator": "PG&E",
	"sce-guide": "SCE",
	"sdge-guide": "SDG&E",
	"sgip-battery-rebates-california": "Incentives",
	"tesla-powerwall-3-vs-enphase-iq5p": "Battery Comparisons",
};

// The 3 standalone .astro posts under src/pages/blog/ aren't part of the
// content collection, so their metadata is listed here verbatim from what's
// already on each page (title, description, and "Updated July 2026" — no
// specific day is stated on those pages, so none is invented here either).
const STANDALONE_POSTS: PostSummary[] = [
	{
		title: "PG&E Rate Hike Audit 2026: Solar & Battery Protection Analysis",
		description: "Analysis of Pacific Gas & Electric (PG&E) electricity rate increases and how home battery storage offsets E-ELEC peak pricing.",
		url: "/blog/pge-rate-hikes-2026/",
		category: "PG&E",
		displayDate: "July 2026",
		sortDate: "2026-07-20",
		hasExactDate: false,
	},
	{
		title: "SDG&E Battery Storage ROI Guide 2026: Rates & Economics",
		description: "San Diego Gas & Electric (SDG&E) battery payback breakdown under NEM 3.0 rules and EV-TOU-5 rate schedules.",
		url: "/blog/sdge-battery-roi-guide/",
		category: "SDG&E",
		displayDate: "July 2026",
		sortDate: "2026-07-20",
		hasExactDate: false,
	},
	{
		title: "California NEM 3.0 Solar & Battery Payback Guide (2026 Audit)",
		description: "Comprehensive guide to California Net Billing Tariff (NEM 3.0), avoided cost rates, TOU arbitrage, and battery ROI.",
		url: "/blog/solar-battery-payback-nem3/",
		category: "Battery Economics",
		displayDate: "July 2026",
		sortDate: "2026-07-20",
		hasExactDate: false,
	},
];

export async function getAllBlogPosts(): Promise<PostSummary[]> {
	const collectionPosts = await getCollection("blog");
	const fromCollection: PostSummary[] = collectionPosts.map((post) => ({
		title: post.data.title,
		description: post.data.description,
		url: `/blog/${post.id}/`,
		category: CATEGORY_BY_ID[post.id] ?? "General",
		displayDate: post.data.pubDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
		sortDate: post.data.pubDate.toISOString(),
		hasExactDate: true,
	}));

	return [...fromCollection, ...STANDALONE_POSTS].sort(
		(a, b) => new Date(b.sortDate).valueOf() - new Date(a.sortDate).valueOf(),
	);
}

// Re-exported for convenience so callers only need one import path; the
// implementation lives in related-posts.ts (no astro:content dependency,
// so it stays unit-testable with plain node:test).
export { relatedPostsForUtility } from "./related-posts";
