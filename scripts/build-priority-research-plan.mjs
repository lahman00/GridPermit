#!/usr/bin/env node

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assessReadyCoreQuality } from "../src/lib/ready-quality.ts";
import { citySlug } from "../src/lib/locality-guide.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = path.join(REPO_ROOT, "output", "audit-driven-gridpermit-2026-10-12");

const PRIORITY_CITIES = [
	"Irvine",
	"Los Angeles",
	"San Diego",
	"San José",
	"San Francisco",
	"Sacramento",
	"Fresno",
	"Long Beach",
	"Oakland",
	"Bakersfield",
	"Anaheim",
	"Santa Ana",
	"Riverside",
	"Stockton",
];

const FIELD_TARGETS = {
	permit_fees: "Issuing authority's adopted fee schedule, fee resolution, or official permit-fee calculator; record scope and effective date.",
	timeline_days: "Issuing authority's residential solar/PV checklist, service standard, or plan-review turnaround page; exclude commercial-only timing from headline bounds.",
	inspection_steps: "Issuing authority's residential PV inspection checklist, inspection sequence, or correction guide.",
	required_documents: "Issuing authority's current residential PV submittal checklist or permit portal instructions.",
	permit_authority: "City/county building department or municipal code naming the issuing authority.",
	utility: "Utility service-territory page or regulator-approved service-area source; do not infer from neighboring cities.",
};
const OFFICIAL_SOURCE_TYPES = new Set(["government", "utility", "cpuc", "puc", "program_administrator", "other_official"]);

function csvCell(value) {
	const text = String(value ?? "");
	return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const records = readdirSync(path.join(REPO_ROOT, "data", "localities"))
	.filter((name) => name.endsWith(".json"))
	.map((name) => JSON.parse(readFileSync(path.join(REPO_ROOT, "data", "localities", name), "utf8")));

const rows = PRIORITY_CITIES.map((city, index) => {
	const record = records.find((candidate) => candidate.state === "CA" && candidate.city?.value === city);
	if (!record) throw new Error(`Missing canonical California record for ${city}`);
	const quality = assessReadyCoreQuality(record);
	const tasks = [...quality.missingCoreFields];
	for (const field of quality.lowConfidenceCoreFields) if (!tasks.includes(field)) tasks.push(field);
	if (tasks.length === 0) tasks.push("REVERIFY_EXISTING_CORE_FACTS");
	const sourceIds = new Set(
		Object.values(record)
			.filter((field) => field && typeof field === "object" && Array.isArray(field.source_ids))
			.flatMap((field) => field.source_ids),
	);
	const currentOfficialSources = record.sources
		.filter((source) => sourceIds.has(source.id) && OFFICIAL_SOURCE_TYPES.has(source.type))
		.map((source) => `${source.publisher}: ${source.url}`);
	return {
		priority: index + 1,
		city,
		route: `/california/${citySlug(city)}/solar-permit-guide/`,
		recordId: record.record_id,
		lastVerified: record.last_verified,
		missing: quality.missingCoreFields,
		lowConfidence: quality.lowConfidenceCoreFields,
		tasks,
		traffic: city === "Irvine" ? "19 impressions / 0 clicks" : "Unknown — full private GSC export unavailable",
		trafficWindow: city === "Irvine" ? "2026-09-11/2026-10-08" : "Not available",
		permitUrl: record.permit_url?.value ?? "Not yet verified",
		currentOfficialSources,
	};
});

const csvHeader = [
	"priority", "city", "route", "record_id", "last_verified", "missing_core_fields",
	"low_confidence_core_fields", "research_action", "traffic_evidence", "traffic_window", "official_start_url",
];
const csv = [
	csvHeader.join(","),
	...rows.map((row) => [
		row.priority, row.city, row.route, row.recordId, row.lastVerified,
		row.missing.join("|"), row.lowConfidence.join("|"), row.tasks.join("|"),
		row.traffic, row.trafficWindow, row.permitUrl,
	].map(csvCell).join(",")),
].join("\n") + "\n";

const sections = rows.map((row) => {
	const taskLines = row.tasks.map((field) => {
		if (field === "REVERIFY_EXISTING_CORE_FACTS") {
			return "- Reverify the six current core facts against their existing official sources; change nothing unless the source now supports a different fact.";
		}
		const action = row.missing.includes(field) ? "Complete" : "Strengthen";
		return `- ${action} \`${field}\`: ${FIELD_TARGETS[field] ?? "Use the issuing authority's current first-party documentation."}`;
	}).join("\n");
	const sources = row.currentOfficialSources.length
		? row.currentOfficialSources.map((source) => `  - ${source}`).join("\n")
		: "  - No currently linked core-fact source; begin at the official permit URL below.";
	return `### ${row.priority}. ${row.city}\n\n- Route: \`${row.route}\`\n- Record: \`${row.recordId}\`\n- Last verified: ${row.lastVerified}\n- Traffic evidence: ${row.traffic}${row.trafficWindow === "Not available" ? "" : ` (${row.trafficWindow})`}\n- Missing core fields: ${row.missing.length ? row.missing.map((field) => `\`${field}\``).join(", ") : "none"}\n- Low-confidence core fields: ${row.lowConfidence.length ? row.lowConfidence.map((field) => `\`${field}\``).join(", ") : "none"}\n- Official starting URL: ${row.permitUrl}\n\n${taskLines}\n\nCurrent official source trail:\n${sources}`;
}).join("\n\n");

const markdown = `# GridPermit Priority-14 Official-Source Research Plan\n\nGenerated: 2026-10-12\n\n## Purpose and ordering\n\nThis plan completes or strengthens core permit facts for the 14 owner-selected California cities without changing publication status. Irvine is first because the retained dated GSC derivative records 19 impressions and 0 clicks for 2026-09-11 through 2026-10-08. The full private GSC export was not available for this run, so no traffic metric is invented for the other 13 cities; they retain the owner's supplied priority order.\n\n## Evidence gate\n\nAccept only a current first-party source from the issuing city/county, the serving utility, a California regulator, or the administrator of the official program. For every accepted fact, save the direct URL, publisher, exact section/page or supporting excerpt, accessed date, field scope, and confidence. A search result, contractor page, aggregator, neighboring jurisdiction, or an unsupported inference cannot populate a fact. If the official source does not state the answer, leave the value unverified. Residential headline ranges must exclude commercial/non-residential figures, which may remain only as labelled context in notes.\n\n## Execution protocol\n\n1. Open the existing official permit URL and identify the current residential PV checklist, fee schedule, inspection guide, and service-standard pages.\n2. Archive the direct official URL and capture the precise supporting section. For PDFs, record page number and document effective date.\n3. Update one field at a time and attach only the source IDs that directly support it.\n4. Run schema validation, READY-quality audit, page tests, and a rendered-page check after each city.\n5. Do not infer fees, timing, inspection steps, jurisdiction, or utility coverage. Do not change index status merely because research remains incomplete.\n\n## City plan\n\n${sections}\n\n## Completion definition\n\nA city is complete for this sprint only when every targeted field is either supported by a current official source or explicitly left unverified with the attempted official sources recorded. Completion does not authorize push, deployment, or production indexation changes.\n`;

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(path.join(OUTPUT_DIR, "PRIORITY_14_RESEARCH_PLAN.csv"), csv, "utf8");
writeFileSync(path.join(OUTPUT_DIR, "PRIORITY_14_RESEARCH_PLAN.md"), markdown, "utf8");
console.log(`Wrote ${rows.length} priority-city rows to ${path.relative(REPO_ROOT, OUTPUT_DIR)}`);
