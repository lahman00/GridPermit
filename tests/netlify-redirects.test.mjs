// Regression guard for the "/california/<city>/" breadcrumb-target redirects
// documented in netlify.toml. buildBreadcrumbItems (src/lib/locality-guide.ts)
// links "California" and each city name to paths with no matching Astro page
// — netlify.toml redirects those to the real *-solar-permit-guide/ pages
// instead. That file's own comment says to add one entry per new city, and
// this session found 3 generated cities (santa-rosa, santa-ana, alameda)
// that were missing theirs — a real broken link in production. This test
// makes that omission fail loudly instead of silently shipping again.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const NETLIFY_TOML_PATH = path.join(REPO_ROOT, "netlify.toml");
const CALIFORNIA_PAGES_DIR = path.join(REPO_ROOT, "src", "pages", "california");

const netlifyToml = readFileSync(NETLIFY_TOML_PATH, "utf8");

function citySlugsWithGuidePages() {
	return readdirSync(CALIFORNIA_PAGES_DIR, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.filter((slug) => existsSync(path.join(CALIFORNIA_PAGES_DIR, slug, "solar-permit-guide.astro")));
}

test("every city with a generated solar-permit-guide.astro page has a matching netlify.toml redirect", () => {
	const slugs = citySlugsWithGuidePages();
	assert.ok(slugs.length > 0, "expected at least one city guide page to exist on disk");

	for (const slug of slugs) {
		const fromLine = `from = "/california/${slug}/"`;
		const toLine = `to = "/california/${slug}/solar-permit-guide/"`;
		assert.ok(
			netlifyToml.includes(fromLine) && netlifyToml.includes(toLine),
			`netlify.toml is missing a redirect for /california/${slug}/ -> /california/${slug}/solar-permit-guide/`,
		);
	}
});

test("netlify.toml redirects /california/ to the real guide index page", () => {
	assert.ok(netlifyToml.includes('from = "/california/"'));
	assert.ok(netlifyToml.includes('to = "/california/solar-permit-guides/"'));
});
