// Regression guard against generator/generated-page drift on the one
// invariant this project already got burned by: CITY_PATH silently
// diverging from PAGE_PATH across every generated locality page (271+
// pages carried a stale, redirect-through cityPath value for weeks after
// the generator itself was fixed to stop producing it - see the git log
// for scripts/generate-locality-pages.mjs around 2026-09-26).
//
// Does not attempt a full byte-identical tree regeneration: that requires
// LOCALITY_PAGES_OUTPUT_ROOT, which pins every record to one flat directory
// regardless of state (see that env var's own doc comment in the generator)
// and so legitimately changes every generated file's relative import
// paths - a real difference from the committed per-state nested tree, not
// drift. Comparing the two path constants directly is both correct and far
// faster than invoking the CLI once per page.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function findExistingPageFiles() {
	const files = [];
	function walk(dir) {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (entry.name === "solar-permit-guide.astro") files.push(full);
		}
	}
	walk(path.join(REPO_ROOT, "src", "pages"));
	return files;
}

test("every generated locality page's CITY_PATH matches its own PAGE_PATH (no per-city hub page exists to point at instead)", () => {
	const pageFiles = findExistingPageFiles();
	assert.ok(pageFiles.length > 300, `expected 300+ generated locality pages, found ${pageFiles.length} - directory scan may be broken`);

	const drifted = [];
	for (const pageFile of pageFiles) {
		const source = readFileSync(pageFile, "utf8");
		const pagePathMatch = source.match(/const PAGE_PATH = "([^"]+)";/);
		const cityPathMatch = source.match(/const CITY_PATH = "([^"]+)";/);
		if (!pagePathMatch || !cityPathMatch) {
			drifted.push(`${path.relative(REPO_ROOT, pageFile)}: missing PAGE_PATH or CITY_PATH constant entirely`);
			continue;
		}
		if (cityPathMatch[1] !== pagePathMatch[1]) {
			drifted.push(`${path.relative(REPO_ROOT, pageFile)}: CITY_PATH="${cityPathMatch[1]}" != PAGE_PATH="${pagePathMatch[1]}"`);
		}
	}

	assert.deepEqual(
		drifted,
		[],
		`${drifted.length} of ${pageFiles.length} generated pages have a CITY_PATH that no longer matches PAGE_PATH - regenerate them with:\n  node scripts/generate-locality-pages.mjs --write --force <record_id>\n${drifted.slice(0, 10).join("\n")}${drifted.length > 10 ? `\n...and ${drifted.length - 10} more` : ""}`,
	);
});
