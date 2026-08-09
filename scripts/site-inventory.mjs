#!/usr/bin/env node
// Deterministic inventory of every public URL in the built site
// (dist/). Parses each dist/**/index.html for its SEO-relevant surface
// (title, meta description, canonical, robots, H1/H2, word count,
// JSON-LD types, internal links, OpenGraph/Twitter meta) and
// cross-references against the sitemap, then reports defects:
// duplicate titles/descriptions, missing metadata, malformed/missing
// canonicals, accidental noindex, orphan pages (no internal inbound
// link), dead internal links, and sitemap drift.
//
// Read-only: never modifies dist/ or any source file. Run after
// `npm run build`.
//
// Usage: node scripts/site-inventory.mjs [--json]

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const DIST_DIR = path.join(REPO_ROOT, "dist");
const OUT_PATH = path.join(REPO_ROOT, "output", "site-inventory.json");

async function walk(dir, files = []) {
	const entries = await readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			await walk(full, files);
		} else if (entry.name === "index.html") {
			files.push(full);
		}
	}
	return files;
}

function urlForFile(filePath) {
	const rel = path.relative(DIST_DIR, filePath);
	const dir = path.dirname(rel);
	if (dir === ".") return "/";
	return `/${dir.replace(/\\/g, "/")}/`;
}

function extractAll(html, regex) {
	const out = [];
	let m;
	const re = new RegExp(regex, "gis");
	while ((m = re.exec(html))) out.push(m);
	return out;
}

function extractOne(html, regex) {
	const m = html.match(new RegExp(regex, "is"));
	return m ? m[1].trim() : null;
}

function decodeEntities(str) {
	return str
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
}

function stripTags(str) {
	return decodeEntities(str.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function analyzePage(url, html) {
	const titleRaw = extractOne(html, "<title>(.*?)</title>");
	const title = titleRaw === null ? null : decodeEntities(titleRaw);
	const descriptionRaw = extractOne(html, '<meta\\s+name="description"\\s+content="([^"]*)"');
	const description = descriptionRaw === null ? null : decodeEntities(descriptionRaw);
	const canonicalHref = extractOne(html, '<link\\s+rel="canonical"\\s+href="([^"]*)"');
	const robotsMeta = extractOne(html, '<meta\\s+name="robots"\\s+content="([^"]*)"');
	const ogTitle = extractOne(html, '<meta\\s+property="og:title"\\s+content="([^"]*)"');
	const ogDescription = extractOne(html, '<meta\\s+property="og:description"\\s+content="([^"]*)"');
	const ogImage = extractOne(html, '<meta\\s+property="og:image"\\s+content="([^"]*)"');
	const ogType = extractOne(html, '<meta\\s+property="og:type"\\s+content="([^"]*)"');
	const twitterCard = extractOne(html, '<meta\\s+name="twitter:card"\\s+content="([^"]*)"');
	const googleSiteVerification = extractOne(html, '<meta\\s+name="google-site-verification"\\s+content="([^"]*)"');
	const rssAlternate = /rel="alternate"[^>]*type="application\/rss\+xml"/i.test(html);
	const sitemapLink = /rel="sitemap"/i.test(html);

	const h1s = extractAll(html, "<h1[^>]*>(.*?)</h1>").map((m) => stripTags(m[1]));
	const h2s = extractAll(html, "<h2[^>]*>(.*?)</h2>").map((m) => stripTags(m[1]));

	// Word count from <body>, stripping <script>/<style> content and tags.
	const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
	const bodyHtml = bodyMatch ? bodyMatch[1] : html;
	const noScriptStyle = bodyHtml.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
	const bodyText = stripTags(noScriptStyle);
	const wordCount = bodyText.length === 0 ? 0 : bodyText.split(/\s+/).filter(Boolean).length;

	// JSON-LD blocks: parse each <script type="application/ld+json">.
	const jsonLdBlocks = extractAll(html, '<script[^>]*type="application/ld\\+json"[^>]*>([\\s\\S]*?)</script>');
	const structuredDataTypes = [];
	const structuredDataErrors = [];
	for (const [, raw] of jsonLdBlocks) {
		try {
			const parsed = JSON.parse(raw.trim());
			const type = parsed["@type"];
			if (type) structuredDataTypes.push(Array.isArray(type) ? type.join("+") : type);
			const serialized = JSON.stringify(parsed);
			if (/\bnull\b/.test(serialized.replace(/"[^"]*null[^"]*"/g, ""))) {
				// a bare `null` (not inside a quoted string) would only appear for
				// an actual JSON null value, which is valid JSON-LD (e.g. an
				// intentionally absent optional field) — not flagged here.
			}
			if (serialized.includes("undefined")) {
				structuredDataErrors.push("contains literal 'undefined'");
			}
		} catch (err) {
			structuredDataErrors.push(`invalid JSON: ${err.message}`);
		}
	}

	// Internal links: href="/..." or href="https://mygridpermit.com/...".
	const hrefs = extractAll(html, 'href="([^"]*)"').map((m) => decodeEntities(m[1]));
	const internalLinks = new Set();
	for (const href of hrefs) {
		if (href.startsWith("/") && !href.startsWith("//")) {
			internalLinks.add(href.split("#")[0].split("?")[0]);
		} else if (href.startsWith("https://mygridpermit.com")) {
			internalLinks.add(href.replace("https://mygridpermit.com", "").split("#")[0].split("?")[0] || "/");
		}
	}
	const externalLinks = hrefs.filter(
		(h) => /^https?:\/\//.test(h) && !h.startsWith("https://mygridpermit.com"),
	);

	return {
		url,
		title,
		titleLength: title ? title.length : 0,
		description,
		descriptionLength: description ? description.length : 0,
		canonical: canonicalHref,
		robotsMeta,
		noindex: robotsMeta ? /noindex/i.test(robotsMeta) : false,
		h1s,
		h2Count: h2s.length,
		h2s,
		wordCount,
		structuredDataTypes,
		structuredDataErrors,
		jsonLdBlockCount: jsonLdBlocks.length,
		ogTitle,
		ogDescription,
		ogImage,
		ogType,
		twitterCard,
		googleSiteVerification: Boolean(googleSiteVerification),
		rssAlternate,
		sitemapLink,
		internalLinks: [...internalLinks].sort(),
		internalLinkCount: internalLinks.size,
		externalLinkCount: externalLinks.length,
	};
}

// Parses netlify.toml's [[redirects]] blocks into a from -> to map (only
// simple exact-path from/to pairs; the one regex-style "/*" catch-all some
// sites use is intentionally not supported since this project doesn't have
// one). Used so an internal link that resolves via a real, intentional
// redirect (e.g. a breadcrumb target) isn't misreported as a dead link
// alongside genuinely broken ones — those are two different problems with
// two different fixes.
async function loadRedirectMap() {
	const tomlPath = path.join(REPO_ROOT, "netlify.toml");
	const toml = await readFile(tomlPath, "utf8");
	const map = new Map();
	const blocks = toml.split(/\[\[redirects\]\]/).slice(1);
	for (const block of blocks) {
		const from = extractOne(block, 'from\\s*=\\s*"([^"]*)"');
		const to = extractOne(block, 'to\\s*=\\s*"([^"]*)"');
		if (from && to && from.startsWith("/") && to.startsWith("/")) map.set(from, to);
	}
	return map;
}

async function loadSitemapUrls() {
	const sitemapPath = path.join(DIST_DIR, "sitemap-0.xml");
	if (!(await stat(sitemapPath).catch(() => null))) return [];
	const xml = await readFile(sitemapPath, "utf8");
	const locs = extractAll(xml, "<loc>(.*?)</loc>").map((m) => decodeEntities(m[1]));
	return locs.map((u) => u.replace("https://mygridpermit.com", "") || "/");
}

function classifyPageFamily(url) {
	if (url === "/") return "home";
	if (/^\/california\/[^/]+\/solar-permit-guide\/$/.test(url)) return "locality-guide";
	if (url === "/california/solar-permit-guides/") return "locality-directory";
	if (url === "/california/") return "california-hub";
	if (/^\/california\/county\/[^/]+\/$/.test(url)) return "county-hub";
	if (/^\/california\/utility\/[^/]+\/$/.test(url)) return "utility-hub";
	if (/^\/blog\/[^/]+\/$/.test(url)) return "blog-post";
	if (url === "/blog/") return "blog-index";
	if (url === "/search/") return "search";
	return "static";
}

function buildDefectReport(pages, sitemapUrls, redirectMap) {
	const defects = {
		duplicate_titles: [],
		duplicate_descriptions: [],
		missing_title: [],
		missing_description: [],
		title_too_long: [],
		description_too_long: [],
		description_too_short: [],
		multiple_h1: [],
		missing_h1: [],
		missing_canonical: [],
		malformed_canonical: [],
		accidental_noindex: [],
		missing_og_title: [],
		missing_twitter_card: [],
		missing_google_site_verification: [],
		orphan_pages: [],
		sitemap_drift_missing_from_sitemap: [],
		sitemap_drift_extra_in_sitemap: [],
		dead_internal_links: [],
		internal_links_via_redirect: [],
		structured_data_errors: [],
		thin_pages: [],
	};

	const byUrl = new Map(pages.map((p) => [p.url, p]));
	const titleCounts = new Map();
	const descCounts = new Map();
	for (const p of pages) {
		if (p.title) titleCounts.set(p.title, (titleCounts.get(p.title) || []).concat(p.url));
		if (p.description) descCounts.set(p.description, (descCounts.get(p.description) || []).concat(p.url));
	}
	for (const [title, urls] of titleCounts) {
		if (urls.length > 1) defects.duplicate_titles.push({ title, urls });
	}
	for (const [desc, urls] of descCounts) {
		if (urls.length > 1) defects.duplicate_descriptions.push({ description: desc, urls });
	}

	const inboundLinks = new Map();
	for (const p of pages) {
		for (const link of p.internalLinks) {
			if (!inboundLinks.has(link)) inboundLinks.set(link, new Set());
			inboundLinks.get(link).add(p.url);
		}
	}

	for (const p of pages) {
		if (!p.title) defects.missing_title.push(p.url);
		if (!p.description) defects.missing_description.push(p.url);
		if (p.title && p.titleLength > 65) defects.title_too_long.push({ url: p.url, length: p.titleLength });
		if (p.description && p.descriptionLength > 160) defects.description_too_long.push({ url: p.url, length: p.descriptionLength });
		if (p.description && p.descriptionLength > 0 && p.descriptionLength < 50) defects.description_too_short.push({ url: p.url, length: p.descriptionLength });
		if (p.h1s.length > 1) defects.multiple_h1.push({ url: p.url, count: p.h1s.length });
		if (p.h1s.length === 0) defects.missing_h1.push(p.url);
		if (!p.canonical) defects.missing_canonical.push(p.url);
		else if (!p.canonical.startsWith("https://mygridpermit.com")) defects.malformed_canonical.push({ url: p.url, canonical: p.canonical });
		if (p.noindex) defects.accidental_noindex.push(p.url);
		if (!p.ogTitle) defects.missing_og_title.push(p.url);
		if (!p.twitterCard) defects.missing_twitter_card.push(p.url);
		if (!p.googleSiteVerification) defects.missing_google_site_verification.push(p.url);
		if (p.structuredDataErrors.length > 0) defects.structured_data_errors.push({ url: p.url, errors: p.structuredDataErrors });
		if (p.wordCount > 0 && p.wordCount < 150 && classifyPageFamily(p.url) !== "search") {
			defects.thin_pages.push({ url: p.url, wordCount: p.wordCount });
		}
		const inbound = inboundLinks.get(p.url);
		if (p.url !== "/" && (!inbound || inbound.size === 0)) {
			defects.orphan_pages.push(p.url);
		}
	}

	const sitemapSet = new Set(sitemapUrls);
	const distSet = new Set(pages.map((p) => p.url));
	for (const p of pages) {
		if (!sitemapSet.has(p.url) && !p.noindex) defects.sitemap_drift_missing_from_sitemap.push(p.url);
	}
	for (const u of sitemapUrls) {
		if (!distSet.has(u)) defects.sitemap_drift_extra_in_sitemap.push(u);
	}

	for (const p of pages) {
		for (const link of p.internalLinks) {
			// Skip non-page assets (files with an extension other than a
			// trailing-slash route) and mailto/tel links, which internal-link
			// crawling can't meaningfully validate against dist/'s index.html set.
			if (/\.[a-z0-9]+$/i.test(link) && !link.endsWith("/")) continue;
			const normalized = link.endsWith("/") || link === "" ? link || "/" : `${link}/`;
			if (byUrl.has(normalized) || byUrl.has(link)) continue;

			// Not a real page in dist/ — check whether netlify.toml resolves it
			// via a redirect (possibly a chain) before calling it dead.
			let resolved = link;
			let hops = 0;
			const seen = new Set();
			while (redirectMap.has(resolved) && !seen.has(resolved) && hops < 10) {
				seen.add(resolved);
				resolved = redirectMap.get(resolved);
				hops++;
			}
			const resolvedNormalized = resolved.endsWith("/") || resolved === "" ? resolved || "/" : `${resolved}/`;
			if (hops > 0 && (byUrl.has(resolvedNormalized) || byUrl.has(resolved))) {
				defects.internal_links_via_redirect.push({ from: p.url, to: link, resolves_to: resolved, hops });
			} else {
				defects.dead_internal_links.push({ from: p.url, to: link });
			}
		}
	}

	return defects;
}

async function main() {
	const files = await walk(DIST_DIR);
	const pages = [];
	for (const file of files) {
		const url = urlForFile(file);
		const html = await readFile(file, "utf8");
		const analysis = analyzePage(url, html);
		analysis.family = classifyPageFamily(url);
		pages.push(analysis);
	}
	pages.sort((a, b) => a.url.localeCompare(b.url));

	const sitemapUrls = await loadSitemapUrls();
	const redirectMap = await loadRedirectMap();
	const defects = buildDefectReport(pages, sitemapUrls, redirectMap);

	const familyCounts = {};
	for (const p of pages) familyCounts[p.family] = (familyCounts[p.family] || 0) + 1;

	const report = {
		generated_at: new Date().toISOString(),
		total_pages: pages.length,
		sitemap_url_count: sitemapUrls.length,
		family_counts: familyCounts,
		defect_summary: Object.fromEntries(Object.entries(defects).map(([k, v]) => [k, v.length])),
		defects,
		pages,
	};

	await import("node:fs/promises").then((fs) => fs.mkdir(path.dirname(OUT_PATH), { recursive: true }));
	await (await import("node:fs/promises")).writeFile(OUT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");

	if (process.argv.includes("--json")) {
		console.log(JSON.stringify(report, null, 2));
	} else {
		console.log(`Site inventory: ${pages.length} pages, ${sitemapUrls.length} sitemap URLs`);
		console.log("Family counts:", familyCounts);
		console.log("Defect summary:");
		for (const [k, v] of Object.entries(report.defect_summary)) {
			if (v > 0) console.log(`  ${k}: ${v}`);
		}
		console.log(`\nFull report: ${path.relative(REPO_ROOT, OUT_PATH)}`);
	}
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
	main().catch((err) => {
		console.error("error:", err.stack ?? String(err));
		process.exit(1);
	});
}
