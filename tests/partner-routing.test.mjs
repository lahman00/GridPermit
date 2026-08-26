// Regression guard for src/lib/partner-routing.ts — the generic partner-
// selection engine. Not wired into any production page yet. These tests
// prove the engine fails closed against the real partner registry today,
// and exercise the filtering/tie-break/geo logic in isolation using
// synthetic partner objects so the tests don't need to wait for any real
// partner to launch.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
	getEligiblePartners,
	selectPartner,
	registerGeoEligibilityCheck,
	_resetGeoEligibilityChecksForTests,
} from "../src/lib/partner-routing.ts";

function makePartner(overrides = {}) {
	return {
		id: "test-partner",
		name: "Test Partner",
		status: "approved",
		vertical: "solar",
		channel: "cpl",
		destination: "https://example.com",
		trackingEnabled: true,
		compensationVerified: true,
		placementEligible: true,
		disclosureType: "affiliate",
		launchEnabled: true,
		payoutType: "per_lead",
		geo: "US",
		trafficSources: ["organic_search"],
		eligiblePageTypes: ["locality_guide"],
		lastVerified: "2026-08-26",
		...overrides,
	};
}

const CA_LOCALITY_CPL = { channel: "cpl", pageType: "locality_guide", state: "CA", city: "Irvine" };

test("against the real registry, getEligiblePartners returns [] for a realistic locality CPL context today", () => {
	const result = getEligiblePartners(CA_LOCALITY_CPL);
	assert.deepEqual(result, [], "no partner in src/lib/partners.ts is launch-ready yet, so nothing should ever be eligible");
});

test("against the real registry, selectPartner returns null for realistic CPL, pay_per_call, and hardware_affiliate contexts today", () => {
	assert.equal(selectPartner({ channel: "cpl", pageType: "locality_guide", state: "CA", city: "Irvine" }), null);
	assert.equal(selectPartner({ channel: "pay_per_call", pageType: "locality_guide", state: "TX", city: "Austin" }), null);
	assert.equal(selectPartner({ channel: "hardware_affiliate", pageType: "battery_editorial", state: "US", city: "" }), null);
});

test("a fully launch-ready synthetic partner is eligible when channel, page type, and geo all match", () => {
	const partner = makePartner();
	const result = getEligiblePartners(CA_LOCALITY_CPL, [partner]);
	assert.deepEqual(result, [partner]);
});

test("a synthetic partner is excluded when the channel does not match", () => {
	const partner = makePartner({ channel: "hardware_affiliate" });
	assert.deepEqual(getEligiblePartners(CA_LOCALITY_CPL, [partner]), []);
});

test("a synthetic partner is excluded when the page type is not in eligiblePageTypes", () => {
	const partner = makePartner({ eligiblePageTypes: ["battery_editorial"] });
	assert.deepEqual(getEligiblePartners(CA_LOCALITY_CPL, [partner]), []);
});

test("a synthetic partner is excluded when not launch-ready (launchEnabled false), even if geo/channel/pageType all match", () => {
	const partner = makePartner({ launchEnabled: false });
	assert.deepEqual(getEligiblePartners(CA_LOCALITY_CPL, [partner]), []);
});

test("a synthetic partner with a non-US geo string is excluded by the fallback geo check when no fine-grained check is registered", () => {
	const partner = makePartner({ geo: "EU" });
	assert.deepEqual(getEligiblePartners(CA_LOCALITY_CPL, [partner]), []);
});

test("a synthetic partner with geo 'US-CA-Southern-California' passes the loose fallback prefix match", () => {
	const partner = makePartner({ geo: "US-CA-Southern-California" });
	assert.deepEqual(getEligiblePartners(CA_LOCALITY_CPL, [partner]), [partner]);
});

test("registerGeoEligibilityCheck overrides the loose fallback with a real fine-grained check", () => {
	const partner = makePartner({ id: "narrow-geo-partner", geo: "US-CA-Southern-California" });
	try {
		registerGeoEligibilityCheck("narrow-geo-partner", (state, city) => state === "CA" && city === "Irvine");

		assert.deepEqual(getEligiblePartners({ channel: "cpl", pageType: "locality_guide", state: "CA", city: "Irvine" }, [partner]), [partner], "Irvine, CA must pass the registered check");
		assert.deepEqual(getEligiblePartners({ channel: "cpl", pageType: "locality_guide", state: "CA", city: "Fresno" }, [partner]), [], "Fresno, CA must fail the registered check even though the loose geo string alone would have passed");
		assert.deepEqual(getEligiblePartners({ channel: "cpl", pageType: "locality_guide", state: "TX", city: "Irvine" }, [partner]), [], "a same-named city in the wrong state must still fail");
	} finally {
		_resetGeoEligibilityChecksForTests();
	}
});

test("selectPartner never returns more than one partner even when two competing partners of the same channel are both eligible", () => {
	const a = makePartner({ id: "partner-a" });
	const b = makePartner({ id: "partner-b" });
	const result = selectPartner(CA_LOCALITY_CPL, [a, b]);
	assert.ok(result === a || result === b, "must return exactly one of the two, never both, never an array");
	assert.ok(!Array.isArray(result));
});

test("selectPartner prefers the partner listed first in CHANNEL_PRIORITY for that channel", () => {
	const lowerPriority = makePartner({ id: "energysage" });
	const higherPriority = makePartner({ id: "compare-solar-prices" });
	// Order in the input array is deliberately reversed to prove priority, not array order, decides the winner.
	const result = selectPartner(CA_LOCALITY_CPL, [lowerPriority, higherPriority]);
	assert.equal(result.id, "compare-solar-prices");
});

test("selectPartner falls back to the first eligible partner when none match the channel's priority list", () => {
	const partner = makePartner({ id: "brand-new-unlisted-partner" });
	const result = selectPartner(CA_LOCALITY_CPL, [partner]);
	assert.equal(result.id, "brand-new-unlisted-partner");
});

test("selectPartner and getEligiblePartners agree: selectPartner only ever returns a partner getEligiblePartners also considers eligible", () => {
	const eligible = makePartner({ id: "eligible-one" });
	const ineligible = makePartner({ id: "ineligible-one", launchEnabled: false });
	const result = selectPartner(CA_LOCALITY_CPL, [eligible, ineligible]);
	const eligibleList = getEligiblePartners(CA_LOCALITY_CPL, [eligible, ineligible]);
	assert.ok(eligibleList.some((p) => p.id === result.id));
	assert.ok(!eligibleList.some((p) => p.id === "ineligible-one"));
});
