import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
	DEFAULT_CONTRACT_PATH,
	assertContractIntegrity,
	assertReadOnlyTarget,
	extractLocPathnames,
	get,
	loadContract,
	probeProductionContract,
} from "../scripts/production-cta-contract-probe.mjs";

const contract = assertContractIntegrity(await loadContract());

test("production contract has internally consistent, disjoint eligibility evidence", () => {
	assert.equal(contract.verified_city_slugs.length, 61);
	assert.equal(contract.allowlisted_but_not_deployed.length, 14);
	assert.equal(contract.expected.guide_count, 341);
	assert.equal(contract.expected.positive_count + contract.expected.negative_count, 341);
	assert.equal(contract.cta_markers.length, 4);
	assert.ok(contract.cta_markers.every(Boolean));
	assert.equal(contract.assets.length, 2);
});

test("production contract and revenue verification use the same positive and undeployed slug sets", async () => {
	const revenueEvidence = JSON.parse(await readFile(new URL("../data/revenue/compare-solar-production-verified.json", import.meta.url), "utf8"));
	assert.deepEqual([...contract.verified_city_slugs].sort(), [...revenueEvidence.verified_city_slugs].sort());
	assert.deepEqual([...contract.allowlisted_but_not_deployed].sort(), [...revenueEvidence.allowlisted_but_not_deployed].sort());
	assert.equal(contract.provenance.production_commit, revenueEvidence.provenance.production_commit);
	assert.equal(contract.provenance.deploy_id, revenueEvidence.provenance.deploy_id);
});

test("read-only target guard accepts only the pinned immutable HTTPS deploy without query data", () => {
	const origin = contract.immutable_origin;
	assert.equal(assertReadOnlyTarget("/sitemap-index.xml", origin).href, `${origin}/sitemap-index.xml`);
	assert.equal(assertReadOnlyTarget(`${origin}/privacy/`, origin).href, `${origin}/privacy/`);
	for (const target of [
		"http://6a8ee99d8c07af00083640bc--gridpermit.netlify.app/",
		"https://mygridpermit.com/",
		"https://main--gridpermit.netlify.app/",
		"https://example.com/",
		"/privacy/?probe=1",
		"/privacy/#section",
		"https://user:password@6a8ee99d8c07af00083640bc--gridpermit.netlify.app/",
	]) {
		assert.throws(() => assertReadOnlyTarget(target, origin), /Refusing/);
	}
});

test("network chokepoint always issues GET with redirects disabled", async () => {
	let observed;
	const response = await get("/robots.txt", {
		immutableOrigin: contract.immutable_origin,
		fetchImpl: async (url, options) => {
			observed = { url: url.href, options };
			return { ok: true, status: 200, url: url.href };
		},
	});
	assert.equal(response.status, 200);
	assert.equal(observed.options.method, "GET");
	assert.equal(observed.options.redirect, "error");
	assert.equal(observed.url, `${contract.immutable_origin}/robots.txt`);
});

test("single-line sitemap parsing preserves route paths without authorizing canonical-host requests", () => {
	const xml = '<?xml version="1.0"?><urlset><url><loc>https://mygridpermit.com/california/irvine/solar-permit-guide/</loc></url><url><loc>https://mygridpermit.com/texas/austin/solar-permit-guide/</loc></url></urlset>';
	assert.deepEqual(extractLocPathnames(xml, contract.canonical_sitemap_origins), [
		"/california/irvine/solar-permit-guide/",
		"/texas/austin/solar-permit-guide/",
	]);
	assert.throws(
		() => extractLocPathnames("<loc>https://example.com/foreign/</loc>", contract.canonical_sitemap_origins),
		/Unexpected sitemap origin/,
	);
});

test("live immutable production contract", { skip: process.env.GRIDPERMIT_PROD_PROBE !== "1", timeout: 120_000 }, async () => {
	const result = await probeProductionContract({ contractPath: DEFAULT_CONTRACT_PATH });
	assert.deepEqual(result.cta, { positive: 61, negative: 280, mixed: 0 });
	assert.equal(result.sgip_2026_guide_count, 241);
});
