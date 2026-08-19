// Regression guard for src/lib/partners.ts — the partner control-plane
// data. This registry is not yet wired into any rendered component, but
// these invariants must hold from day one so a future wiring change can't
// accidentally surface a rejected/unapproved/untracked partner.

import { test } from "node:test";
import assert from "node:assert/strict";
import { PARTNERS, getActivePartners, getPartner } from "../src/lib/partners.ts";

test("rejected partners can never be placement-eligible", () => {
	for (const p of PARTNERS) {
		if (p.status === "rejected") {
			assert.equal(p.placementEligible, false, `${p.name} is rejected and must not be placementEligible`);
		}
	}
});

test("no partner claims tracking is enabled without a real destination URL", () => {
	for (const p of PARTNERS) {
		if (p.trackingEnabled) {
			assert.ok(p.destination.length > 0, `${p.name} has trackingEnabled=true but no destination — a missing tracking URL must never masquerade as tracked`);
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

test("getActivePartners() only returns approved + tracked + placement-eligible partners with a real destination", () => {
	const active = getActivePartners();
	for (const p of active) {
		assert.equal(p.status, "approved");
		assert.equal(p.trackingEnabled, true);
		assert.equal(p.placementEligible, true);
		assert.ok(p.destination.length > 0);
	}
});

test("getActivePartners() is currently empty — no partner has reached approved + tracking-link-received yet", () => {
	// This is the honest current state of the whole pipeline (see
	// docs/AFFILIATE_PARTNER_PIPELINE.md and docs/FIRST_DOLLAR_CHECKLIST.md).
	// If this test ever fails because the array is non-empty, that's good
	// news — it means a partner was genuinely approved — but it should
	// fail LOUDLY and require deliberately updating this test, not pass
	// silently on a partner that was never actually approved.
	assert.deepEqual(getActivePartners(), []);
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
