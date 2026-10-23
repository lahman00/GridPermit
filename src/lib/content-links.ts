// Deterministic, evidence-gated internal linking from location and utility
// pages to existing permit / interconnection / PTO articles (and back).
//
// Design rules:
//  - Pure functions over data/content-links/registry.json: no I/O, no randomness,
//    no dependency on astro:content (so plain node:test can exercise it).
//  - A resource is shown only when the page's own facts (state, utility short
//    name, city slug, record flag) satisfy the resource's declared scope. A
//    general resource declares an empty scope. Geography is never inferred.
//  - Pages are opt-in via `rollout`; an unlisted page gets no links, so
//    experiment pages (quick-answer pilots, commercial SEO profiles) are
//    untouched unless someone deliberately lists them.
//  - Anchor text is the article's own title (site-name suffix removed). The reason line comes
//    from a fixed table keyed by relation, never free-form text.
//  - Fail closed: a resource whose article is missing is dropped, never
//    rendered as a dead link.

import { citySlug } from "./locality-guide.ts";

export type ResourceRelation = "city" | "utility" | "record_topic" | "general";
export type ResourcePlacement = "utility_card" | "permit_card";

export interface ResourceScope {
	states?: string[];
	utilities?: string[];
	cities?: Array<{ state: string; slug: string }>;
	record_flag?: string;
}

export interface ContentResource {
	id: string;
	url: string;
	kind: string;
	relation: ResourceRelation;
	placement: ResourcePlacement;
	scope: ResourceScope;
	evidence: string;
}

export interface ContentLinkRegistry {
	schema_version: number;
	resources: ContentResource[];
	balanced_related?: {
		state: string;
		counties: string[];
		limit: number;
		max_pages: number;
		pages: string[];
		control_pages?: string[];
	};
	rollout: {
		max_locality_pages: number;
		locality_pages: string[];
		utility_hubs: string[];
		articles: string[];
	};
}

export interface ArticleRef {
	url: string;
	title: string;
}

export interface PageFacts {
	url: string;
	state: string;
	utility: string | null; // short name, e.g. "PG&E"
	citySlug: string | null;
	flags?: string[]; // record-derived flags, e.g. "solarapp_pathway"
}

export interface ResolvedLink {
	id: string;
	href: string;
	anchor: string;
	reason: string;
	kind: string;
	relation: ResourceRelation;
	placement: ResourcePlacement;
}

export const MAX_LINKS_PER_PAGE = 3;
export const MAX_BACKLINK_PAGES = 4;

const RELATION_RANK: Record<ResourceRelation, number> = { city: 0, utility: 1, record_topic: 2, general: 3 };

function reasonFor(resource: ContentResource, facts: PageFacts): string {
	if (resource.relation === "city") return "Written for this city's permit review";
	if (resource.relation === "utility") return `About ${facts.utility ?? "this"} interconnection and permission to operate`;
	if (resource.relation === "record_topic") return "Relevant to the permit pathway listed in this guide";
	return "How the city permit, inspection and utility PTO differ";
}

export function recordFlags(input: {
	pathway?: string | null;
	documentNames?: string[];
	conditions?: string[];
}): string[] {
	const flags: string[] = [];
	const hay = [input.pathway ?? "", ...(input.documentNames ?? []), ...(input.conditions ?? [])];
	// A mention only counts when it is not negated ("non-SolarAPP+ pathway",
	// "not adopted SolarAPP+"): the flag claims the record lists this pathway.
	const negated = /\b(?:non[- ]|not\b|without\b|no\b)[^.;]{0,40}solarapp|solarapp\+?\s+(?:is |was |has |are )?(?:not|n't)\b/i;
	if (hay.some((s) => /solarapp/i.test(s) && !negated.test(s))) flags.push("solarapp_pathway");
	return flags;
}

export function scopeMatches(resource: ContentResource, facts: PageFacts): boolean {
	const s = resource.scope;
	if (s.states && !s.states.includes(facts.state)) return false;
	if (s.utilities && (facts.utility === null || !s.utilities.includes(facts.utility))) return false;
	if (s.cities && !s.cities.some((c) => c.state === facts.state && c.slug === facts.citySlug)) return false;
	if (s.record_flag && !(facts.flags ?? []).includes(s.record_flag)) return false;
	return true;
}

// The article's own title with only the trailing site-name suffix removed
// (titles are written "<headline> | GridPermit" for the <title> tag).
export function anchorFromTitle(title: string): string {
	return title.replace(/\s*\|\s*GridPermit\s*$/, "").trim();
}

function postIndex(posts: ArticleRef[]): Map<string, ArticleRef> {
	return new Map(posts.map((p) => [p.url, p]));
}

// Shared selector. `placements` limits which cards a caller renders into;
// `exclude` is the set of hrefs the page already links elsewhere, so the same
// target never appears twice on one page.
export function selectResources(
	registry: ContentLinkRegistry,
	posts: ArticleRef[],
	facts: PageFacts,
	opts: { placements?: ResourcePlacement[]; exclude?: string[]; limit?: number } = {},
): ResolvedLink[] {
	const index = postIndex(posts);
	const exclude = new Set([facts.url, ...(opts.exclude ?? [])]);
	const placements = opts.placements ?? ["utility_card", "permit_card"];
	const out: ResolvedLink[] = [];
	const ranked = registry.resources
		.filter((r) => placements.includes(r.placement) && scopeMatches(r, facts))
		.sort((a, b) => RELATION_RANK[a.relation] - RELATION_RANK[b.relation] || a.id.localeCompare(b.id));
	const seen = new Set<string>();
	for (const r of ranked) {
		const post = index.get(r.url);
		if (!post || exclude.has(r.url) || seen.has(r.url)) continue;
		seen.add(r.url);
		out.push({
			id: r.id,
			href: r.url,
			anchor: anchorFromTitle(post.title),
			reason: reasonFor(r, facts),
			kind: r.kind,
			relation: r.relation,
			placement: r.placement,
		});
		if (out.length >= (opts.limit ?? MAX_LINKS_PER_PAGE)) break;
	}
	return out;
}

export function isRolloutLocality(registry: ContentLinkRegistry, url: string): boolean {
	return registry.rollout.locality_pages.includes(url);
}

export function isRolloutHub(registry: ContentLinkRegistry, url: string): boolean {
	return registry.rollout.utility_hubs.includes(url);
}

export function isRolloutArticle(registry: ContentLinkRegistry, url: string): boolean {
	return registry.rollout.articles.includes(url);
}

// Links for a rolled-out locality guide. Empty for any page not in rollout.
export function selectLocalityResources(
	registry: ContentLinkRegistry,
	posts: ArticleRef[],
	facts: PageFacts,
	exclude: string[] = [],
): ResolvedLink[] {
	if (!isRolloutLocality(registry, facts.url)) return [];
	return selectResources(registry, posts, facts, { exclude });
}

// Links for a rolled-out utility hub: only resources whose scope the hub's own
// utility satisfies. City- and record-scoped resources can never match a hub.
export function selectHubResources(
	registry: ContentLinkRegistry,
	posts: ArticleRef[],
	hub: { url: string; state: string; utility: string },
): ResolvedLink[] {
	if (!isRolloutHub(registry, hub.url)) return [];
	const facts: PageFacts = { url: hub.url, state: hub.state, utility: hub.utility, citySlug: null, flags: [] };
	// citySlug is null and flags are empty, so only utility and general
	// resources can match a hub.
	return selectResources(registry, posts, facts, { limit: MAX_LINKS_PER_PAGE + 1 });
}

export interface HubFacts {
	url: string;
	state: string;
	utility: string;
	label: string;
}

// Rolled-out utility hubs, derived from the registry itself (hub URL slug +
// the utility names resources declare), so adding a hub to the rollout needs no
// layout edit. A hub whose slug matches no declared utility is skipped.
export function rolloutHubFacts(registry: ContentLinkRegistry): HubFacts[] {
	const out: HubFacts[] = [];
	for (const url of registry.rollout.utility_hubs) {
		const slug = url.match(/^\/[a-z-]+\/utility\/([a-z0-9-]+)\/$/)?.[1];
		if (!slug) continue;
		for (const r of registry.resources) {
			const utility = (r.scope.utilities ?? []).find((u) => citySlug(u) === slug);
			const state = r.scope.states?.[0];
			if (utility && state) {
				out.push({ url, state, utility, label: `${utility} solar permit cities` });
				break;
			}
		}
	}
	return out;
}

export interface BacklinkTarget {
	href: string;
	label: string;
	kind: "utility_hub" | "locality_guide";
}

// Where an article is used: rolled-out hubs and locality guides whose own
// facts satisfy the same scope that links the article from them. Derived from
// the same registry, so a back-link never points at a page that would not link
// forward. Locality back-links are capped (alphabetical, MAX_BACKLINK_PAGES),
// so this direction is a subset of the forward links, not a mirror.
export function selectArticleBacklinks(
	registry: ContentLinkRegistry,
	articleUrl: string,
	hubs: Array<{ url: string; state: string; utility: string; label: string }>,
	localities: Array<PageFacts & { label: string }>,
): BacklinkTarget[] {
	if (!isRolloutArticle(registry, articleUrl)) return [];
	const resources = registry.resources.filter((r) => r.url === articleUrl);
	if (resources.length === 0) return [];
	const targets: BacklinkTarget[] = [];

	for (const hub of hubs.slice().sort((a, b) => a.url.localeCompare(b.url))) {
		if (!isRolloutHub(registry, hub.url)) continue;
		const facts: PageFacts = { url: hub.url, state: hub.state, utility: hub.utility, citySlug: null, flags: [] };
		if (resources.some((r) => (r.relation === "utility" || r.relation === "general") && scopeMatches(r, facts))) {
			targets.push({ href: hub.url, label: hub.label, kind: "utility_hub" });
		}
	}

	const matched = localities
		.filter((l) => isRolloutLocality(registry, l.url))
		.filter((l) => resources.some((r) => r.relation === "utility" && scopeMatches(r, l)))
		.sort((a, b) => a.label.localeCompare(b.label))
		.slice(0, MAX_BACKLINK_PAGES);
	for (const l of matched) targets.push({ href: l.url, label: l.label, kind: "locality_guide" });
	return targets;
}

export interface RegistryProblem {
	id: string;
	problem: string;
}

// Structural validation used by tests and the QA script. Checks only what the
// registry can verify itself; whether an article's body really matches its
// declared scope is checked by tests against the article files.
export function validateRegistry(registry: ContentLinkRegistry, knownPostUrls: string[]): RegistryProblem[] {
	const problems: RegistryProblem[] = [];
	const ids = new Set<string>();
	const urls = new Set(knownPostUrls);
	for (const r of registry.resources) {
		if (ids.has(r.id)) problems.push({ id: r.id, problem: "duplicate id" });
		ids.add(r.id);
		if (!urls.has(r.url)) problems.push({ id: r.id, problem: `article not found: ${r.url}` });
		if (!r.evidence || r.evidence.length < 20) problems.push({ id: r.id, problem: "missing evidence note" });
		const hasScope = Object.keys(r.scope).length > 0;
		if (r.relation === "general" && hasScope) problems.push({ id: r.id, problem: "general resource must have empty scope" });
		if (r.relation !== "general" && !hasScope) problems.push({ id: r.id, problem: "scoped relation needs a scope" });
		if (r.relation === "utility" && !(r.scope.utilities && r.scope.utilities.length)) {
			problems.push({ id: r.id, problem: "utility relation needs scope.utilities" });
		}
		if (r.relation === "city" && !(r.scope.cities && r.scope.cities.length)) {
			problems.push({ id: r.id, problem: "city relation needs scope.cities" });
		}
		if (r.relation === "record_topic" && !r.scope.record_flag) {
			problems.push({ id: r.id, problem: "record_topic relation needs scope.record_flag" });
		}
	}
	const { rollout } = registry;
	if (rollout.locality_pages.length > rollout.max_locality_pages) {
		problems.push({ id: "rollout", problem: "locality_pages exceeds max_locality_pages" });
	}
	for (const list of [rollout.locality_pages, rollout.utility_hubs, rollout.articles]) {
		if (new Set(list).size !== list.length) problems.push({ id: "rollout", problem: "duplicate rollout entry" });
	}
	const br = registry.balanced_related;
	if (br) {
		if (br.pages.length > br.max_pages) problems.push({ id: "balanced_related", problem: "pages exceeds max_pages" });
		if (new Set(br.pages).size !== br.pages.length) problems.push({ id: "balanced_related", problem: "duplicate page" });
		if (!Number.isInteger(br.limit) || br.limit < 1 || br.limit > 6) problems.push({ id: "balanced_related", problem: "limit must be 1..6" });
		if (br.counties.length === 0) problems.push({ id: "balanced_related", problem: "no counties" });
		const control = br.control_pages ?? [];
		if (control.some((c) => br.pages.includes(c))) problems.push({ id: "balanced_related", problem: "control page is also in scope" });
	}
	for (const a of rollout.articles) {
		if (!urls.has(a)) problems.push({ id: "rollout", problem: `rollout article not found: ${a}` });
	}
	return problems;
}
