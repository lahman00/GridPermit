#!/usr/bin/env node
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stateSlug } from "../src/lib/state-meta.ts";
import { assessReadyCoreQuality, READY_CORE_FIELDS } from "./lib/ready-quality-policy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_RETAINED_GSC = path.join(ROOT, "output", "organic-growth-distribution-2026-10-11", "ORGANIC_GROWTH_OPPORTUNITIES.json");
const DEFAULT_RANKED_GSC = path.join(ROOT, "output", "commercial-seo-cro-2026-10-09", "PAGE_SELECTION.json");
const DEFAULT_OUT = path.join(ROOT, "output", "audit-driven-gridpermit-2026-10-12", "READY_QUALITY_AUDIT.csv");

function slugify(value) {
	return String(value ?? "")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function parseArgs(argv) {
	const args = { out: DEFAULT_OUT, gscDir: null };
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--out" && argv[i + 1]) args.out = path.resolve(argv[++i]);
		else if (argv[i] === "--gsc-dir" && argv[i + 1]) args.gscDir = path.resolve(argv[++i]);
		else throw new Error("Usage: build-ready-quality-audit.mjs [--out <csv>] [--gsc-dir <private-saved-gsc-dir>]");
	}
	return args;
}

function csvCell(value) {
	if (value === null || value === undefined) return "";
	const string = String(value);
	return /[",\n\r]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
}

function toCsv(rows) {
	const columns = [
		"traffic_priority",
		"city",
		"state",
		"route",
		"record_id",
		"verified_core_facts",
		"total_core_facts",
		"missing_core_fields",
		"missing_core_count",
		"minimum_populated_core_confidence",
		"low_confidence_core_fields",
		"populated_core_fields_missing_sources",
		"ready_quality_gate",
		"gsc_impressions",
		"gsc_clicks",
		"gsc_window",
		"traffic_evidence_status",
		"recommended_action",
	];
	return [columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\n") + "\n";
}

async function loadReadyIds() {
	const files = (await readdir(path.join(ROOT, "output"))).filter((name) => name.endsWith("-evaluation.json")).sort();
	const byId = new Map();
	for (const file of files) {
		const evaluation = JSON.parse(await readFile(path.join(ROOT, "output", file), "utf8"));
		for (const row of evaluation.records ?? []) {
			const prior = byId.get(row.record_id);
			if (prior && JSON.stringify(prior) !== JSON.stringify(row)) {
				throw new Error(`Conflicting evaluation rows for ${row.record_id}`);
			}
			byId.set(row.record_id, row);
		}
	}
	return new Set([...byId.values()].filter((row) => row.readiness === "READY").map((row) => row.record_id));
}

async function loadTrafficEvidence(gscDir) {
	const evidence = new Map();
	let window = "2026-09-11/2026-10-08";

	if (gscDir) {
		const pageData = JSON.parse(await readFile(path.join(gscDir, "current_page.json"), "utf8"));
		if (!Array.isArray(pageData.rows) || !pageData.start || !pageData.end) throw new Error("Invalid private current_page.json");
		window = `${pageData.start}/${pageData.end}`;
		for (const row of pageData.rows) {
			const url = new URL(row.keys?.[0]);
			evidence.set(url.pathname, {
				priorityGroup: 0,
				priorityRank: 0,
				impressions: row.impressions,
				clicks: row.clicks,
				status: "OBSERVED_PRIVATE_FINAL_GSC",
			});
		}
		return { evidence, window };
	}

	const [retained, ranked] = await Promise.all([
		readFile(DEFAULT_RETAINED_GSC, "utf8").then(JSON.parse),
		readFile(DEFAULT_RANKED_GSC, "utf8").then(JSON.parse),
	]);
	window = `${retained.evidence.window.start}/${retained.evidence.window.end}`;
	for (const item of retained.opportunities ?? []) {
		evidence.set(new URL(item.url).pathname, {
			priorityGroup: 2,
			priorityRank: item.rank,
			impressions: item.impressions,
			clicks: item.clicks,
			status: "OBSERVED_RETAINED_FINAL_GSC_DERIVATIVE",
		});
	}
	for (const item of ranked.pages ?? []) {
		evidence.set(item.path, {
			priorityGroup: 1,
			priorityRank: item.rank,
			impressions: null,
			clicks: 0,
			status: "RANK_ONLY_RETAINED_FINAL_GSC_DERIVATIVE",
		});
	}
	if (ranked.excluded_example?.path) {
		evidence.set(ranked.excluded_example.path, {
			priorityGroup: 0,
			priorityRank: 0,
			impressions: null,
			clicks: null,
			status: "VERIFIED_POSITIVE_CLICKS_EXACT_METRICS_UNAVAILABLE",
		});
	}
	return { evidence, window };
}

export async function buildReadyQualityAudit({ gscDir = null } = {}) {
	const [readyIds, localityFiles, traffic] = await Promise.all([
		loadReadyIds(),
		readdir(path.join(ROOT, "data", "localities")),
		loadTrafficEvidence(gscDir),
	]);
	const rows = [];
	for (const file of localityFiles.filter((name) => name.endsWith(".json")).sort()) {
		const record = JSON.parse(await readFile(path.join(ROOT, "data", "localities", file), "utf8"));
		if (!readyIds.has(record.record_id)) continue;
		const route = `/${stateSlug(record.state)}/${slugify(record.city?.value)}/solar-permit-guide/`;
		const quality = assessReadyCoreQuality(record);
		const observed = traffic.evidence.get(route) ?? null;
		rows.push({
			traffic_priority: null,
			city: record.city?.value ?? "UNKNOWN",
			state: record.state,
			route,
			record_id: record.record_id,
			verified_core_facts: quality.populatedCoreCount,
			total_core_facts: READY_CORE_FIELDS.length,
			missing_core_fields: quality.missingCoreFields.join("|"),
			missing_core_count: quality.missingCoreCount,
			minimum_populated_core_confidence: quality.minimumPopulatedCoreConfidence,
			low_confidence_core_fields: quality.lowConfidenceCoreFields.join("|"),
			populated_core_fields_missing_sources: quality.missingSourceCoreFields.join("|"),
			ready_quality_gate: quality.passesReadyQualityGate ? "PASS" : "FAIL_AUDIT_ONLY_NO_STATUS_CHANGE",
			gsc_impressions: observed?.impressions ?? null,
			gsc_clicks: observed?.clicks ?? null,
			gsc_window: observed ? traffic.window : null,
			traffic_evidence_status: observed?.status ?? "UNKNOWN_FULL_PRIVATE_EXPORT_UNAVAILABLE",
			recommended_action: quality.recommendedAction,
			_sort: observed
				? [observed.priorityGroup, observed.priorityRank, -(observed.clicks ?? -1), -(observed.impressions ?? -1)]
				: [9, 999, 1, 1],
		});
	}
	rows.sort((a, b) => {
		for (let i = 0; i < a._sort.length; i++) if (a._sort[i] !== b._sort[i]) return a._sort[i] - b._sort[i];
		return b.missing_core_count - a.missing_core_count || a.city.localeCompare(b.city);
	});
	for (const [index, row] of rows.entries()) {
		row.traffic_priority = index + 1;
		delete row._sort;
	}
	return rows;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const rows = await buildReadyQualityAudit({ gscDir: args.gscDir });
	await mkdir(path.dirname(args.out), { recursive: true });
	await writeFile(args.out, toCsv(rows), "utf8");
	const summary = rows.reduce((acc, row) => {
		acc[row.recommended_action] = (acc[row.recommended_action] ?? 0) + 1;
		return acc;
	}, {});
	console.log(JSON.stringify({ ok: true, output: args.out, rows: rows.length, summary }, null, 2));
}

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) await main();
