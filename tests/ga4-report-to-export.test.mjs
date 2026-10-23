// Unit tests for the GA4 CSV -> normalized contract converter. All data here is
// synthetic. Column names come from an explicit mapping, never from assumptions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { convertGa4Csv, parseCsv, validateMapping } from "../scripts/ga4-report-to-export.mjs";
import { parseGa4Export } from "../scripts/lib/growth-funnel.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const P = "/california/synthetic-city-a/solar-permit-guide/";
const mapping = {
	sessions_report: { landing_page: "LP", source: "SRC", medium: "MED", sessions: "S", engaged_sessions: "E" },
	events_report: { landing_page: "LP", source: "SRC", medium: "MED", event_name: "EV", event_count: "N" },
};
const base = { mapping, propertyId: "123456", windowStart: "2026-09-21", windowEnd: "2026-10-18" };
const SESS = `LP,SRC,MED,S,E\n${P},google,organic,10,6\n${P},linkedin,organic_social,4,2\n`;
const EVTS = `LP,SRC,MED,EV,N\n${P},google,organic,internal_resource_clicked,3\n`;
const run = (over = {}) => convertGa4Csv({ sessionsCsv: SESS, ...base, ...over });

test("CSV reader handles BOM, quotes, CRLF and the leading comment block", () => {
	const c = parseCsv('﻿# Start date: 20260921\r\n# End date: 20261018\r\n\r\nA,B\r\n"x, y","say ""hi"""\r\n1,2\r\n');
	assert.deepEqual(c.header, ["A", "B"]);
	assert.deepEqual(c.rows, [["x, y", 'say "hi"'], ["1", "2"]]);
	assert.equal(c.comments.length, 2);
	assert.throws(() => parseCsv('A\n"open'), /unterminated/);
});

test("output passes the consumer contract; events_included lists only events present in the events report", () => {
	const r = run({ eventsCsv: EVTS });
	assert.equal(r.export.evidence_type, "ga4_report_export");
	assert.deepEqual(r.export.events_included, ["internal_resource_clicked"]);
	assert.doesNotThrow(() => parseGa4Export(JSON.stringify(r.export)));
	const row = r.export.rows.find((x) => x.source === "google");
	assert.deepEqual(row.events, { internal_resource_clicked: 3 });
	assert.deepEqual(r.export.rows.find((x) => x.source === "linkedin").events, {});
});

test("without an events report no event is claimed: events_included is empty and no zero is invented", () => {
	const r = run();
	assert.deepEqual(r.export.events_included, []);
	assert.ok(r.export.rows.every((x) => Object.keys(x.events).length === 0));
	assert.equal(r.summary.events_report_supplied, false);
});

test("an event the events report never mentions is not listed, even if the closed list has it", () => {
	const r = run({ eventsCsv: EVTS });
	assert.ok(!r.export.events_included.includes("cpl_cta_clicked"));
});

test("engaged sessions are optional: unmapped means absent (UNKNOWN downstream), not zero", () => {
	const m = structuredClone(mapping);
	delete m.sessions_report.engaged_sessions;
	const r = run({ mapping: m, sessionsCsv: `LP,SRC,MED,S\n${P},google,organic,10\n` });
	assert.equal("engaged_sessions" in r.export.rows[0], false);
});

test("unmapped columns are rejected, personal-looking ones called out", () => {
	assert.throws(() => run({ sessionsCsv: `LP,SRC,MED,S,E,Extra\n${P},google,organic,1,1,x\n` }), /unmapped column "Extra"/);
	assert.throws(() => run({ sessionsCsv: `LP,SRC,MED,S,E,User ID\n${P},google,organic,1,1,x\n` }), /looks personal/);
	assert.throws(() => run({ sessionsCsv: `LP,SRC,MED,S,E,Email\n${P},google,organic,1,1,a@b.c\n` }), /looks personal/);
});

test("mapping cannot point at a personal-looking column, reuse one column, or use unknown fields", () => {
	const bad = (patch) => assert.throws(() => validateMapping({ ...mapping, sessions_report: { ...mapping.sessions_report, ...patch } }));
	bad({ sessions: "Client ID" });
	bad({ sessions: "LP" });
	bad({ nonsense: "X" });
	bad({ source_medium: "SM" });
	assert.throws(() => validateMapping({ ...mapping, extra: {} }), /unknown key/);
	assert.throws(() => validateMapping({}), /sessions_report is required/);
	const { source, ...partial } = mapping.sessions_report;
	assert.throws(() => validateMapping({ sessions_report: partial }), /source \+ medium/);
});

test("a header missing from the CSV, or duplicated, is an error", () => {
	assert.throws(() => run({ sessionsCsv: `LP,SRC,MED,S\n${P},google,organic,1\n` }), /unmapped|not found/);
	assert.throws(() => run({ sessionsCsv: `LP,SRC,MED,S,S\n${P},google,organic,1,1\n` }), /duplicate column/);
	const m = structuredClone(mapping);
	m.sessions_report.sessions = "Missing";
	assert.throws(() => run({ mapping: m }), /not found|unmapped/);
});

test("counts, dates, paths and ids are validated", () => {
	const bad = (csv, re) => assert.throws(() => run({ sessionsCsv: csv }), re);
	bad(`LP,SRC,MED,S,E\n${P},google,organic,1.5,0\n`, /plain non-negative integer/);
	bad(`LP,SRC,MED,S,E\n${P},google,organic,1,\n`, /plain non-negative integer/);
	bad(`LP,SRC,MED,S,E\n${P},google,organic,-1,0\n`, /plain non-negative integer/);
	bad(`LP,SRC,MED,S,E\n${P},google,organic,"1,000",0\n`, /plain non-negative integer/);
	bad(`LP,SRC,MED,S,E\n${P},google,organic,1,5\n`, /exceed/);
	bad(`LP,SRC,MED,S,E\n${P}?email=a@b.co,google,organic,1,1\n`, /query string/);
	bad(`LP,SRC,MED,S,E\nGrand total,google,organic,1,1\n`, /not a site path/);
	bad(`LP,SRC,MED,S,E\n${P},a@b.co,organic,1,1\n`, /invalid source\/medium/);
	assert.throws(() => run({ windowStart: "2026-13-01" }), /ISO dates/);
	assert.throws(() => run({ windowStart: "2026-10-19" }), /start <= end/);
	assert.throws(() => run({ propertyId: "abc" }), /numeric/);
	assert.throws(() => run({ sessionsCsv: "LP,SRC,MED,S,E\n" }), /no usable rows/);
});

test("exact duplicate rows are deduplicated; conflicting duplicates fail", () => {
	const dup = run({ sessionsCsv: `${SESS}${P},google,organic,10,6\n` });
	assert.equal(dup.export.rows.length, 2);
	assert.equal(dup.summary.duplicate_rows_suppressed, 1);
	assert.throws(() => run({ sessionsCsv: `${SESS}${P},google,organic,11,6\n` }), /conflicting duplicate/);
	assert.throws(() => run({ eventsCsv: `${EVTS}${P},google,organic,internal_resource_clicked,4\n` }), /conflicting duplicate/);
});

test("(not set) landing pages are excluded and counted; automatic events outside the closed list are dropped and named", () => {
	const r = run({ sessionsCsv: `${SESS}(not set),(direct),(none),2,0\n`, eventsCsv: `${EVTS}${P},google,organic,page_view,99\n` });
	assert.equal(r.summary.rows_with_not_set_landing_page_excluded, 1);
	assert.deepEqual(r.summary.events_dropped_outside_closed_list, ["page_view"]);
	assert.ok(!JSON.stringify(r.export).includes("page_view"));
	assert.throws(() => run({ eventsCsv: `LP,SRC,MED,EV,N\n${P},google,organic,Bad Name!,1\n` }), /invalid event name/);
});

test("an event row without a matching sessions row fails closed instead of inventing sessions", () => {
	assert.throws(() => run({ eventsCsv: `LP,SRC,MED,EV,N\n/california/other/solar-permit-guide/,google,organic,internal_resource_clicked,1\n` }), /no matching row in the sessions report/);
	assert.throws(() => run({ eventsCsv: EVTS, mapping: { sessions_report: mapping.sessions_report } }), /events_report is missing/);
});

test("combined source / medium column is split on the last ' / '; a value without the separator fails", () => {
	const m = { sessions_report: { landing_page: "LP", source_medium: "SM", sessions: "S" } };
	const r = run({ mapping: m, sessionsCsv: `LP,SM,S\n${P},google / organic,5\n${P},(direct) / (none),2\n` });
	assert.deepEqual(r.export.rows.map((x) => [x.source, x.medium]), [["(direct)", "(none)"], ["google", "organic"]]);
	assert.throws(() => run({ mapping: m, sessionsCsv: `LP,SM,S\n${P},google,5\n` }), /separator/);
});

test("the date range written in the file's own header must match --start/--end", () => {
	const ok = `# Start date: 20260921\n# End date: 20261018\n${SESS}`;
	assert.doesNotThrow(() => run({ sessionsCsv: ok }));
	assert.throws(() => run({ sessionsCsv: ok.replace("20261018", "20261019") }), /differs from --start\/--end/);
});

test("CLI refuses an output path inside the repository and never overwrites", () => {
	const dir = mkdtempSync(path.join(os.tmpdir(), "ga4-conv-"));
	const sess = path.join(dir, "s.csv");
	const map = path.join(dir, "m.json");
	writeFileSync(sess, SESS);
	writeFileSync(map, JSON.stringify(mapping));
	const cli = (out) => spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", path.join(ROOT, "scripts/ga4-report-to-export.mjs"), "--sessions", sess, "--mapping", map, "--property-id", "123", "--start", "2026-09-21", "--end", "2026-10-18", "--out", out], { encoding: "utf8" });
	const inside = path.join(ROOT, "tests/fixtures/should-not-exist-ga4.json");
	const refused = cli(inside);
	assert.equal(refused.status, 2);
	assert.match(refused.stderr, /Refusing to write inside the repository/);
	assert.equal(existsSync(inside), false);
	assert.equal(cli(path.join(dir, "missing-dir", "x.json")).status, 2);
	assert.equal(cli(path.join(dir, "ga4.json")).status, 0);
	assert.equal(JSON.parse(readFileSync(path.join(dir, "ga4.json"), "utf8")).evidence_type, "ga4_report_export");
	const again = cli(path.join(dir, "ga4.json"));
	assert.equal(again.status, 2);
});
