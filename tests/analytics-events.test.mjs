// Unit tests for the reusable GA4 event-tracking helper
// (src/lib/analytics-events.ts). These check the helper's pure logic in
// isolation: the fixed event allowlist, PII/param stripping, and graceful
// no-op behavior when gtag isn't available — the DOM wiring itself (in
// src/components/Analytics.astro) is exercised manually in the browser per
// this project's standard QA process.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
	ANALYTICS_EVENTS,
	isKnownAnalyticsEvent,
	sanitizeAnalyticsParams,
	trackEvent,
} from "../src/lib/analytics-events.ts";

test("ANALYTICS_EVENTS is exactly the 18 approved conversion events", () => {
	assert.deepEqual(
		[...ANALYTICS_EVENTS].sort(),
		[
			"blog_article_viewed",
			"calculator_completed",
			"calculator_started",
			"external_partner_clicked",
			"faq_expanded",
			"locality_guide_viewed",
			"official_source_clicked",
			"page_not_found",
			"permit_guide_clicked",
			"pro_interest_clicked",
			"search_used",
			"affiliate_cta_viewed",
			"affiliate_cta_clicked",
			"cpl_cta_viewed",
			"cpl_cta_exposed",
			"cpl_cta_clicked",
			"pay_per_call_cta_viewed",
			"pay_per_call_clicked",
		].sort(),
	);
});

test("isKnownAnalyticsEvent accepts only names in ANALYTICS_EVENTS", () => {
	for (const name of ANALYTICS_EVENTS) {
		assert.equal(isKnownAnalyticsEvent(name), true);
	}
	assert.equal(isKnownAnalyticsEvent("page_view"), false);
	assert.equal(isKnownAnalyticsEvent("form_submit"), false);
	assert.equal(isKnownAnalyticsEvent(""), false);
});

test("sanitizeAnalyticsParams strips ZIP, bill, and contact-detail keys", () => {
	const dirty = {
		zip: "94103",
		zip_code: "94103",
		zipcode: "94103",
		bill: 250,
		bill_amount: 250,
		monthly_bill: 250,
		email: "user@example.com",
		phone: "555-1234",
		name: "Jane Doe",
		address: "1 Market St",
		result_count: 3,
		partner: "energysage",
	};
	const clean = sanitizeAnalyticsParams(dirty);
	assert.deepEqual(clean, { result_count: 3, partner: "energysage" });
});

test("sanitizeAnalyticsParams strips forbidden keys case-insensitively", () => {
	const clean = sanitizeAnalyticsParams({ ZIP: "94103", Email: "a@b.com", city: "Oakland" });
	assert.deepEqual(clean, { city: "Oakland" });
});

test("trackEvent is a no-op (does not throw) when window is unavailable", () => {
	assert.equal(typeof window, "undefined");
	assert.doesNotThrow(() => trackEvent("search_used"));
});

test("trackEvent is a no-op when window.gtag is not a function", () => {
	globalThis.window = {};
	try {
		assert.doesNotThrow(() => trackEvent("search_used"));
	} finally {
		delete globalThis.window;
	}
});

test("trackEvent calls gtag with the event name and sanitized params when gtag is available", () => {
	const calls = [];
	globalThis.window = { gtag: (...args) => calls.push(args) };
	try {
		trackEvent("search_used", { result_count: 5, zip: "94103" });
		assert.equal(calls.length, 1);
		assert.deepEqual(calls[0], ["event", "search_used", { result_count: 5 }]);
	} finally {
		delete globalThis.window;
	}
});

test("trackEvent silently ignores an unknown event name and never calls gtag", () => {
	const calls = [];
	globalThis.window = { gtag: (...args) => calls.push(args) };
	try {
		trackEvent(/** @type {any} */ ("not_a_real_event"), {});
		assert.equal(calls.length, 0);
	} finally {
		delete globalThis.window;
	}
});

test("cpl_cta_exposed is an approved first-lead funnel event", () => {
	assert.equal(isKnownAnalyticsEvent("cpl_cta_exposed"), true);
});

test("sanitizeAnalyticsParams strips common PII aliases and camelCase variants", () => {
	const dirty = {
		email_address: "user@example.com",
		contactEmail: "user@example.com",
		phone_number: "555-1234",
		contactPhone: "555-1234",
		street_address: "1 Market St",
		postal_code: "94103",
		credit_score: "720",
		utility_bill: "250",
		full_name: "Jane Doe",
		referral_cid: "abc123",
		acquisition_tag: "fl_src_01",
		page_path: "/california/hemet/solar-permit-guide/",
	};
	assert.deepEqual(sanitizeAnalyticsParams(dirty), {
		referral_cid: "abc123",
		acquisition_tag: "fl_src_01",
		page_path: "/california/hemet/solar-permit-guide/",
	});
});

test("sanitizeAnalyticsParams allows only the fixed non-PII first-lead page_location shape", () => {
	const safeLocation = "https://mygridpermit.com/california/hemet/solar-permit-guide/?gp_cid=abc123&gp_src=fl_src_02";
	assert.deepEqual(
		sanitizeAnalyticsParams({ page_location: safeLocation, partner: "compare_solar_prices" }),
		{ page_location: safeLocation, partner: "compare_solar_prices" },
	);
	for (const unsafe of [
		"https://mygridpermit.com/california/hemet/solar-permit-guide/?email=user@example.com",
		"https://evil.example/california/hemet/solar-permit-guide/?gp_cid=abc123&gp_src=fl_src_02",
		"https://mygridpermit.com/california/irvine/solar-permit-guide/?gp_cid=abc123&gp_src=fl_src_01",
		"https://mygridpermit.com/california/hemet/solar-permit-guide/?gp_cid=abc123&gp_src=fl_src_01",
		"https://mygridpermit.com/california/hemet/solar-permit-guide/?gp_cid=abc123&gp_src=fl_src_04",
		"https://mygridpermit.com/california/hemet/solar-permit-guide/?gp_cid=abc123&gp_src=arbitrary",
	]) {
		assert.deepEqual(sanitizeAnalyticsParams({ page_location: unsafe, partner: "compare_solar_prices" }), { partner: "compare_solar_prices" });
	}
});
