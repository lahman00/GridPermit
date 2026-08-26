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

test("real registry currently routes no active monetized partner", () => {
	assert.deepEqual(getEligiblePartners(CA_LOCALITY_CPL), []);
	assert.equal(selectPartner(CA_LOCALITY_CPL), null);
	assert.equal(selectPartner({ channel: "pay_per_call", pageType: "locality_guide", state: "TX", city: "Austin" }), null);
});

test("fully launch-ready nationwide partner is eligible", () => {
	const partner = makePartner();
	assert.deepEqual(getEligiblePartners(CA_LOCALITY_CPL, [partner]), [partner]);
});

test("channel mismatch fails closed", () => {
	assert.deepEqual(getEligiblePartners(CA_LOCALITY_CPL, [makePartner({ channel: "hardware_affiliate" })]), []);
});

test("page-type mismatch fails closed", () => {
	assert.deepEqual(getEligiblePartners(CA_LOCALITY_CPL, [makePartner({ eligiblePageTypes: ["battery_editorial"] })]), []);
});

test("unlaunched partner fails closed", () => {
	assert.deepEqual(getEligiblePartners(CA_LOCALITY_CPL, [makePartner({ launchEnabled: false })]), []);
});

test("non-US partner fails closed without a registered check", () => {
	assert.deepEqual(getEligiblePartners(CA_LOCALITY_CPL, [makePartner({ geo: "EU" })]), []);
});

test("narrow US geo fails closed until a fine-grained check is registered", () => {
	const partner = makePartner({ id: "narrow-geo-partner", geo: "US-CA-Southern-California" });
	assert.deepEqual(getEligiblePartners(CA_LOCALITY_CPL, [partner]), []);
});

test("registered fine-grained geo check admits only the verified locality", () => {
	const partner = makePartner({ id: "narrow-geo-partner", geo: "US-CA-Southern-California" });
	try {
		registerGeoEligibilityCheck("narrow-geo-partner", (state, city) => state === "CA" && city === "Irvine");
		assert.deepEqual(getEligiblePartners(CA_LOCALITY_CPL, [partner]), [partner]);
		assert.deepEqual(getEligiblePartners({ ...CA_LOCALITY_CPL, city: "Fresno" }, [partner]), []);
		assert.deepEqual(getEligiblePartners({ ...CA_LOCALITY_CPL, state: "TX" }, [partner]), []);
	} finally {
		_resetGeoEligibilityChecksForTests();
	}
});

test("selectPartner returns at most one competing partner", () => {
	const a = makePartner({ id: "partner-a" });
	const b = makePartner({ id: "partner-b" });
	const result = selectPartner(CA_LOCALITY_CPL, [a, b]);
	assert.ok(result === a || result === b);
	assert.ok(!Array.isArray(result));
});

test("channel priority wins independent of input order", () => {
	const lower = makePartner({ id: "energysage" });
	const higher = makePartner({ id: "compare-solar-prices", geo: "US" });
	assert.equal(selectPartner(CA_LOCALITY_CPL, [lower, higher]).id, "compare-solar-prices");
});

test("unlisted launch-ready partner remains selectable", () => {
	const partner = makePartner({ id: "brand-new-unlisted-partner" });
	assert.equal(selectPartner(CA_LOCALITY_CPL, [partner]).id, partner.id);
});
