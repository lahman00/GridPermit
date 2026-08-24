// Regression guard for src/lib/partners.ts — the partner control-plane
// data. This registry is not yet wired into any rendered component, but
// these invariants must hold from day one so a future wiring change can't
// accidentally surface a rejected/unapproved/untracked partner.

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

test("no partner claims tracking is enabled without a real destination or tracking phone", () => {
	for (const p of PARTNERS) {
		if (p.trackingEnabled) {
			assert.ok(
				p.destination.length > 0 || Boolean(p.trackingPhone),
				`${p.name} has trackingEnabled=true but no destination or trackingPhone — a missing tracking asset must never masquerade as tracked`,
			);
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

test("every partner defaults launchEnabled to false", () => {
	for (const p of PARTNERS) {
		assert.equal(p.launchEnabled, false, `${p.name} must default launchEnabled to false — no partner has been deliberately launched yet`);
	}
});

test("getActivePartners() is currently empty — no partner has reached approved + tracking + launch-enabled yet", () => {
	// This is the honest current state of the whole pipeline (see
	// docs/MONETIZATION_CANONICAL_STATE.md). If this test ever fails because
	// the array is non-empty, that's good news — it means a partner was
	// genuinely approved, tracked, and deliberately launched — but it should
	// fail LOUDLY and require deliberately updating this test, not pass
	// silently on a partner that was never actually approved.
	assert.deepEqual(getActivePartners(), []);
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
	assert.equal(isLaunchReady(hypothetical), false, "status !== 'approved' must fail closed regardless of every other field");
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

test("isLaunchReady() fails closed: approved + tracked + launchEnabled but empty destination and no phone never passes", () => {
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
	assert.equal(isLaunchReady(hypothetical), false, "a missing destination AND missing trackingPhone must fail closed even with every other gate satisfied");
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
