// CID reconciliation engine.
//
// Decodes a CompareSolarPrices partner report's CIDs against GridPermit's
// known CID contract (src/components/CompareSolarPricesCTA.astro). This is
// a DECODER, not a click-matcher: GridPermit's CTA generates each CID
// client-side with no persistent server-side storage (by design - see the
// "cid is never written to any persistent client-side storage" test in
// tests/compare-solar-prices.test.mjs), so there is no GridPermit-side click
// ledger to join against. "GridPermit click" in the classification below
// means "this CID's shape is consistent with a real GridPermit-issued CID
// for the route/source its prefix encodes", not "found in a database".
//
// Usage:
//   node scripts/cid-reconcile.mjs <path-to-partner-report.csv-or-json>
// Input: a CSV with a `cid` column, or a JSON array of strings or
// {cid: ...} objects, or a newline-separated plain text list (for a quick
// pasted CID list).
// Output: output/revenue-intelligence/CID_RECONCILIATION_<timestamp>.json

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Mirrors src/components/CompareSolarPricesCTA.astro exactly - keep in sync
// if that file's prefix map ever changes.
export const ROUTE_CID_PREFIXES = {
	e101: { route: "/california/escondido/solar-permit-guide/", city: "Escondido", kind: "organic" },
	e102: { route: "/california/hemet/solar-permit-guide/", city: "Hemet", kind: "organic" },
	e103: { route: "/california/pomona/solar-permit-guide/", city: "Pomona", kind: "organic" },
	f101: { route: "/california/escondido/solar-permit-guide/", city: "Escondido", kind: "owned_source", source_tag: "fl_src_01" },
	f102: { route: "/california/hemet/solar-permit-guide/", city: "Hemet", kind: "owned_source", source_tag: "fl_src_02" },
	f103: { route: "/california/pomona/solar-permit-guide/", city: "Pomona", kind: "owned_source", source_tag: "fl_src_03" },
};
// f104-f106 are reserved in the CTA's own collision-avoidance regex
// (/^(?:e10[1-3]|f10[1-6])/) but not yet assigned to any real source slot.
export const RESERVED_UNASSIGNED_PREFIXES = ["f104", "f105", "f106"];

const CID_SHAPE = /^[0-9a-f]{24}$/; // exact shape produced by generateCompareSolarCid()
const GENERAL_VALID_SHAPE = /^[A-Za-z0-9_-]{1,32}$/; // isValidCompareSolarCid()'s broader rule

export function decodeCid(rawCid) {
	const cid = typeof rawCid === "string" ? rawCid.trim() : "";
	if (!cid) return { cid: rawCid, classification: "MALFORMED", reason: "empty or non-string value" };
	if (!GENERAL_VALID_SHAPE.test(cid)) {
		return { cid, classification: "MALFORMED", reason: "fails the general CID charset/length rule (1-32 chars, [A-Za-z0-9_-])" };
	}
	if (!CID_SHAPE.test(cid)) {
		// Passes the general rule but isn't the exact 24-lowercase-hex shape
		// GridPermit's own generator produces - could be a hand-typed test
		// value, a different partner's CID format, or truncation.
		return { cid, classification: "UNKNOWN_CID", reason: "does not match GridPermit's 24-lowercase-hex CID shape" };
	}
	const prefix = cid.slice(0, 4);
	if (RESERVED_UNASSIGNED_PREFIXES.includes(prefix)) {
		return { cid, classification: "RESERVED_PREFIX_ANOMALY", reason: `prefix ${prefix} is reserved but not yet assigned to any real source slot - should not occur in real traffic yet` };
	}
	const decoded = ROUTE_CID_PREFIXES[prefix];
	if (decoded) {
		return { cid, classification: "MATCHED", route: decoded.route, city: decoded.city, kind: decoded.kind, source_tag: decoded.source_tag ?? null };
	}
	return { cid, classification: "MATCHED_ORGANIC_NON_COHORT", reason: "well-formed CID with no reserved first-lead-cohort prefix - expected for the ~61 other CompareSolarPrices-eligible cities, which do not have route-coded prefixes" };
}

function parseInput(filePath) {
	const raw = readFileSync(filePath, "utf8");
	const ext = path.extname(filePath).toLowerCase();
	if (ext === ".json") {
		const data = JSON.parse(raw);
		if (!Array.isArray(data)) throw new Error("JSON input must be an array of CID strings or {cid: ...} objects");
		return data.map((row) => (typeof row === "string" ? row : row?.cid));
	}
	if (ext === ".csv") {
		const lines = raw.split("\n").map((l) => l.replace(/\r$/, "")).filter(Boolean);
		const header = lines[0].split(",");
		const cidCol = header.findIndex((h) => h.trim().toLowerCase() === "cid");
		if (cidCol === -1) throw new Error(`CSV must have a "cid" column; found columns: ${header.join(", ")}`);
		return lines.slice(1).map((line) => line.split(",")[cidCol]);
	}
	// Plain text: one CID per line, ignore blank lines.
	return raw.split("\n").map((l) => l.trim()).filter(Boolean);
}

export function reconcile(rawCids) {
	const seen = new Map();
	const results = [];
	for (const rawCid of rawCids) {
		const decoded = decodeCid(rawCid);
		const key = typeof rawCid === "string" ? rawCid.trim() : String(rawCid);
		if (seen.has(key)) {
			results.push({ ...decoded, classification: "DUPLICATE", reason: `duplicate of a CID already seen earlier in this same report (first seen at index ${seen.get(key)})` });
		} else {
			seen.set(key, results.length);
			results.push(decoded);
		}
	}
	const summary = {};
	for (const r of results) summary[r.classification] = (summary[r.classification] ?? 0) + 1;
	return { count: results.length, summary, results };
}

function main() {
	const inputPath = process.argv[2];
	if (!inputPath) {
		console.error("Usage: node scripts/cid-reconcile.mjs <path-to-partner-report.csv|.json|.txt>");
		process.exit(1);
	}
	const rawCids = parseInput(inputPath);
	const report = reconcile(rawCids);
	mkdirSync(path.join(REPO_ROOT, "output/revenue-intelligence"), { recursive: true });
	const outPath = path.join(REPO_ROOT, "output/revenue-intelligence", `CID_RECONCILIATION_${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
	writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
	console.log(`Reconciled ${report.count} CIDs:`, report.summary);
	console.log(`Written to ${path.relative(REPO_ROOT, outPath)}`);
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) main();
