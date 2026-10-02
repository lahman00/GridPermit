import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PERMIT_PATHWAY_RECORD_IDS, buildPermitPathwayAnswer } from "../src/lib/permit-pathway-answer.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const loadRecord = (id) => JSON.parse(readFileSync(path.join(root, "data/localities", `${id}.json`), "utf8"));
const layout = readFileSync(path.join(root, "src/layouts/LocalityGuideLayout.astro"), "utf8");
const component = readFileSync(path.join(root, "src/components/PermitPathwayAnswer.astro"), "utf8");

const recordIdToFile = {
	"ca-san-diego-chula-vista-sdge": "ca-san-diego-chula-vista-sdge",
	"ca-ventura-oxnard-sce": "ca-ventura-oxnard-sce",
	"ca-san-bernardino-san-bernardino-sce": "ca-san-bernardino-san-bernardino-sce",
};

test("exactly the three reviewed localities are listed, and each current record supports its answer", () => {
	assert.deepEqual([...PERMIT_PATHWAY_RECORD_IDS].sort(), Object.keys(recordIdToFile).sort());
	for (const id of PERMIT_PATHWAY_RECORD_IDS) {
		const answer = buildPermitPathwayAnswer(loadRecord(recordIdToFile[id]));
		assert.ok(answer, `${id} should render`);
		assert.equal(answer.recordId, id);
		assert.ok(answer.rows.length >= 3 && answer.prepare.length >= 3);
		assert.equal(answer.source.id, "S1");
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
});

test("copy stays inside the verified scope: no fees, no commercial destinations, no data collection, no credentials", () => {
	for (const id of PERMIT_PATHWAY_RECORD_IDS) {
		const answer = buildPermitPathwayAnswer(loadRecord(recordIdToFile[id]));
		const text = JSON.stringify({ ...answer, source: undefined });
		assert.doesNotMatch(text, /\$\s?\d/, `${id}: no dollar amounts`);
		assert.doesNotMatch(text, /comparesolar|energysage|solar\.com|referral link|get a quote|request a quote|free quote/i, id);
		assert.doesNotMatch(text, /https?:\/\//, `${id}: no external URLs in copy`);
		assert.doesNotMatch(text, /we (file|expedite|submit|approve)|fast[- ]track|guarantee|licensed engineer|certified/i, id);
		// Not-verified cells must stay honest about gaps rather than invent them.
		assert.ok(answer.rows.every((r) => r.notVerified.length > 10 && r.whatTheCityLists.length > 5), id);
	}
});

test("handoffs are existing internal articles, not commercial links", () => {
	const answer = buildPermitPathwayAnswer(loadRecord("ca-ventura-oxnard-sce"));
	assert.equal(answer.handoffs.length, 2);
	for (const h of answer.handoffs) {
		assert.match(h.href, /^\/blog\/[a-z0-9-]+\/$/);
		const slug = h.href.split("/")[2];
		assert.ok(existsSync(path.join(root, "src/content/blog", `${slug}.md`)), `${slug} must exist`);
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
