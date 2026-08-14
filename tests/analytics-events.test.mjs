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

test("ANALYTICS_EVENTS is exactly the 10 approved conversion events", () => {
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
			"permit_guide_clicked",
			"pro_interest_clicked",
			"search_used",
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
