import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getLaunchReadyPartner } from "../src/lib/partners.ts";
import { isCompareSolarServedLocality } from "../src/lib/compare-solar-prices.ts";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const INSTALLER_CTA_PATH = path.join(REPO_ROOT, "src", "components", "InstallerCTA.astro");
const source = readFileSync(INSTALLER_CTA_PATH, "utf8");

test("installer CTA is prewired to CompareSolarPrices behind the existing launch-ready gate", () => {
	assert.match(source, /getLaunchReadyPartner\("compare-solar-prices", "cpl"\)/);
	assert.match(source, /isCompareSolarServedLocality\("CA", city\)/);
	assert.match(source, /<CompareSolarPricesCTA state="CA" city=\{city\} \/>/);
});

test("the CompareSolarPrices route is California-only and cannot activate from city name alone", () => {
	assert.match(source, /Astro\.url\.pathname\.split\("\/"\)\.filter\(Boolean\)\[0\]\?\.toLowerCase\(\) === "california"/);
	assert.match(source, /compareSolar &&\s*isCaliforniaRoute &&\s*isCompareSolarServedLocality\("CA", city\)/);
	assert.equal(isCompareSolarServedLocality("CA", "Irvine"), true);
	assert.equal(isCompareSolarServedLocality("DE", "Irvine"), false);
});

test("today the paid route remains off, proving the production edit is behavior-preserving until activation", () => {
	assert.equal(getLaunchReadyPartner("compare-solar-prices", "cpl"), null);
	assert.match(source, /useCompareSolar \? \(/);
	assert.match(source, /EnergySage is an independent solar marketplace/);
	assert.match(source, /href=\{energysage\.destination\}/);
});

test("the component never renders both solar CTAs at once", () => {
	assert.match(source, /\{useCompareSolar \? \([\s\S]*CompareSolarPricesCTA[\s\S]*\) : \([\s\S]*installer-cta-box/);
});

test("no CompareSolarPrices referral URL or CID is duplicated in the wrapper", () => {
	assert.ok(!source.includes("ref=GridPermit"));
	assert.ok(!source.includes("generateCompareSolarCid"));
	assert.ok(!source.includes("buildCompareSolarReferralUrl"));
});
