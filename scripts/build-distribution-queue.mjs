#!/usr/bin/env node
// Builds the organic-distribution human-review queue. Local files only: no
// network access, no posting, no account access.
//
//   node scripts/build-distribution-queue.mjs --snapshot <dist-snapshot.json> --out <dir> [--today YYYY-MM-DD]
//        [--candidates data/distribution/candidates.json] [--ledger data/distribution/posted-topics.json]
//
// The snapshot comes from `node scripts/organic-engine-qa.mjs snapshot dist <file>`.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildQueue, renderQueueMarkdown } from "./lib/distribution-queue.mjs";

function arg(argv, name, fallback) {
	const i = argv.indexOf(name);
	return i >= 0 ? argv[i + 1] : fallback;
}

export function contextFromSnapshot(snapshot, ledger, today) {
	const pages = Object.entries(snapshot.pages);
	return {
		today,
		builtPages: new Set(pages.map(([p]) => p)),
		sitemap: new Set(snapshot.sitemap),
		noindexPages: new Set(pages.filter(([, f]) => (f.robots ?? []).some((r) => /noindex/i.test(r ?? ""))).map(([p]) => p)),
		ledger,
	};
}

function main(argv) {
	const snapshotPath = arg(argv, "--snapshot");
	const outDir = arg(argv, "--out");
	if (!snapshotPath || !outDir) {
		console.error("usage: build-distribution-queue.mjs --snapshot <file> --out <dir> [--today YYYY-MM-DD]");
		return 2;
	}
	const today = arg(argv, "--today", new Date().toISOString().slice(0, 10));
	const candidates = JSON.parse(readFileSync(arg(argv, "--candidates", "data/distribution/candidates.json"), "utf8")).candidates;
	const ledger = JSON.parse(readFileSync(arg(argv, "--ledger", "data/distribution/posted-topics.json"), "utf8")).entries;
	const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
	const queue = buildQueue(candidates, contextFromSnapshot(snapshot, ledger, today));
	mkdirSync(outDir, { recursive: true });
	writeFileSync(join(outDir, "review-queue.json"), JSON.stringify(queue, null, 2));
	writeFileSync(join(outDir, "review-queue.md"), renderQueueMarkdown(queue));
	console.log(JSON.stringify(queue.counts));
	return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));
