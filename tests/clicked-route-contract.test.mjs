// Regression contract: every URL that Google Search Console recorded a real
// click on in the trailing 28 days must still resolve on live production.
// This is a read-only, network-gated probe modeled on
// tests/production-cta-contract.test.mjs and tests/production-route-snapshot.test.mjs —
// it never fetches new GSC data (no API access here), it only replays a GSC
// URL-only fixture. Search metrics and private operational exports are not published.
//
// Default `npm test` runs fully offline: the parsing/shape tests below always
// run, and the live-network test is skipped unless GRIDPERMIT_PROD_PROBE=1 is
// set, matching the existing production-contract test's gating convention.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSV_PATH = path.join(REPO_ROOT, "tests", "fixtures", "recovered-public-routes.csv");
const PRODUCTION_ORIGIN = "https://mygridpermit.com";

// Redirects that are known, deliberate, and already reconciled with live
// production (e.g. a locality merge or an intentional URL restructure).
// Add an entry here only to document a redirect that was a real decision —
// never to silence a redirect nobody expected. Key: the exact URL as it
// appears in the GSC export. Value: the exact final URL it must land on.
const DOCUMENTED_REDIRECTS = {
	// none as of 2026-09-26 — every URL in the current export resolves
	// directly with no redirect.
};

function parseCsv(text) {
	const lines = text
		.split("\n")
		.map((line) => line.replace(/\r$/, ""))
		.filter((line) => line.length > 0);
	assert.ok(lines.length > 1, "GSC clicked-pages export must have a header row plus at least one data row");
	const headers = lines[0].split(",");
	return lines.slice(1).map((line) => {
		const cells = line.split(",");
		assert.equal(cells.length, headers.length, `Row has ${cells.length} cells, expected ${headers.length}: ${line}`);
		const record = {};
		headers.forEach((header, index) => {
			record[header] = cells[index];
		});
		return record;
	});
}

async function loadClickedRoutes() {
	const csv = await readFile(CSV_PATH, "utf8");
	const records = parseCsv(csv);
	assert.ok(records.length > 0, "GSC clicked-pages export must not be empty");
	const urls = records.map((record) => record.key);
	assert.equal(new Set(urls).size, urls.length, "GSC clicked-pages export must not contain duplicate URLs");
	return urls;
}

async function followRedirects(url, { maxHops = 5, fetchImpl = fetch } = {}) {
	const hops = [url];
	let current = url;
	for (let i = 0; i < maxHops; i++) {
		const response = await fetchImpl(current, { method: "GET", redirect: "manual" });
		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get("location");
			assert.ok(location, `Redirect from ${current} has no Location header`);
			current = new URL(location, current).href;
			hops.push(current);
			continue;
		}
		return { finalUrl: current, status: response.status, hops };
	}
	throw new Error(`Too many redirect hops starting at ${url}: ${hops.join(" -> ")}`);
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

test("the GSC 28-day clicked-pages export parses into a non-empty, deduplicated set of mygridpermit.com URLs", async () => {
	const urls = await loadClickedRoutes();
	for (const url of urls) {
		const parsed = new URL(url);
		assert.equal(parsed.origin, PRODUCTION_ORIGIN, `${url} is not a mygridpermit.com URL`);
		assert.equal(parsed.protocol, "https:", `${url} must be HTTPS`);
	}
});

test("documented redirects reference only URLs that are actually present in the current export", async () => {
	const urls = new Set(await loadClickedRoutes());
	for (const source of Object.keys(DOCUMENTED_REDIRECTS)) {
		assert.ok(urls.has(source), `Documented redirect source ${source} is not in the current GSC export — remove the stale entry`);
	}
});

test(
	"every clicked page resolves to HTTP 200, either directly or via a documented redirect",
	{ skip: process.env.GRIDPERMIT_PROD_PROBE !== "1", timeout: 120_000 },
	async () => {
		const urls = await loadClickedRoutes();
		const failures = [];

		await mapConcurrent(urls, 8, async (url) => {
			const { finalUrl, status, hops } = await followRedirects(url);
			if (status !== 200) {
				failures.push(`${url} -> ${finalUrl} returned HTTP ${status}`);
				return;
			}
			if (hops.length > 1) {
				const documented = DOCUMENTED_REDIRECTS[url];
				if (documented === undefined) {
					failures.push(`${url} redirected to ${finalUrl} but no redirect is documented for it (hops: ${hops.join(" -> ")})`);
				} else if (documented !== finalUrl) {
					failures.push(`${url} redirected to ${finalUrl}, but the documented redirect target is ${documented}`);
				}
			}
		});

		assert.deepEqual(failures, [], `${failures.length} of ${urls.length} clicked pages failed:\n${failures.join("\n")}`);
	},
);
