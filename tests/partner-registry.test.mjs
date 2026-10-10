// Regression guard for src/lib/partners.ts — the partner control-plane.
// These invariants must hold as partners move from staged to production so a
// launch can never surface a rejected, unapproved, untracked, or accidentally
// enabled partner.

import { test } from "node:test";
import assert from "node:assert/strict";
import { PARTNERS, getActivePartners, getPartner, getPartnersByChannel, isLaunchReady, getDisclosureText } from "../src/lib/partners.ts";

test("rejected partners can never be placement-eligible", () => {
	for (const p of PARTNERS) {
		if (p.status === "rejected") {
			assert.equal(p.placementEligible, false, `${p.name} is rejected and must not be placementEligible`);
		}
	}
});

test("no partner claims tracking is enabled without a real static, phone, or explicitly dynamic tracking asset", () => {
	for (const p of PARTNERS) {
		if (p.trackingEnabled) {
			assert.ok(
				p.destination.length > 0 || Boolean(p.trackingPhone) || p.dynamicTracking === true,
				`${p.name} has trackingEnabled=true but no static destination, trackingPhone, or dynamicTracking asset — a missing tracking asset must never masquerade as tracked`,
			);
		}
	}
});

test("dynamic tracking can never be declared while tracking is disabled", () => {
	for (const p of PARTNERS) {
		if (p.dynamicTracking) {
			assert.equal(p.trackingEnabled, true, `${p.name} declares dynamicTracking but trackingEnabled is false`);
		}
	}
});

test("no partner is marked affiliate-disclosed without verified compensation", () => {
	for (const p of PARTNERS) {
		if (p.disclosureType === "affiliate") {
			assert.equal(p.compensationVerified, true, `${p.name} uses disclosureType "affiliate" but compensationVerified is false — disclosure must match actual verified state`);
		}
	}
});

test("launchEnabled=true exists only on a deliberately production-active partner that passes the full gate", () => {
	for (const p of PARTNERS) {
		if (p.launchEnabled) {
			assert.equal(p.status, "production_active", `${p.name} has launchEnabled=true without production_active status`);
			assert.equal(isLaunchReady(p), true, `${p.name} has launchEnabled=true but does not pass the full launch gate`);
		}
	}
});

test("CompareSolarPrices is the one current active partner and every other partner remains launch-disabled", () => {
	const active = getActivePartners();
	assert.deepEqual(active.map((p) => p.id), ["compare-solar-prices"]);
	for (const p of PARTNERS) {
		if (p.id !== "compare-solar-prices") {
			assert.equal(p.launchEnabled, false, `${p.name} must remain launch-disabled until deliberately activated`);
		}
	}
});

test("ALLPOWERS remains fail-closed while its submitted CJ application is pending", () => {
	const partner = getPartner("allpowers");
	assert.ok(partner);
	assert.equal(partner.status, "pending_approval");
	assert.equal(partner.destination, "");
	assert.equal(partner.trackingEnabled, false);
	assert.equal(partner.placementEligible, false);
	assert.equal(partner.launchEnabled, false);
	assert.equal(isLaunchReady(partner), false);
});

test("isLaunchReady() fails closed: unapproved status never passes even with everything else set", () => {
	const hypothetical = {
		id: "hypothetical",
		name: "Hypothetical",
		status: "pending_approval",
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
		lastVerified: "2026-08-25",
	};
	assert.equal(isLaunchReady(hypothetical), false, "an unapproved status must fail closed regardless of every other field");
});

test("isLaunchReady() fails closed: approved but trackingEnabled=false never passes", () => {
	const hypothetical = {
		id: "hypothetical",
		name: "Hypothetical",
		status: "approved",
		vertical: "solar",
		channel: "cpl",
		destination: "https://example.com",
		trackingEnabled: false,
		compensationVerified: true,
		placementEligible: true,
		disclosureType: "affiliate",
		launchEnabled: true,
		payoutType: "per_lead",
		geo: "US",
		trafficSources: ["organic_search"],
		eligiblePageTypes: ["locality_guide"],
		lastVerified: "2026-08-25",
	};
	assert.equal(isLaunchReady(hypothetical), false, "trackingEnabled === false must fail closed even when approved and launchEnabled");
});

test("isLaunchReady() fails closed: approved + tracked but launchEnabled=false never passes", () => {
	const hypothetical = {
		id: "hypothetical",
		name: "Hypothetical",
		status: "approved",
		vertical: "solar",
		channel: "cpl",
		destination: "https://example.com",
		trackingEnabled: true,
		compensationVerified: true,
		placementEligible: true,
		disclosureType: "affiliate",
		launchEnabled: false,
		payoutType: "per_lead",
		geo: "US",
		trafficSources: ["organic_search"],
		eligiblePageTypes: ["locality_guide"],
		lastVerified: "2026-08-25",
	};
	assert.equal(isLaunchReady(hypothetical), false, "launchEnabled === false must fail closed even when approved and tracked");
});

test("isLaunchReady() fails closed: approved + tracked + launchEnabled but empty destination and no phone/dynamic asset never passes", () => {
	const hypothetical = {
		id: "hypothetical",
		name: "Hypothetical",
		status: "approved",
		vertical: "solar",
		channel: "pay_per_call",
		destination: "",
		trackingEnabled: true,
		compensationVerified: true,
		placementEligible: true,
		disclosureType: "pay_per_call",
		launchEnabled: true,
		payoutType: "per_call",
		geo: "US",
		trafficSources: ["organic_search"],
		eligiblePageTypes: ["locality_guide"],
		lastVerified: "2026-08-25",
	};
	assert.equal(isLaunchReady(hypothetical), false, "a missing static, phone, and dynamic tracking asset must fail closed even with every other gate satisfied");
});

test("isLaunchReady() passes only when every gate is satisfied, and accepts a phone-only tracking asset", () => {
	const hypothetical = {
		id: "hypothetical",
		name: "Hypothetical",
		status: "approved",
		vertical: "solar",
		channel: "pay_per_call",
		destination: "",
		trackingPhone: "+18005551234",
		trackingEnabled: true,
		compensationVerified: true,
		placementEligible: true,
		disclosureType: "pay_per_call",
		launchEnabled: true,
		payoutType: "per_call",
		geo: "US",
		trafficSources: ["organic_search"],
		eligiblePageTypes: ["locality_guide"],
		lastVerified: "2026-08-25",
	};
	assert.equal(isLaunchReady(hypothetical), true, "a fully-satisfied partner with a phone-only tracking asset must pass");
});

test("isLaunchReady() accepts an explicitly dynamic tracking asset when every other gate is satisfied", () => {
	const hypothetical = {
		id: "hypothetical-dynamic",
		name: "Hypothetical Dynamic",
		status: "production_active",
		vertical: "solar",
		channel: "cpl",
		destination: "",
		dynamicTracking: true,
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
	};
	assert.equal(isLaunchReady(hypothetical), true);
});

test("every partner with a non-empty destination uses https", () => {
	for (const p of PARTNERS) {
		if (p.destination.length > 0) {
			assert.ok(p.destination.startsWith("https://"), `${p.name}'s destination must be https`);
		}
	}
});

test("the EnergySage entry never references the known-dead partner page", () => {
	const energysage = getPartner("energysage");
	assert.ok(energysage);
	assert.ok(!energysage.destination.includes("/p/gridpermit/"), "EnergySage's registry destination must not reference the known-404 partner page");
});

test("every partner id is unique", () => {
	const ids = PARTNERS.map((p) => p.id);
	assert.equal(new Set(ids).size, ids.length, "duplicate partner id found");
});

test("every partner has a non-empty lastVerified date", () => {
	for (const p of PARTNERS) {
		assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(p.lastVerified), `${p.name}'s lastVerified must be an ISO date (YYYY-MM-DD)`);
	}
});

test("getPartnersByChannel() only returns partners of the requested channel", () => {
	for (const channel of ["cpl", "pay_per_call", "hardware_affiliate", "general_referral"]) {
		const matches = getPartnersByChannel(channel);
		for (const p of matches) {
			assert.equal(p.channel, channel);
		}
	}
});

test("the DMM entry is channel pay_per_call and is not placement-eligible yet", () => {
	const dmm = getPartner("digital-master-media");
	assert.ok(dmm);
	assert.equal(dmm.channel, "pay_per_call");
	assert.equal(dmm.placementEligible, false, "DMM must not be placement-eligible until final terms/tracking arrive");
	assert.equal(dmm.trackingEnabled, false);
	assert.equal(dmm.destination, "");
	assert.equal(dmm.trackingPhone, undefined, "no placeholder tracking phone must ever be set for DMM");
});

test("no partner has a fabricated payoutValue without payoutType being a specific type", () => {
	for (const p of PARTNERS) {
		if (p.payoutValue !== undefined) {
			assert.notEqual(p.payoutType, "unknown", `${p.name} has a payoutValue set but payoutType is "unknown" — a numeric payout must always specify what it measures`);
		}
	}
});

test("getDisclosureText() never returns pay-per-call language for a non-pay-per-call partner", () => {
	for (const p of PARTNERS) {
		if (p.disclosureType !== "pay_per_call") {
			assert.ok(!getDisclosureText(p).includes("recorded"), `${p.name}'s disclosure must not mention call recording unless disclosureType is pay_per_call`);
		}
	}
});

test("getDisclosureText() never asserts compensation is happening unless compensationVerified is true", () => {
	for (const p of PARTNERS) {
		const text = getDisclosureText(p);
		if (!p.compensationVerified) {
			assert.ok(!/\bmay earn\b.*\bcommission\b/i.test(text) || !p.trackingEnabled, `${p.name}'s disclosure must not claim an active tracked commission without verified compensation`);
		}
	}
});
