import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { assertContractIntegrity, loadContract } from "../scripts/production-cta-contract-probe.mjs";
import {
	INDEX_FILENAME,
	buildIndex,
	diffAgainstIndex,
	divergentNonGuideRoutes,
	sha256,
	snapshotFilename,
	snapshotProductionRoutes,
} from "../scripts/production-route-snapshot.mjs";

const contract = assertContractIntegrity(await loadContract());

// Serves every recorded marker so a passing offline run proves wiring, not content.
function stubFetch(overrides = {}) {
	const bodies = new Map([
		["/privacy/", `<html>${contract.recorded_behaviors.privacy.markers.join(" ")}</html>`],
		["/blog/", "<html>blog index</html>"],
		...contract.recorded_behaviors.blog_titles.map((entry) => [entry.path, `<html>${entry.html_title}</html>`]),
	]);
	for (const [route, body] of Object.entries(overrides)) bodies.set(route, body);
	return async (url) => {
		const body = bodies.get(url.pathname);
		if (body === undefined) return { ok: false, status: 404, url: url.href };
		return { ok: true, status: 200, url: url.href, text: async () => body };
	};
}

async function tempSnapshotDir() {
	return mkdtemp(path.join(tmpdir(), "gridpermit-snapshot-"));
}

test("the snapshot set is exactly the seven divergent non-guide routes", () => {
	const routes = divergentNonGuideRoutes(contract).map((entry) => entry.route);
	assert.equal(routes.length, 7);
	assert.deepEqual(routes.slice(0, 2), ["/privacy/", "/blog/"]);
	assert.deepEqual(
		routes.slice(2).sort(),
		contract.recorded_behaviors.blog_titles.map((entry) => entry.path).sort(),
	);
	assert.equal(new Set(routes).size, 7);
});

test("snapshot filenames are deterministic, flat, and collision-free", () => {
	assert.equal(snapshotFilename("/privacy/"), "privacy.html");
	assert.equal(snapshotFilename("/blog/"), "blog.html");
	assert.equal(snapshotFilename("/blog/sce-guide/"), "blog__sce-guide.html");
	assert.equal(snapshotFilename("/"), "root.html");
	for (const route of ["/blog/../etc/", "/Blog/", "/blog/a b/"]) {
		assert.throws(() => snapshotFilename(route), /Refusing route|absolute/);
	}
	const files = divergentNonGuideRoutes(contract).map((entry) => snapshotFilename(entry.route));
	assert.equal(new Set(files).size, files.length);
});

test("capture writes checksum-indexed snapshots outside every build input", async () => {
	const snapshotDir = await tempSnapshotDir();
	const summary = await snapshotProductionRoutes({
		snapshotDir,
		fetchImpl: stubFetch(),
		now: () => "2026-09-04T00:00:00.000Z",
	});

	assert.equal(summary.status, "created");
	assert.equal(summary.route_count, 7);
	assert.equal(summary.production_commit, contract.provenance.production_commit);

	const index = JSON.parse(await readFile(path.join(snapshotDir, INDEX_FILENAME), "utf8"));
	assert.equal(index.provenance.deploy_id, contract.provenance.deploy_id);
	assert.equal(index.captured_at, "2026-09-04T00:00:00.000Z");
	assert.ok(index.usage_contract.includes("recovery reference only"));
	assert.deepEqual(
		index.routes.map((entry) => entry.route),
		[...index.routes.map((entry) => entry.route)].sort(),
	);

	for (const entry of index.routes) {
		const body = await readFile(path.join(snapshotDir, entry.file), "utf8");
		assert.equal(sha256(body), entry.sha256, `${entry.route} checksum must match its stored body`);
		assert.equal(Buffer.byteLength(body, "utf8"), entry.bytes);
		for (const marker of entry.required_markers) assert.ok(body.includes(marker));
	}
	// The index must never carry inlined HTML; the files are the archive.
	assert.ok(index.routes.every((entry) => !("html" in entry)));
});

test("capture fails closed when a recorded production marker is absent", async () => {
	const snapshotDir = await tempSnapshotDir();
	await assert.rejects(
		snapshotProductionRoutes({
			snapshotDir,
			fetchImpl: stubFetch({ "/blog/sce-guide/": "<html>uncorrected title</html>" }),
		}),
		/Production marker missing at \/blog\/sce-guide\//,
	);
});

test("verify mode reports drift against the stored index without rewriting it", async () => {
	const snapshotDir = await tempSnapshotDir();
	await snapshotProductionRoutes({ snapshotDir, fetchImpl: stubFetch() });
	const before = await readFile(path.join(snapshotDir, INDEX_FILENAME), "utf8");

	const unchanged = await snapshotProductionRoutes({ snapshotDir, fetchImpl: stubFetch(), write: false });
	assert.equal(unchanged.status, "unchanged");
	assert.deepEqual(unchanged.changed_routes, []);

	const drifted = await snapshotProductionRoutes({
		snapshotDir,
		fetchImpl: stubFetch({ "/blog/": "<html>blog index, edited</html>" }),
		write: false,
	});
	assert.equal(drifted.status, "changed");
	assert.deepEqual(drifted.changed_routes, ["/blog/"]);
	assert.equal(await readFile(path.join(snapshotDir, INDEX_FILENAME), "utf8"), before);
});

test("snapshots from a different deploy are rejected rather than silently merged", () => {
	const next = buildIndex(contract, [], "2026-09-04T00:00:00.000Z");
	const foreign = { provenance: { deploy_id: "0000000000000000000000ab" }, routes: [] };
	assert.throws(() => diffAgainstIndex(foreign, next), /Stored snapshots came from deploy/);
});

test("verification detects routes removed from a fresh snapshot set", () => {
	const next = buildIndex(contract, [], "2026-09-04T00:00:00.000Z");
	const previous = buildIndex(contract, [{
		route: "/retired/",
		file: "retired.html",
		bytes: 1,
		sha256: "0".repeat(64),
		required_markers: [],
		reason: "test",
		html: "x",
	}], "2026-09-03T00:00:00.000Z");
	assert.deepEqual(diffAgainstIndex(previous, next), { status: "changed", changed: ["/retired/"] });
});

test("verification fails before fetching when no archive exists", async () => {
	const snapshotDir = await tempSnapshotDir();
	let fetchCount = 0;
	await assert.rejects(
		snapshotProductionRoutes({
			snapshotDir,
			write: false,
			fetchImpl: async () => {
				fetchCount += 1;
				throw new Error("fetch should not run");
			},
		}),
		/No stored snapshots to verify/,
	);
	assert.equal(fetchCount, 0);
});

test("capture refuses to overwrite a changed archive", async () => {
	const snapshotDir = await tempSnapshotDir();
	await snapshotProductionRoutes({ snapshotDir, fetchImpl: stubFetch() });
	const before = await readFile(path.join(snapshotDir, INDEX_FILENAME), "utf8");

	await assert.rejects(
		snapshotProductionRoutes({
			snapshotDir,
			fetchImpl: stubFetch({ "/blog/": "<html>changed blog index</html>" }),
		}),
		/Refusing to overwrite changed snapshots: \/blog\//,
	);
	assert.equal(await readFile(path.join(snapshotDir, INDEX_FILENAME), "utf8"), before);
});

test("an unchanged capture preserves the original archive timestamp and bytes", async () => {
	const snapshotDir = await tempSnapshotDir();
	await snapshotProductionRoutes({
		snapshotDir,
		fetchImpl: stubFetch(),
		now: () => "2026-09-03T00:00:00.000Z",
	});
	const before = await readFile(path.join(snapshotDir, INDEX_FILENAME), "utf8");
	const summary = await snapshotProductionRoutes({
		snapshotDir,
		fetchImpl: stubFetch(),
		now: () => "2026-09-04T00:00:00.000Z",
	});

	assert.equal(summary.status, "unchanged");
	assert.equal(summary.written, false);
	assert.equal(await readFile(path.join(snapshotDir, INDEX_FILENAME), "utf8"), before);
});

test("verification fails if an archived HTML file no longer matches its checksum", async () => {
	const snapshotDir = await tempSnapshotDir();
	await snapshotProductionRoutes({ snapshotDir, fetchImpl: stubFetch() });
	await writeFile(path.join(snapshotDir, "privacy.html"), "tampered", "utf8");

	await assert.rejects(
		snapshotProductionRoutes({ snapshotDir, fetchImpl: stubFetch(), write: false }),
		/Stored snapshot byte count differs for \/privacy\//,
	);
});

test("live immutable non-guide route snapshot", { skip: process.env.GRIDPERMIT_PROD_PROBE !== "1", timeout: 120_000 }, async () => {
	const summary = await snapshotProductionRoutes();
	assert.equal(summary.route_count, 7);
	assert.ok(["created", "unchanged"].includes(summary.status), `Unexpected snapshot drift: ${summary.changed_routes.join(", ")}`);
});
