// Balanced "related cities" selection for locality guides.
//
// The existing buildRelatedLocalities ranks same-county > same-utility >
// same-supplier and breaks ties by city name, then keeps the first six. In a
// county with more than six other cities that is a fixed alphabetical cut: the
// first few cities in the alphabet are linked from every sibling guide and the
// rest from none. In the production link graph (52c6fd1) the locality-to-locality
// inbound count correlates with alphabetical rank at -0.6 to -0.9 in every
// county of nine or more cities, and 181 of 351 guides receive no link from any
// sibling guide.
//
// This keeps the same relevance classes and the same bound, and only changes
// the tie-break inside a class: prefer the candidate that has been linked least
// so far, then city name. It is deterministic (fixed processing order, fixed
// tie-break), never links across states, never exceeds the limit, and never
// links a page to itself. It applies only to counties a human listed in the
// registry; every other page keeps the existing function untouched. Pages
// inside an experiment or observation window keep their existing list, so
// their measurement is not disturbed, but their legacy links still count
// toward the balance.

import { buildRelatedLocalities, type LocalityIndexEntry, type RelatedLocalityEntry } from "./locality-guide.ts";
import { QUICK_ANSWER_PILOTS } from "./quick-answer-pilots.ts";
import { COMMERCIAL_SEO_PROFILES } from "./commercial-seo-profiles.ts";
import { PERMIT_PATHWAY_RECORD_IDS } from "./permit-pathway-answer.ts";

const RELATION_RANK = { county: 0, utility: 1, supplier: 2 } as const;

export interface BalancedRelatedConfig {
	state: string; // USPS code, e.g. "CA"
	counties: string[]; // exact record county values, e.g. "Santa Clara County"
	limit: number;
	max_pages: number;
	pages: string[]; // guide URLs in scope, listed explicitly so a reviewer sees the blast radius
}

// Record ids whose own page content must not change while a measurement runs.
export function observationLockedRecordIds(entries: LocalityIndexEntry[], contentLinkLocalityPages: string[]): Set<string> {
	const locked = new Set<string>();
	for (const p of QUICK_ANSWER_PILOTS.values()) locked.add(p.recordId);
	for (const id of COMMERCIAL_SEO_PROFILES.keys()) locked.add(id);
	for (const id of PERMIT_PATHWAY_RECORD_IDS) locked.add(id);
	const rolled = new Set(contentLinkLocalityPages);
	for (const e of entries) if (rolled.has(e.guideUrl)) locked.add(e.recordId);
	return locked;
}

export function balancedRelatedMap(
	entries: LocalityIndexEntry[],
	opts: { state: string; counties: string[]; limit: number; lockedRecordIds: Set<string> },
): Map<string, RelatedLocalityEntry[]> {
	const out = new Map<string, RelatedLocalityEntry[]>();
	for (const county of [...opts.counties].sort()) {
		const members = entries
			.filter((e) => e.state === opts.state && e.county === county)
			.sort((a, b) => a.city.localeCompare(b.city) || a.recordId.localeCompare(b.recordId));
		const inbound = new Map(members.map((m) => [m.recordId, 0]));
		const count = (list: RelatedLocalityEntry[]) => {
			for (const r of list) if (inbound.has(r.recordId)) inbound.set(r.recordId, (inbound.get(r.recordId) ?? 0) + 1);
		};
		// Locked pages keep the existing list, and it counts toward the balance.
		// (Their links to other locked pages are part of that fixed list.)
		for (const m of members) {
			if (!opts.lockedRecordIds.has(m.recordId)) continue;
			const legacy = buildRelatedLocalities(m, entries, opts.limit);
			out.set(m.recordId, legacy);
			count(legacy);
		}
		for (const m of members) {
			if (opts.lockedRecordIds.has(m.recordId)) continue;
			const all = buildRelatedLocalities(m, entries, Infinity);
			// A page under measurement must see exactly the inbound links it has today:
			// a donor keeps the links it already gives to locked pages, never adds one,
			// and the balance is computed among the unlocked pages only.
			const legacyIds = new Set(buildRelatedLocalities(m, entries, opts.limit).map((r) => r.recordId));
			const pinned = all.filter((r) => opts.lockedRecordIds.has(r.recordId) && legacyIds.has(r.recordId));
			const free = all.filter((r) => !opts.lockedRecordIds.has(r.recordId));
			const rank = (a: RelatedLocalityEntry, b: RelatedLocalityEntry) => RELATION_RANK[a.relation] - RELATION_RANK[b.relation];
			const chosen = free
				.slice()
				.sort((a, b) => rank(a, b) || (inbound.get(a.recordId) ?? 0) - (inbound.get(b.recordId) ?? 0) || a.city.localeCompare(b.city) || a.recordId.localeCompare(b.recordId))
				.slice(0, Math.max(0, opts.limit - pinned.length));
			// Display order matches the existing list: relation class, then city name.
			const picked = [...pinned, ...chosen].sort((a, b) => rank(a, b) || a.city.localeCompare(b.city) || a.recordId.localeCompare(b.recordId));
			out.set(m.recordId, picked);
			count(picked);
		}
	}
	return out;
}

// What a locality page should show: the balanced list when its county is in
// scope, otherwise exactly what the existing function returns.
export function relatedForPage(
	current: LocalityIndexEntry,
	entries: LocalityIndexEntry[],
	config: BalancedRelatedConfig | undefined,
	lockedRecordIds: Set<string>,
): RelatedLocalityEntry[] {
	const legacy = () => buildRelatedLocalities(current, entries, config?.limit ?? 6);
	if (!config || current.state !== config.state || !current.county || !config.counties.includes(current.county)) return legacy();
	return balancedRelatedMap(entries, { state: config.state, counties: config.counties, limit: config.limit, lockedRecordIds }).get(current.recordId) ?? legacy();
}
