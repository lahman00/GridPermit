import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	buildCompareSolarReferralUrl,
	generateCompareSolarCid,
	getCompareSolarDestination,
	isCompareSolarServedCity,
	isValidCompareSolarCid,
	normalizeCompareSolarCitySlug,
} from "../src/lib/compare-solar-prices.ts";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const COMPONENT_PATH = path.join(REPO_ROOT, "src", "components", "CompareSolarPricesCTA.astro");
const LOCALITY_LAYOUT_PATH = path.join(REPO_ROOT, "src", "layouts", "LocalityGuideLayout.astro");

const component = readFileSync(COMPONENT_PATH, "utf8");
const localityLayout = readFileSync(LOCALITY_LAYOUT_PATH, "utf8");

test("generated cids are unique, non-PII-shaped, within 32 chars, and use only the partner-approved character set", () => {
	const cids = Array.from({ length: 100 }, () => generateCompareSolarCid());
	assert.equal(new Set(cids).size, cids.length, "100 generated cids should be unique");
	for (const cid of cids) {
		assert.equal(cid.length, 24);
		assert.match(cid, /^[A-Za-z0-9_-]+$/);
		assert.ok(isValidCompareSolarCid(cid));
	}
});

test("cid validation rejects spaces, PII-like punctuation, empty strings, and over-32-char values", () => {
	for (const invalid of ["", "hello world", "person@example.com", "555.123.4567", "a".repeat(33)]) {
		assert.equal(isValidCompareSolarCid(invalid), false, invalid);
	}
	assert.throws(() => buildCompareSolarReferralUrl("Irvine", "person@example.com"));
});

test("city normalization matches partner URL slugs", () => {
	assert.equal(normalizeCompareSolarCitySlug("San Diego"), "san-diego");
	assert.equal(normalizeCompareSolarCitySlug("  Rancho Cucamonga  "), "rancho-cucamonga");
	assert.equal(normalizeCompareSolarCitySlug("Simi Valley"), "simi-valley");
});

test("known served cities deep-link to the partner's city route with GridPermit ref and supplied cid", () => {
	assert.equal(isCompareSolarServedCity("Irvine"), true);
	assert.equal(getCompareSolarDestination("Irvine"), "https://www.comparesolarprices.net/solar-irvine-ca/");

	const built = buildCompareSolarReferralUrl("Irvine", "test_click_001");
	assert.ok(built);
	const url = new URL(built);
	assert.equal(url.origin, "https://www.comparesolarprices.net");
	assert.equal(url.pathname, "/solar-irvine-ca/");
	assert.equal(url.searchParams.get("ref"), "GridPermit");
	assert.equal(url.searchParams.get("cid"), "test_click_001");
});

test("non-allowlisted cities fail closed instead of sending out-of-area traffic", () => {
	assert.equal(isCompareSolarServedCity("San Francisco"), false);
	assert.equal(getCompareSolarDestination("San Francisco"), null);
	assert.equal(buildCompareSolarReferralUrl("San Francisco", "safe_001"), null);
});

test("staged CTA has a proximate paid-referral disclosure and does not make partner savings, price, or timeline claims", () => {
	assert.match(component, /Paid referral disclosure:/);
	assert.match(component, /paid referral relationship with CompareSolarPrices/);
	assert.match(component, /GridPermit is not the installer/);
	assert.ok(!/\b(?:save|savings)\b/i.test(component));
	assert.ok(!/\$\s*\d/.test(component));
	assert.ok(!/\bprices?\s+(?:from|starting|as\s+low|of)\b/i.test(component));
	assert.ok(!/\b\d+\s*(?:minute|hour|day)s?\b/i.test(component));
});

test("staged CTA generates the referral URL at click time and records the existing CPL analytics event", () => {
	assert.match(component, /buildCompareSolarReferralUrl\(city\)/);
	assert.match(component, /trackEvent\("cpl_cta_clicked"/);
	assert.match(component, /window\.open\(referralUrl/);
});

test("production locality pages do not import or render the staged CTA before the tax/payment gate clears", () => {
	assert.ok(!localityLayout.includes("CompareSolarPricesCTA"));
	assert.ok(!localityLayout.includes("compare-solar-prices"));
});
