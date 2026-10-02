import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const SCRIPT = path.join(REPO_ROOT, "scripts/build-first-revenue-opportunities.mjs");

const ROUTING_NOW = "2026-10-01T21:00:00.000Z";

async function runWithRows(rows, now = ROUTING_NOW) {
	const dir = await mkdtemp(path.join(os.tmpdir(), "gp-first-revenue-"));
	await writeFile(path.join(dir, "current_page.json"), JSON.stringify({ start: "2026-09-01", end: "2026-09-28", rows }));
	try {
		const out = execFileSync(process.execPath, ["--experimental-strip-types", SCRIPT, dir, "--now", now], { encoding: "utf8" });
		return JSON.parse(out);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

const row = (url, clicks, impressions, position = 5) => ({ keys: [url], clicks, impressions, ctr: clicks / impressions, position });

test("a real paid-route city (Poway, SDG&E) is classified already-monetized-safe", async () => {
	const out = await runWithRows([row("https://mygridpermit.com/california/poway/solar-permit-guide/", 1, 10)]);
	const c = out.candidates.find((x) => x.page_path.includes("poway"));
	assert.equal(c.classification, "ALREADY_MONETIZED_SAFE");
	assert.equal(c.currently_paid_route, true);
	assert.equal(c.partner, "compare-solar-prices");
});

test("Mission Viejo (on the allowlist but utility-split) is classified utility-unsafe, never monetized", async () => {
	const out = await runWithRows([row("https://mygridpermit.com/california/mission-viejo/solar-permit-guide/", 1, 10)]);
	const c = out.candidates.find((x) => x.page_path.includes("mission-viejo"));
	assert.equal(c.classification, "UTILITY_UNSAFE");
	assert.equal(c.currently_paid_route, false);
});

test("a non-California locality guide is a geography mismatch, not mis-labeled as non-locality", async () => {
	const out = await runWithRows([row("https://mygridpermit.com/hawaii/hilo/solar-permit-guide/", 0, 10)]);
	const c = out.candidates.find((x) => x.page_path.includes("hilo"));
	assert.equal(c.classification, "GEOGRAPHY_MISMATCH");
	assert.equal(c.city, "hilo");
});


test("non-CA geography remains the primary blocker even when the locality utility is also unsafe", async () => {
	const out = await runWithRows([row("https://mygridpermit.com/virginia/loudoun-county/solar-permit-guide/", 1, 10)]);
	const candidate = out.candidates.find((x) => x.page_path.includes("loudoun-county"));
	assert.equal(candidate.classification, "GEOGRAPHY_MISMATCH");
	assert.equal(candidate.actionability, "REQUIRES_A_NON_CA_PARTNER_NOT_ENGINEERING");
	assert.equal(candidate.currently_paid_route, false);
	assert.ok(candidate.partner_blockers.includes("STATE_OUTSIDE_TERRITORY"));
	assert.ok(candidate.partner_blockers.includes("UTILITY_UNSAFE"));
});

test("a California city not in the verified CSP territory is a geography mismatch", async () => {
	const out = await runWithRows([row("https://mygridpermit.com/california/san-francisco/solar-permit-guide/", 0, 10)]);
	const candidate = out.candidates.find((x) => x.page_path.includes("san-francisco"));
	assert.equal(candidate.classification, "GEOGRAPHY_MISMATCH");
	assert.equal(candidate.currently_paid_route, false);
});

test("expired destination health cannot be mislabeled as a currently paid route", async () => {
	const out = await runWithRows(
		[row("https://mygridpermit.com/california/poway/solar-permit-guide/", 1, 10)],
		"2026-10-04T21:00:00.000Z",
	);
	const candidate = out.candidates.find((x) => x.page_path.includes("poway"));
	assert.equal(candidate.currently_paid_route, false);
	assert.equal(candidate.classification, "NO_ACTION");
	assert.ok(candidate.partner_blockers.includes("DESTINATION_UNVERIFIED_OR_BROKEN"));
});

test("the homepage is no-action, not misclassified as a locality page", async () => {
	const out = await runWithRows([row("https://mygridpermit.com/", 2, 16)]);
	assert.equal(out.candidates[0].classification, "NO_ACTION");
});

test("rows below the click/impression floor are excluded", async () => {
	const out = await runWithRows([row("https://mygridpermit.com/california/poway/solar-permit-guide/", 0, 3)]);
	assert.equal(out.candidate_count, 0);
});

test("requires a GSC directory argument and fails closed without one", () => {
	assert.throws(() => execFileSync(process.execPath, ["--experimental-strip-types", SCRIPT], { encoding: "utf8" }));
});
