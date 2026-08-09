// Regression guard for public/robots.txt (Workstreams 16-18: sitemap,
// robots, crawlability). Nothing here was previously asserted by a test —
// a future edit could silently add a Disallow that blocks the whole site,
// or let the Sitemap: line drift from the site's real origin/sitemap path,
// with nothing catching it before production.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const ROBOTS_PATH = path.join(REPO_ROOT, "public", "robots.txt");
const ASTRO_CONFIG_PATH = path.join(REPO_ROOT, "astro.config.mjs");

const robotsTxt = readFileSync(ROBOTS_PATH, "utf8");
const astroConfig = readFileSync(ASTRO_CONFIG_PATH, "utf8");

test("robots.txt allows crawling the whole site (no blanket Disallow)", () => {
	assert.ok(/User-agent:\s*\*/i.test(robotsTxt), "expected a User-agent: * rule");
	assert.ok(/Allow:\s*\//i.test(robotsTxt), "expected an Allow: / rule");
	// A bare "Disallow: /" (with nothing after the slash) would block every
	// page from every crawler — the one robots.txt mistake that's
	// unambiguously always wrong for a site that wants to be indexed.
	assert.ok(!/Disallow:\s*\/\s*$/im.test(robotsTxt), "found a blanket 'Disallow: /' — this would block the entire site from crawlers");
});

test("robots.txt's Sitemap: line points to the site's real origin and the actual sitemap-index path @astrojs/sitemap generates", () => {
	const siteMatch = astroConfig.match(/site:\s*['"]([^'"]+)['"]/);
	assert.ok(siteMatch, "could not find `site:` in astro.config.mjs to compare against");
	const siteOrigin = siteMatch[1].replace(/\/$/, "");
	const expectedSitemapUrl = `${siteOrigin}/sitemap-index.xml`;
	assert.ok(
		robotsTxt.includes(`Sitemap: ${expectedSitemapUrl}`),
		`expected robots.txt to reference "Sitemap: ${expectedSitemapUrl}"`,
	);
});
