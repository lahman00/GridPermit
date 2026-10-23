#!/usr/bin/env node
// Organic engine measurement report. Local files only.
//
//   node scripts/build-organic-report.mjs --base <snapshot.json> --head <snapshot.json> --out <dir>
//        [--metrics-before <private-export.json> --metrics-after <private-export.json>]
//        [--gsc-before <export.json> --gsc-after <export.json> --change-date YYYY-MM-DD]
//        [--today YYYY-MM-DD] [--registry data/content-links/registry.json] [--slice content_links|balanced_related]
//
// Snapshots come from `scripts/organic-engine-qa.mjs snapshot`. Metrics files
// are PRIVATE operator exports of GA4/GSC aggregates, shaped as
//   { "source": "...", "range": "YYYY-MM-DD..YYYY-MM-DD", "pages": { "/path/": { "organic_entrances": 12, ... } } }
// and must stay outside the repository. Omitted metrics are UNKNOWN, not zero.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { behaviourReport, compareStructural, gscSliceComparison, renderReportMarkdown } from "./lib/organic-report.mjs";
import { parseGscExport } from "./lib/search-opportunities.mjs";
import { assertOutsideRepo } from "./lib/private-output.mjs";

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
	// The search comparison writes private GSC aggregates; behaviour exports are private too.
	if (arg(argv, "--gsc-before") || arg(argv, "--gsc-after") || arg(argv, "--metrics-before") || arg(argv, "--metrics-after")) {
		try {
			assertOutsideRepo(outDir);
		} catch (e) {
			console.error(e.message);
			return 2;
		}
	}
	const registry = readJson(arg(argv, "--registry", "data/content-links/registry.json"));
	const base = readJson(basePath);
	const head = readJson(headPath);
	const sliceName = arg(argv, "--slice", "content_links");
	const balanced = sliceName === "balanced_related";
	if (balanced && !registry.balanced_related?.control_pages?.length) throw new Error("registry.balanced_related.control_pages is required for --slice balanced_related");
	const targets = balanced ? [...registry.balanced_related.pages].sort() : [...new Set(registry.resources.map((r) => r.url))].sort();
	const slicePages = balanced ? [...registry.balanced_related.pages].sort() : [...registry.rollout.locality_pages, ...registry.rollout.utility_hubs].sort();
	const mb = arg(argv, "--metrics-before");
	const ma = arg(argv, "--metrics-after");
	// Control: unchanged guides on the same utilities (same page type, same state), never a rollout page.
	const control = balanced
		? [...registry.balanced_related.control_pages].sort()
		: Object.keys(head.pages)
				.filter((p) => /^\/california\/[a-z-]+\/solar-permit-guide\/$/.test(p) && !slicePages.includes(p))
				.sort();
	const report = {
		generated_for: arg(argv, "--today", new Date().toISOString().slice(0, 10)),
		structural: compareStructural(base, head, targets),
		behaviour: mb && ma ? behaviourReport({ before: readJson(mb), after: readJson(ma), slicePages, controlPages: control }) : null,
		search_comparison:
			arg(argv, "--gsc-before") && arg(argv, "--gsc-after")
				? gscSliceComparison({
						before: parseGscExport(readFileSync(arg(argv, "--gsc-before"), "utf8")),
						after: parseGscExport(readFileSync(arg(argv, "--gsc-after"), "utf8")),
						slicePages,
						controlPages: control,
						changeDate: arg(argv, "--change-date"),
					})
				: null,
	};
	mkdirSync(outDir, { recursive: true });
	writeFileSync(join(outDir, "organic-report.json"), JSON.stringify(report, null, 2));
	writeFileSync(join(outDir, "organic-report.md"), renderReportMarkdown(report));
	console.log(JSON.stringify({ targets: targets.length, behaviour: report.behaviour ? report.behaviour.verdict : "NO_EXPORT_SUPPLIED" }));
	return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));
