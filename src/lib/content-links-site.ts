// Astro-side glue for the content-link engine (src/lib/content-links.ts):
// loads the registry, derives a page's facts from its own locality record,
// and resolves the rolled-out locality pages for article back-links. Kept out
// of content-links.ts so that module stays free of import.meta.glob and
// remains testable with plain node:test.
import registryJson from "../../data/content-links/registry.json";
import { recordFlags, type ContentLinkRegistry, type PageFacts } from "./content-links.ts";
import { citySlug, guideUrlForCitySlug, utilityShortName, type LocalityRecord } from "./locality-guide.ts";

export const contentLinkRegistry = registryJson as ContentLinkRegistry;

export function localityFacts(record: LocalityRecord, pagePath: string): PageFacts {
	return {
		url: pagePath,
		state: record.state,
		utility: utilityShortName(record.utility.value),
		citySlug: citySlug(record.city.value),
		flags: recordFlags({
			pathway: record.eligibility_constraints.value?.program_or_pathway ?? null,
			documentNames: (record.required_documents.value ?? []).map((d) => d.name),
			conditions: record.eligibility_constraints.value?.other_conditions ?? [],
		}),
	};
}

// Facts for every rolled-out locality guide (used only by article back-links).
export function rolloutLocalityFacts(): Array<PageFacts & { label: string }> {
	const modules = import.meta.glob("../../data/localities/*.json", { eager: true }) as Record<
		string,
		{ default: LocalityRecord }
	>;
	const wanted = new Set(contentLinkRegistry.rollout.locality_pages);
	const out: Array<PageFacts & { label: string }> = [];
	for (const mod of Object.values(modules)) {
		const record = mod.default;
		const url = guideUrlForCitySlug(record.state, citySlug(record.city.value));
		if (!wanted.has(url)) continue;
		out.push({ ...localityFacts(record, url), label: record.city.value });
	}
	return out;
}
