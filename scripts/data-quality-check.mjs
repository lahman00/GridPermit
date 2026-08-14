#!/usr/bin/env node
// Cross-record structural data-quality check across every data/localities/*.json
// record — no network calls (see scripts/source-health-report.mjs for the live
// URL-liveness check, which is a separate, much slower pass). This script
// checks things a single-record validator (scripts/validate-record.mjs)
// can't see: duplicates across records, and state-code consistency against
// the canonical registry.
//
// Read-only. Prints a report; exits 1 if any check finds a real problem.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const LOCALITIES_DIR = path.join(REPO_ROOT, "data", "localities");

// Mirrors src/lib/state-meta.ts's STATE_META keys — kept as a separate
// literal here for the same isolation reason every other script's copy of
// this list documents (see scripts/evaluate-state-batch.mjs).
const VALID_STATE_CODES = new Set([
	"AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
	"HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
	"MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
	"NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
	"SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]);

function isSyntacticallyValidUrl(url) {
	try {
		const u = new URL(url);
		return u.protocol === "http:" || u.protocol === "https:";
	} catch {
		return false;
	}
}

async function main() {
	const files = (await readdir(LOCALITIES_DIR)).filter((f) => f.endsWith(".json"));
	const records = [];
	for (const f of files) {
		const raw = await readFile(path.join(LOCALITIES_DIR, f), "utf8");
		records.push({ file: f, data: JSON.parse(raw) });
	}

	const problems = [];

	// 1. Duplicate record_id across files
	const idToFiles = new Map();
	for (const { file, data } of records) {
		const id = data.record_id;
		if (!idToFiles.has(id)) idToFiles.set(id, []);
		idToFiles.get(id).push(file);
	}
	for (const [id, files] of idToFiles) {
		if (files.length > 1) problems.push(`DUPLICATE record_id "${id}" in: ${files.join(", ")}`);
	}

	// 2. record_id filename mismatch (record_id must equal the filename stem)
	for (const { file, data } of records) {
		const stem = file.replace(/\.json$/, "");
		if (data.record_id !== stem) {
			problems.push(`FILENAME MISMATCH: ${file} has record_id "${data.record_id}" (expected "${stem}")`);
		}
	}

	// 3. Duplicate city+state (two different localities claiming the same city/state)
	const cityStateToFiles = new Map();
	for (const { file, data } of records) {
		const city = data.city?.value;
		const state = data.state;
		if (!city || !state) continue;
		const key = `${state}::${city.toLowerCase()}`;
		if (!cityStateToFiles.has(key)) cityStateToFiles.set(key, []);
		cityStateToFiles.get(key).push(file);
	}
	for (const [key, files] of cityStateToFiles) {
		if (files.length > 1) {
			problems.push(`DUPLICATE city+state "${key}" across ${files.length} records: ${files.join(", ")}`);
		}
	}

	// 4. Invalid/unregistered state code
	for (const { file, data } of records) {
		if (!VALID_STATE_CODES.has(data.state)) {
			problems.push(`INVALID state code "${data.state}" in ${file}`);
		}
	}

	// 5. record_id prefix must match its own state field (lowercased state code)
	for (const { file, data } of records) {
		const prefix = data.record_id?.split("-")[0];
		const expectedPrefix = data.state?.toLowerCase();
		if (prefix && expectedPrefix && prefix !== expectedPrefix) {
			problems.push(`RECORD_ID/STATE MISMATCH: ${file} record_id prefix "${prefix}" does not match state "${data.state}"`);
		}
	}

	// 6. Malformed URLs (syntax only — no network call) across every source
	//    and every field's source URL. Live-reachability is checked
	//    separately by scripts/source-health-report.mjs.
	const urlFieldsToCheck = ["permit_url", "interconnection_url"];
	for (const { file, data } of records) {
		for (const field of urlFieldsToCheck) {
			const v = data[field]?.value;
			if (v && !isSyntacticallyValidUrl(v)) {
				problems.push(`MALFORMED URL in ${file} field "${field}": ${v}`);
			}
		}
		for (const s of data.sources ?? []) {
			if (s.url && !isSyntacticallyValidUrl(s.url)) {
				problems.push(`MALFORMED URL in ${file} sources[${s.id}]: ${s.url}`);
			}
		}
	}

	// 7. Duplicate source ids within one record (should already be caught by
	//    validate-record.mjs, re-checked here for a whole-dataset summary)
	for (const { file, data } of records) {
		const ids = (data.sources ?? []).map((s) => s.id);
		const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
		if (dupes.length > 0) {
			problems.push(`DUPLICATE source id(s) in ${file}: ${[...new Set(dupes)].join(", ")}`);
		}
	}

	// 8. Encoding sanity — no literal replacement characters or control chars
	//    in visible text fields (a sign of a botched copy/paste from a PDF).
	const REPLACEMENT_CHAR = "�";
	for (const { file, data } of records) {
		const json = JSON.stringify(data);
		if (json.includes(REPLACEMENT_CHAR)) {
			problems.push(`ENCODING ISSUE in ${file}: contains Unicode replacement character (U+FFFD)`);
		}
	}

	console.log(`Checked ${records.length} locality records across ${new Set(records.map((r) => r.data.state)).size} states.\n`);

	if (problems.length === 0) {
		console.log("No structural data-quality problems found.");
		process.exit(0);
	}

	console.log(`Found ${problems.length} problem(s):\n`);
	for (const p of problems) console.log(`  - ${p}`);
	process.exit(1);
}

// Direct-execution guard: main() only runs when this file is the process's
// entry point, never when it's imported (by a test or anything else).
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
	main().catch((err) => {
		console.error(err.stack ?? String(err));
		process.exit(1);
	});
}
