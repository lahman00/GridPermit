#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_CONTRACT_PATH = path.join(
	REPO_ROOT,
	"data",
	"production-contract",
	"compare-solar-cta.json",
);

export async function loadContract(contractPath = DEFAULT_CONTRACT_PATH) {
	return JSON.parse(await readFile(contractPath, "utf8"));
}

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

function unique(values) {
	return new Set(values).size === values.length;
}

export function assertContractIntegrity(contract) {
	assert(contract.schema_version === "1.0.0", "Unsupported contract schema version");
	const immutable = new URL(contract.immutable_origin);
	assert(immutable.protocol === "https:", "Immutable origin must use HTTPS");
	assert(!immutable.username && !immutable.password, "Immutable origin must not contain credentials");
	assert(!immutable.search && !immutable.hash && immutable.pathname === "/", "Immutable origin must be an origin only");
	assert(
		immutable.hostname === `${contract.provenance.deploy_id}--gridpermit.netlify.app`,
		"Immutable origin must be pinned to the recorded Netlify deploy",
	);
	assert(/^[0-9a-f]{40}$/.test(contract.provenance.production_commit), "Production commit must be a full SHA");
	assert(contract.expected.guide_count === 341, "Guide-count evidence changed unexpectedly");
	assert(contract.expected.positive_count === 61, "Positive-count evidence changed unexpectedly");
	assert(contract.expected.negative_count === 280, "Negative-count evidence changed unexpectedly");
	assert(
		contract.expected.positive_count + contract.expected.negative_count === contract.expected.guide_count,
		"Positive and negative guide counts must cover every guide",
	);
	assert(contract.verified_city_slugs.length === contract.expected.positive_count, "Verified slug count must match positive count");
	assert(unique(contract.verified_city_slugs), "Verified city slugs must be unique");
	assert(unique(contract.allowlisted_but_not_deployed), "Undeployed allowlist slugs must be unique");
	assert(
		contract.verified_city_slugs.every((slug) => !contract.allowlisted_but_not_deployed.includes(slug)),
		"Verified and undeployed slug sets must not overlap",
	);
	assert(contract.cta_markers.length === 4, "Exactly four CTA markers are required");
	assert(contract.cta_markers.every((marker) => typeof marker === "string" && marker.length > 0), "CTA markers must be non-empty");
	assert(contract.assets.length === 2, "The CTA bundle and locality-layout CSS must both be recorded");
	assert(unique(contract.assets.map((asset) => asset.path)), "Asset paths must be unique");
	for (const asset of contract.assets) {
		assert(Number.isInteger(asset.bytes) && asset.bytes > 0, `Invalid byte count for ${asset.path}`);
		assert(/^[0-9a-f]{64}$/.test(asset.sha256), `Invalid SHA-256 for ${asset.path}`);
	}
	return contract;
}

export function assertReadOnlyTarget(target, immutableOrigin) {
	const origin = new URL(immutableOrigin);
	const url = new URL(target, origin);
	assert(url.protocol === "https:", `Refusing non-HTTPS target: ${url.href}`);
	assert(url.origin === origin.origin, `Refusing target outside immutable deploy: ${url.href}`);
	assert(!url.username && !url.password, "Refusing URL credentials");
	assert(!url.search, `Refusing query string: ${url.href}`);
	assert(!url.hash, `Refusing URL fragment: ${url.href}`);
	return url;
}

// The probe's only network chokepoint. The HTTP method is deliberately fixed.
export async function get(target, { immutableOrigin, fetchImpl = fetch } = {}) {
	const url = assertReadOnlyTarget(target, immutableOrigin);
	const response = await fetchImpl(url, {
		method: "GET",
		redirect: "error",
		headers: { "user-agent": "GridPermit-read-only-production-contract/1.0" },
	});
	assert(response.ok, `GET ${url.pathname} returned HTTP ${response.status}`);
	if (response.url) {
		const responseUrl = assertReadOnlyTarget(response.url, immutableOrigin);
		assert(responseUrl.href === url.href, `Unexpected response URL for ${url.pathname}`);
	}
	return response;
}

export function extractLocPathnames(xml, allowedOrigins) {
	const allowed = new Set(allowedOrigins.map((origin) => new URL(origin).origin));
	const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
	return locations.map((location) => {
		const url = new URL(location);
		assert(url.protocol === "https:", `Sitemap location is not HTTPS: ${location}`);
		assert(allowed.has(url.origin), `Unexpected sitemap origin: ${url.origin}`);
		assert(!url.search && !url.hash, `Sitemap location has query or fragment: ${location}`);
		return url.pathname;
	});
}

async function getText(target, options) {
	return (await get(target, options)).text();
}

async function mapConcurrent(values, concurrency, callback) {
	const results = new Array(values.length);
	let cursor = 0;
	async function worker() {
		while (cursor < values.length) {
			const index = cursor++;
			results[index] = await callback(values[index], index);
		}
	}
	await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
	return results;
}

function sorted(values) {
	return [...values].sort((left, right) => left.localeCompare(right));
}

function assertSameSet(actual, expected, label) {
	const actualSorted = sorted(actual);
	const expectedSorted = sorted(expected);
	assert(JSON.stringify(actualSorted) === JSON.stringify(expectedSorted), `${label} differs:\nactual=${JSON.stringify(actualSorted)}\nexpected=${JSON.stringify(expectedSorted)}`);
}

export async function probeProductionContract({ contractPath = DEFAULT_CONTRACT_PATH, fetchImpl = fetch, concurrency = 12 } = {}) {
	const contract = assertContractIntegrity(await loadContract(contractPath));
	const requestOptions = { immutableOrigin: contract.immutable_origin, fetchImpl };
	const indexXml = await getText("/sitemap-index.xml", requestOptions);
	const sitemapPaths = extractLocPathnames(indexXml, contract.canonical_sitemap_origins);
	assert(sitemapPaths.length > 0, "Sitemap index contained no sitemaps");
	assert(unique(sitemapPaths), "Sitemap index contained duplicate sitemap paths");
	assert(sitemapPaths.every((entry) => /^\/sitemap-\d+\.xml$/.test(entry)), "Unexpected sitemap path shape");

	const sitemapXml = await mapConcurrent(sitemapPaths, concurrency, (entry) => getText(entry, requestOptions));
	const sitemapRoutes = sitemapXml.flatMap((xml) => extractLocPathnames(xml, contract.canonical_sitemap_origins));
	assert(unique(sitemapRoutes), "Sitemaps contained duplicate routes");
	assert(sitemapRoutes.length === contract.expected.sitemap_url_count, `Expected ${contract.expected.sitemap_url_count} sitemap URLs, saw ${sitemapRoutes.length}`);

	const guidePattern = new RegExp(contract.guide_route_pattern);
	const guideRoutes = sitemapRoutes.filter((entry) => guidePattern.test(entry));
	assert(guideRoutes.length === contract.expected.guide_count, `Expected ${contract.expected.guide_count} guides, saw ${guideRoutes.length}`);
	const californiaGuideCount = guideRoutes.filter((entry) => entry.startsWith("/california/")).length;
	assert(californiaGuideCount === contract.expected.california_guide_count, `Expected ${contract.expected.california_guide_count} California guides, saw ${californiaGuideCount}`);

	const guideResults = await mapConcurrent(guideRoutes, concurrency, async (route) => {
		const html = await getText(route, requestOptions);
		const markerHits = contract.cta_markers.map((marker) => html.includes(marker));
		return { route, html, markerHits };
	});
	const positive = guideResults.filter(({ markerHits }) => markerHits.every(Boolean));
	const negative = guideResults.filter(({ markerHits }) => markerHits.every((hit) => !hit));
	const mixed = guideResults.filter(({ markerHits }) => !markerHits.every(Boolean) && !markerHits.every((hit) => !hit));
	assert(positive.length === contract.expected.positive_count, `Expected ${contract.expected.positive_count} CTA-positive guides, saw ${positive.length}`);
	assert(negative.length === contract.expected.negative_count, `Expected ${contract.expected.negative_count} CTA-negative guides, saw ${negative.length}`);
	assert(mixed.length === contract.expected.mixed_marker_count, `Expected no partial CTA renders, saw ${mixed.length}`);
	const expectedPositiveRoutes = contract.verified_city_slugs.map((slug) => `/california/${slug}/solar-permit-guide/`);
	assertSameSet(positive.map(({ route }) => route), expectedPositiveRoutes, "CTA-positive routes");

	const assetResults = await mapConcurrent(contract.assets, concurrency, async (asset) => {
		const bytes = Buffer.from(await (await get(asset.path, requestOptions)).arrayBuffer());
		const sha256 = createHash("sha256").update(bytes).digest("hex");
		assert(bytes.length === asset.bytes, `${asset.path} expected ${asset.bytes} bytes, saw ${bytes.length}`);
		assert(sha256 === asset.sha256, `${asset.path} SHA-256 differs`);
		return { path: asset.path, bytes: bytes.length, sha256 };
	});

	const privacy = contract.recorded_behaviors.privacy;
	const privacyHtml = await getText(privacy.path, requestOptions);
	for (const marker of privacy.markers) assert(privacyHtml.includes(marker), `Privacy marker missing: ${marker}`);

	const sgip = contract.recorded_behaviors.sgip;
	const sgipCounts = sgip.markers.map((marker) => guideResults.filter(({ html }) => html.includes(marker)).length);
	for (const [index, count] of sgipCounts.entries()) {
		assert(count === sgip.guide_count, `SGIP marker ${index + 1} expected on ${sgip.guide_count} guides, saw ${count}`);
	}

	const blogResults = await mapConcurrent(contract.recorded_behaviors.blog_titles, concurrency, async (entry) => {
		const html = await getText(entry.path, requestOptions);
		assert(html.includes(entry.html_title), `Production title differs at ${entry.path}`);
		return entry;
	});

	return {
		immutable_origin: contract.immutable_origin,
		production_commit: contract.provenance.production_commit,
		sitemap_url_count: sitemapRoutes.length,
		guide_count: guideRoutes.length,
		california_guide_count: californiaGuideCount,
		cta: { positive: positive.length, negative: negative.length, mixed: mixed.length },
		sgip_2026_guide_count: sgipCounts[0],
		privacy_markers: privacy.markers.length,
		blog_titles: blogResults.length,
		assets: assetResults,
	};
}

async function main() {
	const summary = await probeProductionContract();
	process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
}
