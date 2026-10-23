#!/usr/bin/env node
// Converts a GA4 report CSV export into the normalized GA4 contract that
// parseGa4Export (scripts/lib/growth-funnel.mjs) reads. Local files only: no
// network, no Google API call, no credential. It adds no tracking.
//
//   node --experimental-strip-types scripts/ga4-report-to-export.mjs \
//     --sessions <landing-page x source/medium report.csv> \
//     [--events <landing-page x source/medium x event name report.csv>] \
//     --mapping <column-mapping.json> --property-id <numeric GA4 property id> \
//     --start YYYY-MM-DD --end YYYY-MM-DD --out <file outside the repo>
//
// Column names are never assumed: the operator maps the CSV header names to the
// fixed internal fields in an explicit mapping file. Any CSV column that is not
// in the mapping is rejected (an unmapped column could hold personal data). The
// output file is private (it holds traffic metrics) and the script refuses to
// write inside the repository or over an existing file.
//
// Mapping file shape (header values are whatever the operator's CSV really says):
//   { "sessions_report": { "landing_page": "<header>", "source": "<header>", "medium": "<header>",
//                          "sessions": "<header>", "engaged_sessions": "<header, optional>" },
//     "events_report":   { "landing_page": "<header>", "source": "<header>", "medium": "<header>",
//                          "event_name": "<header>", "event_count": "<header>" } }
// "source_medium" (one combined "a / b" column) may replace "source" + "medium".

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { ANALYTICS_EVENTS } from "../src/lib/analytics-events.ts";
import { parseGa4Export } from "./lib/growth-funnel.mjs";
import { assertOutsideRepo } from "./lib/private-output.mjs";

const SESSIONS_FIELDS = ["landing_page", "source", "medium", "source_medium", "sessions", "engaged_sessions"];
const EVENTS_FIELDS = ["landing_page", "source", "medium", "source_medium", "event_name", "event_count"];
const LANDING_PAGE = /^\/[a-z0-9\-/]*$/;
const SEGMENT = /^[\x20-\x7e]{1,100}$/;
const EVENT_NAME = /^[a-z][a-z0-9_]{0,39}$/;
const isIso = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;

// Header names that look personal. They can never be mapped or tolerated, even if
// the operator lists them: the error names the column so it can be removed from the report.
const PERSONAL_HEADER = /\b(e-?mail|user[\s_-]?id|client[\s_-]?id|user[\s_-]?pseudo[\s_-]?id|device[\s_-]?id|ip|ip[\s_-]?address|phone|first[\s_-]?name|last[\s_-]?name|full[\s_-]?name|zip|zip[\s_-]?code|postal|street|address|city|region|latitude|longitude|gender|age|cid)\b/i;

// RFC 4180 reader: quoted fields, doubled quotes, CRLF, BOM. Leading "#" lines
// (the metadata block GA4 writes above the table) are returned separately.
export function parseCsv(text) {
	const src = String(text).replace(/^﻿/, "");
	const lines = [];
	let row = [];
	let field = "";
	let quoted = false;
	let touched = false;
	for (let i = 0; i < src.length; i++) {
		const c = src[i];
		if (quoted) {
			if (c === '"') {
				if (src[i + 1] === '"') {
					field += '"';
					i++;
				} else quoted = false;
			} else field += c;
		} else if (c === '"' && field === "") {
			quoted = true;
			touched = true;
		} else if (c === ",") {
			row.push(field);
			field = "";
			touched = true;
		} else if (c === "\n" || c === "\r") {
			if (c === "\r" && src[i + 1] === "\n") i++;
			if (touched || field !== "") {
				row.push(field);
				lines.push(row);
			}
			row = [];
			field = "";
			touched = false;
		} else {
			field += c;
			touched = true;
		}
	}
	if (quoted) throw new Error("CSV has an unterminated quoted field");
	if (touched || field !== "") {
		row.push(field);
		lines.push(row);
	}
	const comments = [];
	let start = 0;
	while (start < lines.length && lines[start].length >= 1 && String(lines[start][0]).startsWith("#")) {
		comments.push(lines[start].join(","));
		start++;
	}
	const body = lines.slice(start).filter((r) => !(r.length === 1 && r[0].trim() === ""));
	if (body.length === 0) throw new Error("CSV has no header row");
	return { comments, header: body[0].map((h) => h.trim()), rows: body.slice(1) };
}

// GA4 UI exports start with "# Start date: 20260921" style lines. That format is
// an assumption (see docs/MEASUREMENT_EXPORT_GUIDE.md); when present it is only
// cross-checked against the operator's explicit window, never used instead of it.
function commentDate(comments, label) {
	for (const c of comments) {
		const m = new RegExp(`^#\\s*${label}\\s*date\\s*:\\s*(\\d{4})-?(\\d{2})-?(\\d{2})\\s*$`, "i").exec(c.trim());
		if (m) return `${m[1]}-${m[2]}-${m[3]}`;
	}
	return null;
}

export function validateMapping(mapping) {
	if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) throw new Error("mapping must be a JSON object");
	const check = (name, fields, required) => {
		const m = mapping[name];
		if (m === undefined) {
			if (name === "events_report") return null;
			throw new Error(`mapping.${name} is required`);
		}
		if (!m || typeof m !== "object" || Array.isArray(m)) throw new Error(`mapping.${name} must be an object`);
		for (const [k, v] of Object.entries(m)) {
			if (!fields.includes(k)) throw new Error(`mapping.${name} has an unknown field: ${k}`);
			if (typeof v !== "string" || !v.trim()) throw new Error(`mapping.${name}.${k} must be a non-empty header name`);
			if (PERSONAL_HEADER.test(v)) throw new Error(`mapping.${name}.${k} points to a column that looks personal (${v}); remove it from the report`);
		}
		const seen = new Set();
		for (const v of Object.values(m)) {
			if (seen.has(v.trim())) throw new Error(`mapping.${name} maps one CSV column to more than one field: ${v}`);
			seen.add(v.trim());
		}
		for (const k of required) if (!m[k]) throw new Error(`mapping.${name}.${k} is required`);
		const split = Boolean(m.source) && Boolean(m.medium);
		const partial = Boolean(m.source) !== Boolean(m.medium);
		if (partial || split === Boolean(m.source_medium)) throw new Error(`mapping.${name} needs either source + medium, or source_medium (not both, not partial)`);
		return m;
	};
	for (const k of Object.keys(mapping)) if (!["sessions_report", "events_report"].includes(k)) throw new Error(`mapping has an unknown key: ${k}`);
	return {
		sessions: check("sessions_report", SESSIONS_FIELDS, ["landing_page", "sessions"]),
		events: check("events_report", EVENTS_FIELDS, ["landing_page", "event_name", "event_count"]),
	};
}

function strictCount(v, where) {
	const s = String(v ?? "").trim();
	if (!/^\d{1,12}$/.test(s)) throw new Error(`${where}: not a plain non-negative integer: ${JSON.stringify(s.slice(0, 20))}`);
	return Number(s);
}

function tableToRecords(csv, map, where) {
	const { header, rows } = csv;
	const dup = header.find((h, i) => header.indexOf(h) !== i);
	if (dup !== undefined) throw new Error(`${where}: duplicate column header: ${dup}`);
	const mapped = new Set(Object.values(map).map((v) => v.trim()));
	for (const h of header) {
		if (!mapped.has(h)) {
			throw new Error(`${where}: unmapped column "${h}" rejected${PERSONAL_HEADER.test(h) ? " (looks personal)" : ""}; export only the columns listed in the mapping`);
		}
	}
	const index = {};
	for (const [field, name] of Object.entries(map)) {
		const i = header.indexOf(name.trim());
		if (i < 0) throw new Error(`${where}: mapped column "${name}" for ${field} not found in the CSV header`);
		index[field] = i;
	}
	return rows.map((cells, n) => {
		if (cells.length !== header.length) throw new Error(`${where}: row ${n + 1} has ${cells.length} cells, expected ${header.length}`);
		const get = (f) => (index[f] === undefined ? undefined : cells[index[f]].trim());
		return { n: n + 1, get };
	});
}

function sourceMedium(get, where, n) {
	let source;
	let medium;
	if (get("source_medium") !== undefined) {
		const sm = get("source_medium");
		const at = sm.lastIndexOf(" / ");
		if (at < 0) throw new Error(`${where} row ${n}: source / medium value has no " / " separator`);
		source = sm.slice(0, at).trim();
		medium = sm.slice(at + 3).trim();
	} else {
		source = get("source");
		medium = get("medium");
	}
	for (const v of [source, medium]) if (!SEGMENT.test(v) || v.includes("@")) throw new Error(`${where} row ${n}: invalid source/medium value`);
	return { source, medium };
}

function landingPage(raw, where, n) {
	if (raw.includes("?") || raw.includes("#")) throw new Error(`${where} row ${n}: landing page carries a query string or fragment; export "Landing page" (path only), not "Landing page + query string"`);
	if (!LANDING_PAGE.test(raw)) throw new Error(`${where} row ${n}: landing page is not a site path (a totals row or an unexpected value?)`);
	return raw;
}

// Returns { export, summary }. `export` always passes parseGa4Export.
export function convertGa4Csv({ sessionsCsv, eventsCsv = null, mapping, propertyId, windowStart, windowEnd }) {
	if (!/^\d{1,20}$/.test(String(propertyId ?? ""))) throw new Error("property id must be the numeric GA4 property id");
	if (!isIso(windowStart) || !isIso(windowEnd) || windowStart > windowEnd) throw new Error("window must be two ISO dates (YYYY-MM-DD) with start <= end");
	const maps = validateMapping(mapping);
	if (eventsCsv !== null && !maps.events) throw new Error("an events CSV was given but mapping.events_report is missing");
	const known = new Set(ANALYTICS_EVENTS);

	const checkWindow = (comments, where) => {
		const s = commentDate(comments, "start");
		const e = commentDate(comments, "end");
		if ((s && s !== windowStart) || (e && e !== windowEnd)) throw new Error(`${where}: the file's own date range (${s ?? "?"}..${e ?? "?"}) differs from --start/--end (${windowStart}..${windowEnd})`);
	};

	const sCsv = parseCsv(sessionsCsv);
	checkWindow(sCsv.comments, "sessions report");
	const sessionRows = new Map();
	let duplicatesSuppressed = 0;
	let notSetRows = 0;
	for (const r of tableToRecords(sCsv, maps.sessions, "sessions report")) {
		const rawPage = r.get("landing_page");
		if (rawPage === "(not set)") {
			notSetRows++;
			continue;
		}
		const page = landingPage(rawPage, "sessions report", r.n);
		const { source, medium } = sourceMedium(r.get, "sessions report", r.n);
		const sessions = strictCount(r.get("sessions"), `sessions report row ${r.n} sessions`);
		const engaged = maps.sessions.engaged_sessions ? strictCount(r.get("engaged_sessions"), `sessions report row ${r.n} engaged sessions`) : undefined;
		if (engaged !== undefined && engaged > sessions) throw new Error(`sessions report row ${r.n}: engaged sessions exceed sessions`);
		const key = `${page}|${source}|${medium}`;
		const prior = sessionRows.get(key);
		if (prior) {
			if (prior.sessions !== sessions || prior.engaged_sessions !== engaged) throw new Error(`sessions report row ${r.n}: conflicting duplicate of an earlier row for the same landing page, source and medium`);
			duplicatesSuppressed++;
			continue;
		}
		sessionRows.set(key, { landing_page: page, source, medium, sessions, ...(engaged === undefined ? {} : { engaged_sessions: engaged }), events: {} });
	}
	if (sessionRows.size === 0) throw new Error("sessions report has no usable rows");

	const present = new Set();
	const ignoredEvents = new Set();
	let eventDuplicates = 0;
	if (eventsCsv !== null) {
		const eCsv = parseCsv(eventsCsv);
		checkWindow(eCsv.comments, "events report");
		const seen = new Map();
		const orphans = [];
		for (const r of tableToRecords(eCsv, maps.events, "events report")) {
			const name = r.get("event_name");
			if (!EVENT_NAME.test(name)) throw new Error(`events report row ${r.n}: invalid event name`);
			const rawPage = r.get("landing_page");
			if (rawPage === "(not set)") continue;
			const page = landingPage(rawPage, "events report", r.n);
			const { source, medium } = sourceMedium(r.get, "events report", r.n);
			const count = strictCount(r.get("event_count"), `events report row ${r.n} event count`);
			if (!known.has(name)) {
				// GA4 reports its automatic events too (page_view, session_start, ...). They are
				// outside the closed analytics list, so they are dropped and named, not ingested.
				ignoredEvents.add(name);
				continue;
			}
			const key = `${page}|${source}|${medium}`;
			const dupKey = `${key}|${name}`;
			if (seen.has(dupKey)) {
				if (seen.get(dupKey) !== count) throw new Error(`events report row ${r.n}: conflicting duplicate for ${name}`);
				eventDuplicates++;
				continue;
			}
			seen.set(dupKey, count);
			const target = sessionRows.get(key);
			if (!target) {
				orphans.push(`${page} (${source} / ${medium})`);
				continue;
			}
			target.events[name] = count;
			present.add(name);
		}
		// An event row for a landing page / source / medium absent from the sessions report cannot be
		// placed without inventing a session count, so the whole conversion fails closed.
		if (orphans.length) throw new Error(`events report has ${orphans.length} row(s) with no matching row in the sessions report, e.g. ${orphans.slice(0, 3).join("; ")}. Use the same filters and date range in both reports.`);
	}

	const out = {
		evidence_type: "ga4_report_export",
		property_id: String(propertyId),
		window_start: windowStart,
		window_end: windowEnd,
		events_included: [...present].sort(),
		rows: [...sessionRows.values()].sort((a, b) => a.landing_page.localeCompare(b.landing_page) || a.source.localeCompare(b.source) || a.medium.localeCompare(b.medium)),
	};
	// The converter is only correct if the consumer accepts what it wrote.
	parseGa4Export(JSON.stringify(out));
	return {
		export: out,
		summary: {
			rows: out.rows.length,
			events_included: out.events_included,
			events_report_supplied: eventsCsv !== null,
			events_dropped_outside_closed_list: [...ignoredEvents].sort(),
			rows_with_not_set_landing_page_excluded: notSetRows,
			duplicate_rows_suppressed: duplicatesSuppressed + eventDuplicates,
		},
	};
}

const arg = (argv, name) => {
	const i = argv.indexOf(name);
	return i >= 0 ? argv[i + 1] : undefined;
};

export function main(argv) {
	const sessions = arg(argv, "--sessions");
	const mappingPath = arg(argv, "--mapping");
	const out = arg(argv, "--out");
	if (!sessions || !mappingPath || !out || !arg(argv, "--property-id") || !arg(argv, "--start") || !arg(argv, "--end")) {
		console.error("usage: ga4-report-to-export.mjs --sessions <csv> [--events <csv>] --mapping <json> --property-id <id> --start YYYY-MM-DD --end YYYY-MM-DD --out <file outside the repo>");
		return 2;
	}
	try {
		assertOutsideRepo(out);
		const events = arg(argv, "--events");
		const result = convertGa4Csv({
			sessionsCsv: readFileSync(sessions, "utf8"),
			eventsCsv: events ? readFileSync(events, "utf8") : null,
			mapping: JSON.parse(readFileSync(mappingPath, "utf8")),
			propertyId: arg(argv, "--property-id"),
			windowStart: arg(argv, "--start"),
			windowEnd: arg(argv, "--end"),
		});
		writeFileSync(out, `${JSON.stringify(result.export, null, 2)}\n`, { flag: "wx" });
		console.log(JSON.stringify({ out, ...result.summary }));
		return 0;
	} catch (e) {
		console.error(e.message);
		return 2;
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));
