import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildSitemapPolicy, stateHubRobotsDirective } from "../src/lib/sitemap-policy.ts";

const REPO_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

test("only the six current zero-guide state hubs are excluded from the sitemap", () => {
	const policy = buildSitemapPolicy(REPO_ROOT);
	assert.deepEqual([...policy.emptyStatePaths].sort(), [
		"/indiana/",
		"/kansas/",
		"/missouri/",
		"/ohio/",
		"/south-dakota/",
		"/wyoming/",
	]);
});

test("locality and editorial lastmod values come from source dates", () => {
	const policy = buildSitemapPolicy(REPO_ROOT);
	assert.equal(policy.lastmodByPath.get("/california/san-pablo/solar-permit-guide/"), "2026-08-09");
	assert.equal(policy.lastmodByPath.get("/alabama/birmingham/solar-permit-guide/"), "2026-08-14");
	assert.equal(policy.lastmodByPath.get("/blog/tesla-powerwall-3-vs-enphase-iq5p/"), "2026-10-02");
	assert.equal(policy.lastmodByPath.has("/about/"), false, "static pages without a factual update date must omit lastmod");
});

test("state template noindexes only hubs with zero published guides", () => {
	const source = readFileSync(path.join(REPO_ROOT, "src/pages/[state]/index.astro"), "utf8");
	assert.equal(stateHubRobotsDirective(0), "noindex, follow");
	assert.equal(stateHubRobotsDirective(1), null);
	assert.match(source, /stateHubRobotsDirective\(entries\.length\)/);
	assert.match(source, /robotsDirective && <meta name="robots" content=\{robotsDirective\}/);
});

test("publishing Indiana's first READY guide reverses both sitemap exclusion and noindex policy", () => {
	const root = mkdtempSync(path.join(tmpdir(), "gridpermit-indiana-reversal-"));
	mkdirSync(path.join(root, "data/localities"), { recursive: true });
	mkdirSync(path.join(root, "output"), { recursive: true });
	mkdirSync(path.join(root, "src/content/blog"), { recursive: true });
	writeFileSync(path.join(root, "data/localities/in-test-indianapolis-utility.json"), JSON.stringify({
		record_id: "in-test-indianapolis-utility",
		state: "IN",
		city: { value: "Indianapolis" },
		last_verified: "2026-10-12",
	}));
	writeFileSync(path.join(root, "output/fixture-evaluation.json"), JSON.stringify({
		records: [{ record_id: "in-test-indianapolis-utility", readiness: "READY" }],
	}));
	const policy = buildSitemapPolicy(root);
	assert.equal(policy.emptyStatePaths.has("/indiana/"), false);
	assert.equal(policy.lastmodByPath.get("/indiana/"), "2026-10-12");
	assert.equal(stateHubRobotsDirective(1), null);
});

test("homepage does not render empty Coming Soon comparison rows", () => {
	const source = readFileSync(path.join(REPO_ROOT, "src/pages/index.astro"), "utf8");
	assert.doesNotMatch(source, /<td>Coming Soon<\/td>/);
	assert.doesNotMatch(source, /class="results-table-wrap"/);
	assert.match(source, /Does <strong>not<\/strong> estimate dollar savings or payback yet/);
});
