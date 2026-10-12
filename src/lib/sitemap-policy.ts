import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { citySlug, guideUrlForCitySlug, type LocalityRecord } from "./locality-guide.ts";
import { STATE_META, SUPPORTED_STATE_CODES } from "./state-meta.ts";

interface EvaluationRecord {
	record_id: string;
	readiness: string;
}

export interface SitemapPolicy {
	emptyStatePaths: Set<string>;
	lastmodByPath: Map<string, string>;
}

export function stateHubRobotsDirective(publishedGuideCount: number): string | null {
	return publishedGuideCount > 0 ? null : "noindex, follow";
}

function isoDate(value: unknown): string | null {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	const parsed = new Date(`${value}T00:00:00.000Z`);
	return Number.isNaN(parsed.valueOf()) ? null : value;
}

function laterDate(current: string | undefined, candidate: string): string {
	return !current || candidate > current ? candidate : current;
}

function readJson(filePath: string): unknown {
	return JSON.parse(readFileSync(filePath, "utf8"));
}

/**
 * Build sitemap exclusions and modification dates from canonical source data.
 * No build timestamp is used: routes without a source-backed date simply omit
 * lastmod rather than publishing a date that does not describe content change.
 */
export function buildSitemapPolicy(repoRoot: string): SitemapPolicy {
	const localityDir = path.join(repoRoot, "data", "localities");
	const outputDir = path.join(repoRoot, "output");
	const blogDir = path.join(repoRoot, "src", "content", "blog");

	const recordsById = new Map<string, LocalityRecord>();
	for (const filename of readdirSync(localityDir).filter((name) => name.endsWith(".json"))) {
		const record = readJson(path.join(localityDir, filename)) as LocalityRecord;
		recordsById.set(record.record_id, record);
	}

	const readyIds = new Set<string>();
	for (const filename of readdirSync(outputDir).filter((name) => name.endsWith("-evaluation.json"))) {
		const report = readJson(path.join(outputDir, filename)) as { records?: EvaluationRecord[] };
		for (const evaluation of report.records ?? []) {
			if (evaluation.readiness === "READY") readyIds.add(evaluation.record_id);
		}
	}

	const routeDates = new Map<string, string>();
	const latestByState = new Map<string, string>();
	let latestLocalityDate: string | undefined;

	for (const recordId of readyIds) {
		const record = recordsById.get(recordId);
		const verified = isoDate(record?.last_verified);
		if (!record || !verified) continue;
		const guidePath = guideUrlForCitySlug(record.state, citySlug(record.city.value));
		routeDates.set(guidePath, verified);
		latestByState.set(record.state, laterDate(latestByState.get(record.state), verified));
		latestLocalityDate = laterDate(latestLocalityDate, verified);
	}

	for (const [stateCode, lastmod] of latestByState) {
		const statePath = stateCode === "CA" ? "/california/" : `/${STATE_META[stateCode].slug}/`;
		routeDates.set(statePath, lastmod);
		if (stateCode === "CA") {
			routeDates.set("/california/solar-permit-guides/", lastmod);
			routeDates.set("/california/solar-permit-timeline/", lastmod);
		}
	}
	if (latestLocalityDate) routeDates.set("/permits/", latestLocalityDate);

	let latestBlogDate: string | undefined;
	for (const filename of readdirSync(blogDir).filter((name) => /\.mdx?$/.test(name))) {
		const source = readFileSync(path.join(blogDir, filename), "utf8");
		const frontmatter = source.match(/^---\s*\n([\s\S]*?)\n---/)?.[1] ?? "";
		const published = isoDate(frontmatter.match(/^pubDate:\s*["']?(\d{4}-\d{2}-\d{2})/m)?.[1]);
		const updated = isoDate(frontmatter.match(/^updatedDate:\s*["']?(\d{4}-\d{2}-\d{2})/m)?.[1]);
		const lastmod = updated ?? published;
		if (!lastmod) continue;
		const slug = filename.replace(/\.mdx?$/, "");
		routeDates.set(`/blog/${slug}/`, lastmod);
		latestBlogDate = laterDate(latestBlogDate, lastmod);
	}
	if (latestBlogDate) routeDates.set("/blog/", latestBlogDate);

	const emptyStatePaths = new Set(
		SUPPORTED_STATE_CODES
			.filter((code) => code !== "CA" && !latestByState.has(code))
			.map((code) => `/${STATE_META[code].slug}/`),
	);
	const lastmodByPath = new Map(routeDates);

	return { emptyStatePaths, lastmodByPath };
}

export function sitemapPathname(url: string): string {
	return new URL(url, "https://mygridpermit.com").pathname;
}
