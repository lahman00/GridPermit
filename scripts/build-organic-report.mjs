#!/usr/bin/env node
// Organic engine measurement report. Local files only.
//
//   node scripts/build-organic-report.mjs --base <snapshot.json> --head <snapshot.json> --out <dir>
//        [--metrics-before <private-export.json> --metrics-after <private-export.json>]
//        [--today YYYY-MM-DD] [--registry data/content-links/registry.json]
//
// Snapshots come from `scripts/organic-engine-qa.mjs snapshot`. Metrics files
// are PRIVATE operator exports of GA4/GSC aggregates, shaped as
//   { "source": "...", "range": "YYYY-MM-DD..YYYY-MM-DD", "pages": { "/path/": { "organic_entrances": 12, ... } } }
// and must stay outside the repository. Omitted metrics are UNKNOWN, not zero.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { behaviourReport, compareStructural, renderReportMarkdown } from "./lib/organic-report.mjs";

const arg = (argv, name, fallback) => {
	const i = argv.indexOf(name);
	return i >= 0 ? argv[i + 1] : fallback;
};
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

function main(argv) {
	const [basePath, headPath, outDir] = [arg(argv, "--base"), arg(argv, "--head"), arg(argv, "--out")];
	if (!basePath || !headPath || !outDir) {
		console.error("usage: build-organic-report.mjs --base <snap> --head <snap> --out <dir> [--metrics-before f --metrics-after f]");
		return 2;
	}
	const registry = readJson(arg(argv, "--registry", "data/content-links/registry.json"));
	const base = readJson(basePath);
	const head = readJson(headPath);
	const targets = [...new Set(registry.resources.map((r) => r.url))].sort();
	const slicePages = [...registry.rollout.locality_pages, ...registry.rollout.utility_hubs].sort();
	const mb = arg(argv, "--metrics-before");
	const ma = arg(argv, "--metrics-after");
	// Control: unchanged guides on the same utilities (same page type, same state), never a rollout page.
	const control = Object.keys(head.pages)
		.filter((p) => /^\/california\/[a-z-]+\/solar-permit-guide\/$/.test(p) && !slicePages.includes(p))
		.sort();
	const report = {
		generated_for: arg(argv, "--today", new Date().toISOString().slice(0, 10)),
		structural: compareStructural(base, head, targets),
		behaviour: mb && ma ? behaviourReport({ before: readJson(mb), after: readJson(ma), slicePages, controlPages: control }) : null,
	};
	mkdirSync(outDir, { recursive: true });
	writeFileSync(join(outDir, "organic-report.json"), JSON.stringify(report, null, 2));
	writeFileSync(join(outDir, "organic-report.md"), renderReportMarkdown(report));
	console.log(JSON.stringify({ targets: targets.length, behaviour: report.behaviour ? report.behaviour.verdict : "NO_EXPORT_SUPPLIED" }));
	return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));
