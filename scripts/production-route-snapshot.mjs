#!/usr/bin/env node

// Captures checksum-indexed HTML snapshots of the non-guide routes that the
// production gap manifest proves are divergent from local main: /privacy/,
// /blog/, and the five corrected blog articles.
//
// Every request reuses the read-only chokepoint in
// scripts/production-cta-contract-probe.mjs, so this tool can only ever issue
// GETs against the pinned immutable deploy. It never calls Netlify's API and
// never mutates production. Snapshots are written outside every build input:
// Astro globs only data/localities/*.json and output/*-evaluation.json.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
	DEFAULT_CONTRACT_PATH,
	assertContractIntegrity,
	get,
	loadContract,
} from "./production-cta-contract-probe.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const DEFAULT_SNAPSHOT_DIR = path.join(REPO_ROOT, "data", "production-contract", "route-snapshots");
export const INDEX_FILENAME = "index.json";
export const SNAPSHOT_SCHEMA_VERSION = "1.0.0";

const USAGE_CONTRACT =
	"Recorded production HTML for recovery reference only. No build or runtime code may import these snapshots, and they are not a deploy authorization.";

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

// Derives a stable, collision-free filename from an absolute route path.
// "/" -> "root.html"; "/blog/pge-nem3-calculator/" -> "blog__pge-nem3-calculator.html".
export function snapshotFilename(route) {
	assert(route.startsWith("/"), `Route must be absolute: ${route}`);
	const segments = route.split("/").filter(Boolean);
	assert(
		segments.every((segment) => /^[a-z0-9-]+$/.test(segment)),
		`Refusing route with unexpected path segments: ${route}`,
	);
	return `${segments.length === 0 ? "root" : segments.join("__")}.html`;
}

// The seven divergent non-guide routes, derived from the recorded contract so
// the snapshot set cannot drift away from the evidence it is meant to preserve.
export function divergentNonGuideRoutes(contract) {
	const privacy = contract.recorded_behaviors.privacy;
	const blogTitles = contract.recorded_behaviors.blog_titles;
	assert(blogTitles.length === 5, `Expected 5 corrected blog articles, contract has ${blogTitles.length}`);

	const routes = [
		{ route: privacy.path, required_markers: [...privacy.markers], reason: "Referral Attribution section absent locally" },
		// The blog index is captured for its corrected link copy. The contract
		// records article titles only in <title> form, which does not appear on
		// the index, so no marker is asserted here.
		{ route: "/blog/", required_markers: [], reason: "Index of the five corrected articles" },
		...blogTitles.map((entry) => ({
			route: entry.path,
			required_markers: [entry.html_title],
			reason: "Title and content corrected in production after the local gap began",
		})),
	];

	const filenames = routes.map(({ route }) => snapshotFilename(route));
	assert(new Set(filenames).size === filenames.length, "Snapshot filenames must be unique");
	assert(routes.length === 7, `Expected 7 divergent non-guide routes, built ${routes.length}`);
	return routes;
}

export function sha256(text) {
	return createHash("sha256").update(text, "utf8").digest("hex");
}

async function captureRoute(target, requestOptions) {
	const html = await (await get(target.route, requestOptions)).text();
	for (const marker of target.required_markers) {
		assert(html.includes(marker), `Production marker missing at ${target.route}: ${marker}`);
	}
	return {
		route: target.route,
		file: snapshotFilename(target.route),
		bytes: Buffer.byteLength(html, "utf8"),
		sha256: sha256(html),
		required_markers: target.required_markers,
		reason: target.reason,
		html,
	};
}

export function buildIndex(contract, captures, capturedAt) {
	return {
		schema_version: SNAPSHOT_SCHEMA_VERSION,
		immutable_origin: contract.immutable_origin,
		provenance: { ...contract.provenance },
		captured_at: capturedAt,
		usage_contract: USAGE_CONTRACT,
		routes: captures
			.map(({ html, ...entry }) => entry)
			.sort((left, right) => left.route.localeCompare(right.route)),
	};
}

export async function readIndex(snapshotDir = DEFAULT_SNAPSHOT_DIR) {
	try {
		return JSON.parse(await readFile(path.join(snapshotDir, INDEX_FILENAME), "utf8"));
	} catch (error) {
		if (error.code === "ENOENT") return null;
		throw error;
	}
}

// Compares a freshly captured set against a stored index. The deploy is
// immutable, so any hash difference is a real signal, not expected drift.
export function diffAgainstIndex(previous, next) {
	if (!previous) return { status: "created", changed: [] };
	assert(
		previous.provenance?.deploy_id === next.provenance.deploy_id,
		`Stored snapshots came from deploy ${previous.provenance?.deploy_id}, not ${next.provenance.deploy_id}`,
	);
	const previousByRoute = new Map((previous.routes ?? []).map((entry) => [entry.route, entry]));
	const nextRoutes = new Set(next.routes.map((entry) => entry.route));
	const changed = [
		...next.routes
		.filter((entry) => previousByRoute.get(entry.route)?.sha256 !== entry.sha256)
		.map((entry) => entry.route),
		...(previous.routes ?? []).filter((entry) => !nextRoutes.has(entry.route)).map((entry) => entry.route),
	].sort((left, right) => left.localeCompare(right));
	return { status: changed.length === 0 ? "unchanged" : "changed", changed };
}

async function assertStoredArchive(snapshotDir, index) {
	assert(index.schema_version === SNAPSHOT_SCHEMA_VERSION, "Stored snapshot schema version differs");
	for (const entry of index.routes ?? []) {
		assert(entry.file === snapshotFilename(entry.route), `Stored snapshot filename differs for ${entry.route}`);
		const body = await readFile(path.join(snapshotDir, entry.file), "utf8");
		assert(Buffer.byteLength(body, "utf8") === entry.bytes, `Stored snapshot byte count differs for ${entry.route}`);
		assert(sha256(body) === entry.sha256, `Stored snapshot checksum differs for ${entry.route}`);
	}
}

export async function snapshotProductionRoutes({
	contractPath = DEFAULT_CONTRACT_PATH,
	snapshotDir = DEFAULT_SNAPSHOT_DIR,
	fetchImpl = fetch,
	write = true,
	now = () => new Date().toISOString(),
} = {}) {
	const contract = assertContractIntegrity(await loadContract(contractPath));
	const previous = await readIndex(snapshotDir);
	if (!write && !previous) {
		throw new Error(`No stored snapshots to verify in ${path.relative(REPO_ROOT, snapshotDir)}; run npm run production-route-snapshot first.`);
	}
	const requestOptions = { immutableOrigin: contract.immutable_origin, fetchImpl };
	const targets = divergentNonGuideRoutes(contract);

	// Sequential on purpose: seven routes, and a read-only archival capture has
	// no reason to add concurrent load to the immutable deploy.
	const captures = [];
	for (const target of targets) captures.push(await captureRoute(target, requestOptions));

	const index = buildIndex(contract, captures, now());
	if (previous) await assertStoredArchive(snapshotDir, previous);
	const diff = diffAgainstIndex(previous, index);
	assert(
		!write || diff.status !== "changed",
		`Refusing to overwrite changed snapshots: ${diff.changed.join(", ")}`,
	);

	const shouldWrite = write && diff.status === "created";
	if (shouldWrite) {
		await mkdir(snapshotDir, { recursive: true });
		for (const capture of captures) {
			await writeFile(path.join(snapshotDir, capture.file), capture.html, "utf8");
		}
		await writeFile(path.join(snapshotDir, INDEX_FILENAME), `${JSON.stringify(index, null, 2)}\n`, "utf8");
	}

	return {
		status: diff.status,
		changed_routes: diff.changed,
		written: shouldWrite,
		snapshot_dir: path.relative(REPO_ROOT, snapshotDir),
		immutable_origin: index.immutable_origin,
		production_commit: index.provenance.production_commit,
		route_count: index.routes.length,
		total_bytes: index.routes.reduce((sum, entry) => sum + entry.bytes, 0),
		routes: index.routes.map(({ route, file, bytes, sha256: digest }) => ({ route, file, bytes, sha256: digest })),
	};
}

async function main() {
	const verifyOnly = process.argv.includes("--verify");
	const summary = await snapshotProductionRoutes({ write: !verifyOnly });
	process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
	if (verifyOnly && summary.status === "changed") {
		throw new Error(`Snapshots differ from the stored index: ${summary.changed_routes.join(", ")}`);
	}
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
}
