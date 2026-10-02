import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PERMIT_PATHWAY_RECORD_IDS, buildPermitPathwayAnswer } from "../src/lib/permit-pathway-answer.ts";
import { isCompareSolarServedLocality } from "../src/lib/compare-solar-prices.ts";
import { hasVerifiedUnambiguousUtility } from "../src/lib/utility-split-guard.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const loadRecord = (id) => JSON.parse(readFileSync(path.join(root, "data/localities", `${id}.json`), "utf8"));
const layout = readFileSync(path.join(root, "src/layouts/LocalityGuideLayout.astro"), "utf8");
const component = readFileSync(path.join(root, "src/components/PermitPathwayAnswer.astro"), "utf8");

const recordIdToFile = {
	"ca-san-diego-chula-vista-sdge": "ca-san-diego-chula-vista-sdge",
	"ca-ventura-oxnard-sce": "ca-ventura-oxnard-sce",
	"ca-san-bernardino-san-bernardino-sce": "ca-san-bernardino-san-bernardino-sce",
	"ca-los-angeles-pasadena-pwp": "ca-los-angeles-pasadena-pwp",
	"ca-riverside-norco-sce": "ca-riverside-norco-sce",
};
const allRecords = () =>
	readdirSync(path.join(root, "data/localities"))
		.filter((n) => n.endsWith(".json"))
		.map((f) => JSON.parse(readFileSync(path.join(root, "data/localities", f), "utf8")));

test("exactly the five reviewed localities are listed, and each current record supports its answer", () => {
	assert.deepEqual([...PERMIT_PATHWAY_RECORD_IDS].sort(), Object.keys(recordIdToFile).sort());
	for (const id of PERMIT_PATHWAY_RECORD_IDS) {
		const answer = buildPermitPathwayAnswer(loadRecord(recordIdToFile[id]));
		assert.ok(answer, `${id} should render`);
		assert.equal(answer.recordId, id);
		assert.ok(answer.rows.length >= 2 && answer.prepare.length >= 3);
		assert.ok(answer.source.id);
		assert.match(answer.source.url, /^https:\/\//);
		assert.match(answer.verifiedAsOf, /^\d{4}-\d{2}-\d{2}$/);
	}
});

test("every other locality record gets no answer block", () => {
	const dir = path.join(root, "data/localities");
	let checked = 0;
	for (const f of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
		const record = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
		if (PERMIT_PATHWAY_RECORD_IDS.includes(record.record_id)) continue;
		assert.equal(buildPermitPathwayAnswer(record), null, record.record_id);
		checked += 1;
	}
	assert.ok(checked > 100);
});

test("Chula Vista copy reflects the current City page, not the superseded contractor-only/10-kW assumptions", () => {
	const cv = loadRecord("ca-san-diego-chula-vista-sdge");
	const answer = buildPermitPathwayAnswer(cv);
	assert.ok(answer);
	const text = JSON.stringify(answer);
	assert.doesNotMatch(text, /under 10 kW/i);
	assert.match(text, /does not state an explicit kW threshold/i);
	const conditions = cv.eligibility_constraints.value.other_conditions.join(" | ");
	assert.doesNotMatch(conditions, /under 10 kW|Application submitted by a licensed contractor/i);
	assert.equal(cv.last_verified, "2026-10-02");
	assert.equal(cv.sources.find((s) => s.id === "S1")?.accessed_date, "2026-10-02");
	assert.ok(cv.eligibility_constraints.value.other_conditions.some((x) => x.includes("expedited residential solar permits must go through SolarAPP+")));
});

test("Pasadena: utility review is presented before the City permit, and the sequence matches the record", () => {
	const pwp = loadRecord("ca-los-angeles-pasadena-pwp");
	const answer = buildPermitPathwayAnswer(pwp);
	assert.ok(answer);
	assert.equal(answer.source.id, "S8");
	const steps = answer.rows.map((r) => r.situation);
	assert.ok(steps[0].includes("PWP") && steps[2].includes("City building permit"), steps.join(" | "));
	assert.match(answer.answer, /PWP completes its Initial Review before the customer proceeds to the City Permit Center/);
	// A municipal-utility page must not hand off to SolarAPP+ or SCE-specific material.
	assert.deepEqual(answer.handoffs.map((h) => h.href), ["/blog/city-permit-vs-utility-pto/"]);
	assert.doesNotMatch(JSON.stringify(answer), /SolarAPP\+|\bSCE\b|Southern California Edison/);
});

test("Norco: submission options and the owner-or-contractor rule match the City FAQ facts the record holds", () => {
	const norco = loadRecord("ca-riverside-norco-sce");
	const answer = buildPermitPathwayAnswer(norco);
	assert.ok(answer);
	const text = JSON.stringify(answer);
	assert.match(text, /in person at City Hall, online through SolarAPP\+, or by email/);
	assert.match(text, /licensed contractor or the property owner/);
	// Must not claim homeowners can (or cannot) use SolarAPP+ in Norco: that is unverified.
	assert.doesNotMatch(text, /homeowners? (can|may|cannot|are not allowed)[^.]{0,40}SolarAPP/i);
	assert.match(answer.rows[0].notVerified, /Whether an owner may submit through SolarAPP\+/);
});

test("an authority field is a name, never a sentence about sequence (Pasadena regression)", () => {
	for (const r of allRecords()) {
		assert.doesNotMatch(r.permit_authority.value ?? "", /\b(is|are) required\b|\bissues the\b/i, r.record_id);
	}
	const pwp = loadRecord("ca-los-angeles-pasadena-pwp");
	assert.match(pwp.permit_authority.notes, /interconnection approval is required first/);
});

test("a fee amount on a page with a paid route never rests on a search-engine synthesis (Yucaipa regression)", () => {
	let monetized = 0;
	for (const r of allRecords()) {
		if (r.state !== "CA" || !isCompareSolarServedLocality("CA", r.city.value) || !hasVerifiedUnambiguousUtility(r)) continue;
		monetized += 1;
		const env = r.permit_fees;
		for (const fee of env.value ?? []) {
			if (fee.amount_usd == null) continue;
			const text = `${fee.notes ?? ""} ${env.notes ?? ""}`;
			// Flags a displayed amount whose own note says it came from a search summary or was never
			// confirmed. (A note saying a *different* fee was excluded for that reason is fine.)
			assert.doesNotMatch(
				text,
				/search[- ]engine (synthesis|summary)[^.]*\b(indicates|cites|cited)\b|indicates roughly|not independently confirmed (via|against)/i,
				`${r.record_id}: ${fee.name}`,
			);
		}
	}
	assert.ok(monetized > 50, `expected the served-locality gate to select many records, got ${monetized}`);
	const yuc = loadRecord("ca-san-bernardino-yucaipa-sce");
	const fees = new Map(yuc.permit_fees.value.map((f) => [f.name, f.amount_usd]));
	assert.equal(fees.get("Residential rooftop solar permit (first 15 kW)"), 237);
	assert.equal(fees.get("Residential solar permit, each additional kW above 15 kW"), 15);
	assert.equal(fees.get("Solar plan review"), 213);
	assert.deepEqual(yuc.permit_fees.source_ids, ["S8"]);
	const s8 = yuc.sources.find((s) => s.id === "S8");
	assert.match(s8.url, /User-Fees-Effective-7\.1\.26\.pdf/);
	assert.match(yuc.permit_fees.notes, /effective July 1, 2026/i);
	assert.equal(yuc.last_verified, "2026-10-02");
});

test("block fails closed when the record no longer supports the reviewed copy", () => {
	const cv = loadRecord("ca-san-diego-chula-vista-sdge");
	const noDocs = structuredClone(cv);
	noDocs.required_documents.value = noDocs.required_documents.value.filter((d) => !d.name.includes("2 sets of plans"));
	assert.equal(buildPermitPathwayAnswer(noDocs), null);
	const noSource = structuredClone(cv);
	noSource.sources = noSource.sources.filter((s) => s.id !== "S1");
	assert.equal(buildPermitPathwayAnswer(noSource), null);

	const ox = structuredClone(loadRecord("ca-ventura-oxnard-sce"));
	ox.eligibility_constraints.value.program_or_pathway = "SolarAPP+, open to homeowners";
	assert.equal(buildPermitPathwayAnswer(ox), null);

	const sb = structuredClone(loadRecord("ca-san-bernardino-san-bernardino-sce"));
	sb.timeline_days.value.max_days = 10;
	assert.equal(buildPermitPathwayAnswer(sb), null);

	const pwp = structuredClone(loadRecord("ca-los-angeles-pasadena-pwp"));
	pwp.required_documents.value = pwp.required_documents.value.filter((d) => !d.name.includes("Net Metering and Surplus Compensation"));
	assert.equal(buildPermitPathwayAnswer(pwp), null);
	const pwp2 = structuredClone(loadRecord("ca-los-angeles-pasadena-pwp"));
	pwp2.inspection_steps.value = pwp2.inspection_steps.value.filter((s) => !s.includes("Initial Review"));
	assert.equal(buildPermitPathwayAnswer(pwp2), null);

	const norco = structuredClone(loadRecord("ca-riverside-norco-sce"));
	norco.required_documents.value = norco.required_documents.value.filter((d) => !d.name.includes("SolarAPP+ training"));
	assert.equal(buildPermitPathwayAnswer(norco), null);
});

test("copy stays inside the verified scope: no invented fees, no commercial destinations, no data collection, no credentials", () => {
	for (const id of PERMIT_PATHWAY_RECORD_IDS) {
		const record = loadRecord(recordIdToFile[id]);
		const answer = buildPermitPathwayAnswer(record);
		const text = JSON.stringify({ ...answer, source: undefined });
		// A dollar figure may appear only if the record's own fee list carries the same amount.
		const known = new Set((record.permit_fees.value ?? []).map((f) => f.amount_usd));
		for (const m of text.matchAll(/\$\s?(\d[\d,]*(?:\.\d+)?)/g)) {
			assert.ok(known.has(Number(m[1].replace(/,/g, ""))), `${id}: $${m[1]} is not in the record's permit_fees`);
		}
		assert.doesNotMatch(text, /comparesolar|energysage|solar\.com|referral link|get a quote|request a quote|free quote/i, id);
		assert.doesNotMatch(text, /https?:\/\//, `${id}: no external URLs in copy`);
		assert.doesNotMatch(text, /we (file|expedite|submit|approve)|fast[- ]track|guarantee|licensed engineer|certified/i, id);
		// Not-verified cells must stay honest about gaps rather than invent them.
		assert.ok(answer.rows.every((r) => r.notVerified.length > 10 && r.whatTheCityLists.length > 5), id);
	}
});

test("handoffs are existing internal articles, not commercial links", () => {
	for (const id of PERMIT_PATHWAY_RECORD_IDS) {
		const answer = buildPermitPathwayAnswer(loadRecord(recordIdToFile[id]));
		assert.ok(answer.handoffs.length >= 1 && answer.handoffs.length <= 2, id);
		for (const h of answer.handoffs) {
			assert.match(h.href, /^\/blog\/[a-z0-9-]+\/$/);
			const slug = h.href.split("/")[2];
			assert.ok(existsSync(path.join(root, "src/content/blog", `${slug}.md`)), `${slug} must exist`);
		}
	}
});

test("component is presentation-only and the layout renders it outside every commercial slot", () => {
	assert.doesNotMatch(component, /InstallerCTA|CompareSolar|PartnerCTA|<form|<input|<textarea|data-compare|fetch\(|sendBeacon/);
	const call = layout.indexOf("<PermitPathwayAnswer");
	assert.ok(call > 0);
	assert.ok(call > layout.indexOf('<section id="overview">'));
	assert.ok(call < layout.indexOf('<section id="installer-cta"'));
	assert.ok(call < layout.indexOf('<div id="installer-cta">'));
	// Routing gate inputs in the layout are untouched by this feature.
	assert.match(layout, /<InstallerCTA city=\{record\.city\.value\} recordId=\{record\.record_id\} utility=\{record\.utility\} \/>/);
	assert.match(layout, /FIRST_LEAD_SPRINT_PATHS = new Set\(\[\s*"\/california\/escondido\/solar-permit-guide\/",\s*"\/california\/hemet\/solar-permit-guide\/",\s*"\/california\/pomona\/solar-permit-guide\/",\s*\]\)/);
});
