import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	buildCompareSolarReferralUrl,
	generateCompareSolarCid,
	getCompareSolarDestination,
	isCompareSolarServedLocality,
	isValidCompareSolarCid,
	normalizeCompareSolarCitySlug,
} from "../src/lib/compare-solar-prices.ts";
import { getLaunchReadyPartner, getPartner } from "../src/lib/partners.ts";

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
	assert.throws(() => buildCompareSolarReferralUrl("CA", "Irvine", "person@example.com"));
});

test("city normalization matches partner URL slugs", () => {
	assert.equal(normalizeCompareSolarCitySlug("San Diego"), "san-diego");
	assert.equal(normalizeCompareSolarCitySlug("  Rancho Cucamonga  "), "rancho-cucamonga");
	assert.equal(normalizeCompareSolarCitySlug("Simi Valley"), "simi-valley");
});

test("known California service cities deep-link with GridPermit ref and supplied cid", () => {
	assert.equal(isCompareSolarServedLocality("CA", "Irvine"), true);
	assert.equal(getCompareSolarDestination("CA", "Irvine"), "https://www.comparesolarprices.net/#quote");

	const built = buildCompareSolarReferralUrl("CA", "Irvine", "test_click_001");
	assert.ok(built);
	const url = new URL(built);
	assert.equal(url.origin, "https://www.comparesolarprices.net");
	assert.equal(url.pathname, "/");
	assert.equal(url.hash, "#quote");
	assert.equal(url.searchParams.get("ref"), "GridPermit");
	assert.equal(url.searchParams.get("cid"), "test_click_001");
});

test("named out-of-boundary California cities remain fail closed", () => {
	assert.equal(isCompareSolarServedLocality("CA", "Santa Barbara"), false);
	assert.equal(isCompareSolarServedLocality("CA", "Barstow"), false);
	assert.equal(getCompareSolarDestination("CA", "Santa Barbara"), null);
	assert.equal(getCompareSolarDestination("CA", "Barstow"), null);
});

test("Aaron-confirmed 2026-09-29 Southern California 14-city batch confirms commercial coverage without bypassing utility or page gates", () => {
	const confirmedCities = [
		"Cathedral City",
		"Corona",
		"Indian Wells",
		"Indio",
		"Lancaster",
		"Long Beach",
		"Norwalk",
		"Orange",
		"Palm Desert",
		"Palm Springs",
		"Palmdale",
		"Rancho Mirage",
		"Santa Clarita",
		"Victorville",
	];

	for (const city of confirmedCities) {
		assert.equal(isCompareSolarServedLocality("CA", city), true, city);
		const destination = getCompareSolarDestination("CA", city);
		assert.ok(destination, city);
		const url = new URL(destination);
		assert.equal(url.origin, "https://www.comparesolarprices.net");
		assert.equal(url.pathname, "/");
		assert.equal(url.hash, "#quote");
	}
});

test("non-allowlisted California cities fail closed instead of sending out-of-area traffic", () => {
	assert.equal(isCompareSolarServedLocality("CA", "San Francisco"), false);
	assert.equal(getCompareSolarDestination("CA", "San Francisco"), null);
	assert.equal(buildCompareSolarReferralUrl("CA", "San Francisco", "safe_001"), null);
});

test("a same-named city outside California can never receive a CompareSolarPrices referral URL", () => {
	assert.equal(isCompareSolarServedLocality("DE", "Irvine"), false);
	assert.equal(isCompareSolarServedLocality("RI", "Pasadena"), false);
	assert.equal(getCompareSolarDestination("DE", "Irvine"), null);
	assert.equal(buildCompareSolarReferralUrl("RI", "Pasadena", "safe_002"), null);
});

test("CTA has a proximate paid-referral disclosure and does not make partner savings, price, or timeline claims", () => {
	assert.match(component, /Paid referral disclosure:/);
	assert.match(component, /paid referral relationship with CompareSolarPrices/);
	assert.match(component, /GridPermit is not the installer/);
	assert.ok(!/\b(?:save|savings)\b/i.test(component));
	assert.ok(!/\$\s*\d/.test(component));
	assert.ok(!/\bprices?\s+(?:from|starting|as\s+low|of)\b/i.test(component));
	assert.ok(!/\b\d+\s*(?:minute|hour|day)s?\b/i.test(component));
});

test("CTA creates one fresh CID per click and sends that same non-PII CID to the partner and revenue-attribution telemetry", () => {
	assert.match(component, /const randomCid = generateCompareSolarCid\(\)/);
	assert.match(component, /const cid = reservedCidPrefix/);
	assert.match(component, /reservedCidPrefix \+ randomCid\.slice\(4\)/);
	assert.match(component, /buildCompareSolarReferralUrl\(state, city, cid\)/);
	assert.match(component, /referral_cid: cid/);
	assert.match(component, /cta_id: CTA_ID/);
	assert.match(component, /partner: PARTNER_ID/);
	assert.match(component, /normalizeCompareSolarCitySlug\(city\)/);
	assert.match(component, /trackEvent\("cpl_cta_clicked"/);
	assert.match(component, /form\.action = "\/go\/compare-solar-prices"/);
	assert.match(component, /form\.submit\(\)/);
});

test("CTA records partner/page/locality dimensions on views without double-firing the generic data-track-view hook", () => {
	assert.match(component, /trackEvent\("cpl_cta_viewed", getSafePlacementParams\(state, city\)\)/);
	assert.match(component, /page_path: window\.location\.pathname/);
	assert.match(component, /data-compare-solar-cta-root/);
	assert.ok(!component.includes('data-track-view="cpl_cta_viewed"'));
});

test("CTA keeps rendered and actual viewport exposure telemetry separate", () => {
	assert.match(component, /const EXPOSURE_RATIO = 0\.25/);
	assert.match(component, /new IntersectionObserver/);
	assert.match(component, /entry\.intersectionRatio < EXPOSURE_RATIO/);
	assert.match(component, /trackEvent\(\"cpl_cta_exposed\", getSafePlacementParams\(state, city\)\)/);
	assert.match(component, /observer\.disconnect\(\)/);
	assert.match(component, /EXPOSURE_GUARD_KEY/);
	assert.match(component, /typeof IntersectionObserver !== \"function\"/);
});

test("LocalityGuideLayout does not duplicate the CompareSolarPrices integration owned by InstallerCTA", () => {
	assert.ok(!localityLayout.includes("CompareSolarPricesCTA"));
	assert.ok(!localityLayout.includes("compare-solar-prices"));
});

test("outbound referral navigation uses a noopener first-party POST without ambiguous popup-handle fallback", () => {
	assert.match(component, /const form = document\.createElement\("form"\)/);
	assert.match(component, /form\.action = "\/go\/compare-solar-prices"/);
	assert.match(component, /form\.target = "_blank"/);
	assert.match(component, /form\.rel = "noopener"/);
	assert.match(component, /form\.submit\(\)/);
	assert.ok(!component.includes("window.open("));
	assert.ok(!component.includes("window.location.assign(referralUrl)"));
});

test("the click listener is idempotent even if the component script body runs more than once on one page", () => {
	assert.match(component, /GUARD_KEY/);
	assert.match(component, /if \(!\(window as typeof window & Record<string, boolean>\)\[GUARD_KEY\]\)/);
	const guardIndex = component.indexOf("GUARD_KEY] = true");
	const listenerIndex = component.indexOf('document.addEventListener("click"');
	assert.ok(guardIndex > -1 && listenerIndex > guardIndex, "the click listener must be attached inside the guard block, after the guard is set");
});

test("the button is a real, keyboard-operable, accessibly-labeled control", () => {
	assert.match(component, /<button type="button" class="compare-solar-btn"/);
	assert.match(component, /aria-label="CompareSolarPrices referral"/);
	assert.match(component, /:focus-visible/);
});

test("the button tells assistive-technology users it opens in a new tab", () => {
	assert.match(component, /visually-hidden">\(opens in a new tab\)<\/span>/);
});

test("the cid is never written to any persistent client-side storage", () => {
	assert.ok(!component.includes("localStorage"));
	assert.ok(!component.includes("sessionStorage"));
	assert.ok(!component.includes("document.cookie"));
});

test("the CTA script is a real Astro module script, not a raw inline script requiring an unsafe-inline CSP allowance", () => {
	assert.ok(!component.includes('<script is:inline'), "must not use is:inline, which would require unsafe-inline in the site's CSP");
});

test("the component gates rendering on BOTH geo eligibility AND the partner registry's own launch-ready state", () => {
	assert.match(component, /getLaunchReadyPartner\("compare-solar-prices", "cpl"\)/, "must consult the partner registry, not just the geo allowlist");
	assert.match(component, /Boolean\(partner\) && isCompareSolarServedLocality\(state, city\)/);
});

test("CompareSolarPrices is production-active through an explicit dynamic tracking asset, not a fabricated static destination", () => {
	const launchReady = getLaunchReadyPartner("compare-solar-prices", "cpl");
	assert.ok(launchReady);
	assert.equal(isCompareSolarServedLocality("CA", "Irvine"), true);
	const partner = getPartner("compare-solar-prices");
	assert.ok(partner);
	assert.equal(partner.status, "production_active");
	assert.equal(partner.destination, "");
	assert.equal(partner.dynamicTracking, true);
	assert.equal(partner.trackingEnabled, true);
	assert.equal(partner.placementEligible, true);
	assert.equal(partner.launchEnabled, true);
});
