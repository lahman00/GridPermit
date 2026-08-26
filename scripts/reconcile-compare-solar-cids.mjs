#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";

const CID_RE = /^[a-f0-9]{24}$/i;
const QUOTE_PAYOUT = 25;
const INSTALL_PAYOUT = 200;
const QUOTE_ATTRIBUTION_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const FORBIDDEN_PII_HEADER = /(^|_)(first_?name|last_?name|full_?name|name|email|e_?mail|phone|telephone|mobile|street|address|postal_?address|ip|ip_?address|utility_?account|account_?number|bill_?amount|ssn|tin|tax_?id)(_|$)/i;

function usage() {
	return `Usage:
  node scripts/reconcile-compare-solar-cids.mjs \\
    --clicks clicks.csv \\
    --partner partner.csv \\
    --out reconciliation-output

Options:
  --clicks <file>   GridPermit click-side CSV
  --partner <file>  Partner CID-level conversion CSV
  --out <dir>       Output directory (created if missing)
  --self-test       Run the built-in deterministic self-test
  --help            Show this help

The tool rejects CSV headers that look like homeowner PII. It writes:
  reconciliation.json
  discrepancies.csv
`;
}

function parseArgs(argv) {
	const args = {};
	for (let i = 0; i < argv.length; i += 1) {
		const token = argv[i];
		if (token === "--help" || token === "-h") args.help = true;
		else if (token === "--self-test") args.selfTest = true;
		else if (["--clicks", "--partner", "--out"].includes(token)) {
			const value = argv[i + 1];
			if (!value || value.startsWith("--")) throw new Error(`Missing value for ${token}`);
			args[token.slice(2)] = value;
			i += 1;
		} else {
			throw new Error(`Unknown argument: ${token}`);
		}
	}
	return args;
}

function parseCsv(text, sourceName) {
	const rows = [];
	let row = [];
	let field = "";
	let quoted = false;

	for (let i = 0; i < text.length; i += 1) {
		const char = text[i];
		if (quoted) {
			if (char === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i += 1;
				} else {
					quoted = false;
				}
			} else {
				field += char;
			}
			continue;
		}

		if (char === '"') quoted = true;
		else if (char === ",") {
			row.push(field);
			field = "";
		} else if (char === "\n") {
			row.push(field.replace(/\r$/, ""));
			rows.push(row);
			row = [];
			field = "";
		} else {
			field += char;
		}
	}

	if (quoted) throw new Error(`${sourceName}: unterminated quoted CSV field`);
	if (field.length > 0 || row.length > 0) {
		row.push(field.replace(/\r$/, ""));
		rows.push(row);
	}

	const nonEmpty = rows.filter((r) => r.some((value) => value.trim() !== ""));
	if (nonEmpty.length < 2) throw new Error(`${sourceName}: expected a header and at least one data row`);

	const headers = nonEmpty[0].map((value) => value.trim());
	if (headers.some((header) => header === "")) throw new Error(`${sourceName}: blank CSV header`);
	if (new Set(headers).size !== headers.length) throw new Error(`${sourceName}: duplicate CSV header`);

	for (const header of headers) {
		if (FORBIDDEN_PII_HEADER.test(header)) {
			throw new Error(`${sourceName}: forbidden PII-like header '${header}'`);
		}
	}

	return nonEmpty.slice(1).map((values, index) => {
		if (values.length !== headers.length) {
			throw new Error(`${sourceName}: row ${index + 2} has ${values.length} columns; expected ${headers.length}`);
		}
		return Object.fromEntries(headers.map((header, column) => [header, values[column].trim()]));
	});
}

function requireHeaders(rows, required, sourceName) {
	const headers = new Set(Object.keys(rows[0] ?? {}));
	const missing = required.filter((header) => !headers.has(header));
	if (missing.length > 0) throw new Error(`${sourceName}: missing required headers: ${missing.join(", ")}`);
}

function parseMoney(value) {
	if (value === "" || value == null) return 0;
	const normalized = String(value).replace(/[$,\s]/g, "");
	const amount = Number(normalized);
	return Number.isFinite(amount) ? amount : NaN;
}

function parseDate(value) {
	if (!value) return NaN;
	const timestamp = Date.parse(value);
	return Number.isFinite(timestamp) ? timestamp : NaN;
}

function csvEscape(value) {
	const text = value == null ? "" : String(value);
	return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows, headers) {
	const lines = [headers.map(csvEscape).join(",")];
	for (const row of rows) lines.push(headers.map((header) => csvEscape(row[header])).join(","));
	return `${lines.join("\n")}\n`;
}

function normalizeStatus(value) {
	return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function discrepancy(list, code, cid, detail, severity = "error") {
	list.push({ severity, code, cid: cid ?? "", detail });
}

export function reconcile(clickRows, partnerRows) {
	requireHeaders(
		clickRows,
		["cid", "clicked_at", "source_path", "locality_slug", "state", "ref", "destination_host"],
		"clicks.csv",
	);
	requireHeaders(
		partnerRows,
		["cid", "quote_status", "quote_status_date", "quote_payout", "install_status", "install_status_date", "install_payout", "reason_code", "payment_period", "paid_or_accrued"],
		"partner.csv",
	);

	const discrepancies = [];
	const clicksByCid = new Map();
	const partnerByCid = new Map();

	for (const click of clickRows) {
		const cid = click.cid.toLowerCase();
		if (!CID_RE.test(cid)) discrepancy(discrepancies, "invalid_click_cid", click.cid, "Click CID must be 24 hexadecimal characters");
		const list = clicksByCid.get(cid) ?? [];
		list.push(click);
		clicksByCid.set(cid, list);

		if (!Number.isFinite(parseDate(click.clicked_at))) discrepancy(discrepancies, "invalid_click_date", click.cid, `Invalid clicked_at '${click.clicked_at}'`);
		if (click.ref !== "GridPermit") discrepancy(discrepancies, "invalid_ref", click.cid, `Expected ref=GridPermit, received '${click.ref}'`);
		if (!/(^|\.)comparesolarprices\.net$/i.test(click.destination_host)) {
			discrepancy(discrepancies, "invalid_destination_host", click.cid, `Unexpected destination host '${click.destination_host}'`);
		}
		if (click.state.toUpperCase() !== "CA") discrepancy(discrepancies, "unexpected_state", click.cid, `Current route expects CA, received '${click.state}'`, "warning");
		if (!click.source_path.startsWith("/")) discrepancy(discrepancies, "invalid_source_path", click.cid, "source_path must be a path beginning with '/'", "warning");
	}

	for (const [cid, rows] of clicksByCid.entries()) {
		if (rows.length !== 1) discrepancy(discrepancies, "duplicate_click_cid", cid, `CID appears in ${rows.length} click rows`);
	}

	let quoteQualifiedCount = 0;
	let installFundedCount = 0;
	let expectedQuotePayout = 0;
	let expectedInstallPayout = 0;
	let reportedQuotePayout = 0;
	let reportedInstallPayout = 0;

	for (const partner of partnerRows) {
		const cid = partner.cid.toLowerCase();
		if (!CID_RE.test(cid)) discrepancy(discrepancies, "invalid_partner_cid", partner.cid, "Partner CID must be 24 hexadecimal characters");
		const list = partnerByCid.get(cid) ?? [];
		list.push(partner);
		partnerByCid.set(cid, list);

		const matchedClicks = clicksByCid.get(cid) ?? [];
		if (matchedClicks.length === 0) discrepancy(discrepancies, "unknown_partner_cid", partner.cid, "Partner CID has no GridPermit click row");
		if (matchedClicks.length > 1) discrepancy(discrepancies, "ambiguous_partner_cid", partner.cid, "Partner CID matches multiple GridPermit click rows");

		const quoteStatus = normalizeStatus(partner.quote_status);
		const installStatus = normalizeStatus(partner.install_status);
		const quotePayout = parseMoney(partner.quote_payout);
		const installPayout = parseMoney(partner.install_payout);
		reportedQuotePayout += Number.isFinite(quotePayout) ? quotePayout : 0;
		reportedInstallPayout += Number.isFinite(installPayout) ? installPayout : 0;

		if (!Number.isFinite(quotePayout)) discrepancy(discrepancies, "invalid_quote_payout", partner.cid, `Invalid quote_payout '${partner.quote_payout}'`);
		if (!Number.isFinite(installPayout)) discrepancy(discrepancies, "invalid_install_payout", partner.cid, `Invalid install_payout '${partner.install_payout}'`);

		if (quoteStatus === "qualified") {
			quoteQualifiedCount += 1;
			expectedQuotePayout += QUOTE_PAYOUT;
			if (quotePayout !== QUOTE_PAYOUT) discrepancy(discrepancies, "quote_payout_mismatch", partner.cid, `Qualified quote expected $${QUOTE_PAYOUT}; reported $${partner.quote_payout}`);

			if (matchedClicks.length === 1) {
				const clickAt = parseDate(matchedClicks[0].clicked_at);
				const quoteAt = parseDate(partner.quote_status_date);
				if (!Number.isFinite(quoteAt)) discrepancy(discrepancies, "invalid_quote_status_date", partner.cid, `Invalid quote_status_date '${partner.quote_status_date}'`);
				else if (Number.isFinite(clickAt)) {
					const elapsedDays = (quoteAt - clickAt) / MS_PER_DAY;
					if (elapsedDays < 0) discrepancy(discrepancies, "quote_before_click", partner.cid, `Qualified quote predates click by ${Math.abs(elapsedDays).toFixed(2)} days`);
					else if (elapsedDays > QUOTE_ATTRIBUTION_DAYS) discrepancy(discrepancies, "quote_attribution_window_mismatch", partner.cid, `Qualified quote occurred ${elapsedDays.toFixed(2)} days after click; expected <= ${QUOTE_ATTRIBUTION_DAYS}`);
				}
			}
		} else if (Number.isFinite(quotePayout) && quotePayout !== 0) {
			discrepancy(discrepancies, "nonqualified_quote_has_payout", partner.cid, `quote_status '${partner.quote_status}' has non-zero payout $${quotePayout}`);
		}

		if (installStatus === "funded") {
			installFundedCount += 1;
			expectedInstallPayout += INSTALL_PAYOUT;
			if (installPayout !== INSTALL_PAYOUT) discrepancy(discrepancies, "install_payout_mismatch", partner.cid, `Funded install expected $${INSTALL_PAYOUT}; reported $${partner.install_payout}`);
			if (!Number.isFinite(parseDate(partner.install_status_date))) discrepancy(discrepancies, "invalid_install_status_date", partner.cid, `Invalid install_status_date '${partner.install_status_date}'`);
		} else if (Number.isFinite(installPayout) && installPayout !== 0) {
			discrepancy(discrepancies, "nonfunded_install_has_payout", partner.cid, `install_status '${partner.install_status}' has non-zero payout $${installPayout}`);
		}

		if (["unqualified", "duplicate", "reversed"].includes(quoteStatus) && partner.reason_code === "") {
			discrepancy(discrepancies, "missing_quote_reason_code", partner.cid, `quote_status '${partner.quote_status}' should include a non-PII reason_code`, "warning");
		}
	}

	for (const [cid, rows] of partnerByCid.entries()) {
		if (rows.length !== 1) discrepancy(discrepancies, "duplicate_partner_cid", cid, `CID appears in ${rows.length} partner rows`);
	}

	const matchedCidCount = [...partnerByCid.keys()].filter((cid) => (clicksByCid.get(cid) ?? []).length === 1).length;
	const severityCounts = discrepancies.reduce(
		(acc, item) => {
			acc[item.severity] = (acc[item.severity] ?? 0) + 1;
			return acc;
		},
		{},
	);

	return {
		generated_at: new Date().toISOString(),
		constants: {
			quote_payout_usd: QUOTE_PAYOUT,
			install_payout_usd: INSTALL_PAYOUT,
			quote_attribution_days: QUOTE_ATTRIBUTION_DAYS,
		},
		summary: {
			click_rows: clickRows.length,
			partner_rows: partnerRows.length,
			matched_cids: matchedCidCount,
			qualified_quotes: quoteQualifiedCount,
			funded_installs: installFundedCount,
			expected_quote_payout_usd: expectedQuotePayout,
			expected_install_payout_usd: expectedInstallPayout,
			expected_total_payout_usd: expectedQuotePayout + expectedInstallPayout,
			reported_quote_payout_usd: reportedQuotePayout,
			reported_install_payout_usd: reportedInstallPayout,
			reported_total_payout_usd: reportedQuotePayout + reportedInstallPayout,
			discrepancies: discrepancies.length,
			errors: severityCounts.error ?? 0,
			warnings: severityCounts.warning ?? 0,
		},
		discrepancies,
	};
}

function readRows(file, sourceName) {
	return parseCsv(fs.readFileSync(file, "utf8"), sourceName);
}

function writeReport(report, outputDir) {
	fs.mkdirSync(outputDir, { recursive: true });
	fs.writeFileSync(path.join(outputDir, "reconciliation.json"), `${JSON.stringify(report, null, 2)}\n`);
	fs.writeFileSync(
		path.join(outputDir, "discrepancies.csv"),
		toCsv(report.discrepancies, ["severity", "code", "cid", "detail"]),
	);
}

function runSelfTest() {
	const clicks = parseCsv(
		`cid,clicked_at,source_path,locality_slug,state,ref,destination_host\n0123456789abcdef01234567,2026-08-01T12:00:00Z,/california/irvine/solar-permit-guide/,irvine,CA,GridPermit,www.comparesolarprices.net\n89abcdef0123456789abcdef,2026-08-01T13:00:00Z,/california/anaheim/solar-permit-guide/,anaheim,CA,GridPermit,comparesolarprices.net\n`,
		"clicks.csv",
	);
	const partner = parseCsv(
		`cid,quote_status,quote_status_date,quote_payout,install_status,install_status_date,install_payout,reason_code,payment_period,paid_or_accrued\n0123456789abcdef01234567,qualified,2026-08-10T12:00:00Z,25,funded,2026-09-15T12:00:00Z,200,,2026-08,accrued\n89abcdef0123456789abcdef,duplicate,2026-08-02T13:00:00Z,0,not_funded,,0,duplicate,2026-08,accrued\n`,
		"partner.csv",
	);
	const report = reconcile(clicks, partner);
	assert.equal(report.summary.errors, 0);
	assert.equal(report.summary.qualified_quotes, 1);
	assert.equal(report.summary.funded_installs, 1);
	assert.equal(report.summary.expected_total_payout_usd, 225);
	assert.equal(report.summary.reported_total_payout_usd, 225);

	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gridpermit-cid-selftest-"));
	writeReport(report, tempDir);
	assert.ok(fs.existsSync(path.join(tempDir, "reconciliation.json")));
	assert.ok(fs.existsSync(path.join(tempDir, "discrepancies.csv")));
	fs.rmSync(tempDir, { recursive: true, force: true });
	console.log("Self-test passed");
}

function main() {
	let args;
	try {
		args = parseArgs(process.argv.slice(2));
		if (args.help) {
			console.log(usage());
			return;
		}
		if (args.selfTest) {
			runSelfTest();
			return;
		}
		if (!args.clicks || !args.partner || !args.out) throw new Error("--clicks, --partner and --out are required");

		const report = reconcile(readRows(args.clicks, "clicks.csv"), readRows(args.partner, "partner.csv"));
		writeReport(report, args.out);
		console.log(JSON.stringify(report.summary, null, 2));
		if (report.summary.errors > 0) process.exitCode = 2;
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		console.error(usage());
		process.exitCode = 1;
	}
}

main();
