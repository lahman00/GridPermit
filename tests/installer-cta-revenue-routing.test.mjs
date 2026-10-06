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

test("installer CTA routes CompareSolarPrices through the existing launch-ready gate", () => {
	assert.match(source, /getLaunchReadyPartner\("compare-solar-prices", "cpl"\)/);
	assert.match(source, /isCompareSolarServedLocality\("CA", city\)/);
	assert.match(source, /<CompareSolarPricesCTA state="CA" city=\{city\} requireFirstLeadQualification=\{requireFirstLeadQualification\} qualificationLabel=\{qualification\?\.label\} \/>/);
});

test("the CompareSolarPrices route is California-only and cannot activate from city name alone", () => {
	assert.match(source, /Astro\.url\.pathname\.split\("\/"\)\.filter\(Boolean\)\[0\]\?\.toLowerCase\(\) === "california"/);
	assert.match(source, /compareSolar &&\s*isCaliforniaRoute &&\s*isCompareSolarServedLocality\("CA", city\)/);
	assert.equal(isCompareSolarServedLocality("CA", "Irvine"), true);
	assert.equal(isCompareSolarServedLocality("DE", "Irvine"), false);
});

test("the paid route is launch-ready while EnergySage remains the explicit fallback outside the eligible route", () => {
	assert.ok(getLaunchReadyPartner("compare-solar-prices", "cpl"));
	assert.match(source, /useCompareSolar \? \(/);
	assert.match(source, /EnergySage is an independent solar marketplace/);
	assert.match(source, /href=\{energysage\.destination\}/);
});

test("the component never renders both solar CTAs at once", () => {
	assert.match(source, /const renderCommercial=Boolean\(selection\)&&mode!=="resource-only"/);
	assert.match(source, /const renderResource=Boolean\(!selection&&allowUnpaidResource\)&&mode!=="commercial-only"/);
	assert.match(source, /renderCommercial && useCompareSolar \?/);
	assert.match(source, /: renderResource \? \(/);
	assert.equal((source.match(/CompareSolarPricesCTA state="CA"/g) ?? []).length, 1);
});

test("no CompareSolarPrices referral URL or CID is duplicated in the wrapper", () => {
	assert.ok(!source.includes("ref=GridPermit"));
	assert.ok(!source.includes("generateCompareSolarCid"));
	assert.ok(!source.includes("buildCompareSolarReferralUrl"));
});
