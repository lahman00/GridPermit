#!/usr/bin/env node
// Read-only report: for every built page that shows a solar quote CTA, which
// partner it sends the visitor to, whether that route is paid (attributable) or
// untracked, and which eligibility rule explains the choice.
//
//   node --experimental-strip-types scripts/money-path-report.mjs [--dist dist] [--out money-path.csv]
//
// It reads the built HTML (what visitors actually get), the generated outbound
// manifest and the locality records. It changes nothing, calls no network and
// never infers a lead or revenue: "paid" means only that the click goes through
// the attributable CompareSolarPrices redirect.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isCompareSolarServedLocality } from "../src/lib/compare-solar-prices.ts";
import { hasVerifiedUnambiguousUtility } from "../src/lib/utility-split-guard.ts";
import { citySlug, guideUrlForCitySlug } from "../src/lib/locality-guide.ts";

const arg = (name, fallback) => {
	const i = process.argv.indexOf(name);
	return i >= 0 ? process.argv[i + 1] : fallback;
};
const dist = arg("--dist", "dist");
const out = arg("--out", null);

function walk(dir) {
	return readdirSync(dir).flatMap((n) => {
		const p = path.join(dir, n);
		return statSync(p).isDirectory() ? walk(p) : [p];
	});
}

const manifestPath = "netlify/generated/outbound-routes.json";
const approved = existsSync(manifestPath) ? new Set(JSON.parse(readFileSync(manifestPath, "utf8")).map((r) => r.page_path)) : null;
const records = new Map();
for (const f of readdirSync("data/localities").filter((f) => f.endsWith(".json"))) {
	const r = JSON.parse(readFileSync(path.join("data/localities", f), "utf8"));
	records.set(guideUrlForCitySlug(r.state, citySlug(r.city.value)), r);
}
const intents = existsSync("data/commercial/page-intents.json") ? JSON.parse(readFileSync("data/commercial/page-intents.json", "utf8")) : null;
const intentPaths = new Set(JSON.stringify(intents ?? "").match(/\/[a-z0-9\-/]+\//g) ?? []);

const rows = [];
for (const file of walk(dist).filter((f) => f.endsWith("index.html")).sort()) {
	const url = "/" + path.relative(dist, path.dirname(file)).split(path.sep).join("/") + (path.relative(dist, path.dirname(file)) ? "/" : "");
	const html = readFileSync(file, "utf8");
	const hasPaid = /data-compare-solar-cta-root/.test(html);
	// A real EnergySage CTA is an anchor carrying the tracked click attribute and the partner host.
	const hasEnergySage = /<a [^>]*href="https:\/\/[^"]*energysage\.com[^"]*"[^>]*data-track-click="external_partner_clicked"|<a [^>]*data-track-click="external_partner_clicked"[^>]*href="https:\/\/[^"]*energysage\.com/.test(html);
	const hasGeneric = /class="[^"]*partner-cta[^"]*"/.test(html) && !hasPaid;
	if (!hasPaid && !hasEnergySage && !hasGeneric) continue;
	const rec = records.get(url);
	const isLocality = Boolean(rec);
	const state = rec?.state ?? "";
	const city = rec?.city?.value ?? "";
	const utilityOk = rec ? hasVerifiedUnambiguousUtility({ record_id: rec.record_id, utility: rec.utility }) : false;
	const served = rec && state === "CA" ? isCompareSolarServedLocality("CA", city) : false;
	const blockers = [];
	if (isLocality) {
		if (state !== "CA") blockers.push("not a California route");
		else if (!served) blockers.push("city not on the CompareSolarPrices served-city allowlist");
		if (state === "CA" && served && !utilityOk) blockers.push("utility not verified single-utility for the whole city");
	} else {
		blockers.push("not a locality guide (no city/utility context)");
	}
	const paid = hasPaid;
	rows.push({
		url,
		page_type: isLocality ? "locality_guide" : url === "/" ? "homepage" : "other",
		partner: paid ? "compare-solar-prices" : hasEnergySage ? "energysage" : "generic-partner-cta",
		paid_or_untracked: paid ? "paid (attributable /go/ redirect with CID)" : hasEnergySage ? "untracked (no compensation tracking)" : "UNKNOWN",
		in_approved_manifest: approved ? String(approved.has(url)) : "UNKNOWN (manifest missing; run a build)",
		reviewed_page_intent: String(intentPaths.has(url)),
		why: paid
			? "CompareSolarPrices CTA rendered: California route, served city, verified single utility, partner launch-ready"
			: blockers.length
				? "paid route not eligible: " + blockers.join("; ")
				: "paid route looks eligible by the local rules but the page shows another CTA: check partner registry and approval state",
		paid_blockers: blockers.join("; "),
	});
}

const cols = ["url", "page_type", "partner", "paid_or_untracked", "in_approved_manifest", "reviewed_page_intent", "why", "paid_blockers"];
const esc = (v) => (/[",\n]/.test(v) ? '"' + v.replaceAll('"', '""') + '"' : v);
const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(String(r[c]))).join(","))].join("\n") + "\n";
if (out) writeFileSync(out, csv);
const by = {};
for (const r of rows) by[`${r.partner} | ${r.paid_or_untracked.split(" ")[0]}`] = (by[`${r.partner} | ${r.paid_or_untracked.split(" ")[0]}`] ?? 0) + 1;
const flagged = rows.filter((r) => r.why.startsWith("paid route looks eligible"));
console.log(JSON.stringify({ pages_with_quote_cta: rows.length, by_partner: by, eligible_but_not_paid: flagged.map((r) => r.url), manifest_routes: approved ? approved.size : "UNKNOWN" }, null, 2));
if (!out) process.stdout.write(csv);
