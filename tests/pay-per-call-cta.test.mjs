// Regression guard for src/components/PayPerCallCTA.astro — a component
// that is prepared but must never render anything in production until a
// partner is fully launch-ready (see docs/MONETIZATION_CANONICAL_STATE.md,
// Lane A). Two layers are tested: the pure gating logic in
// src/lib/partners.ts (getLaunchReadyPartner), and static safety invariants
// on the component's own source (no hardcoded phone number, no
// unsubstantiated claims, correct analytics event names).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getLaunchReadyPartner, getPartner } from "../src/lib/partners.ts";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const COMPONENT_PATH = path.join(REPO_ROOT, "src", "components", "PayPerCallCTA.astro");
const source = readFileSync(COMPONENT_PATH, "utf8");

test("getLaunchReadyPartner returns null for every current partner on the pay_per_call channel", () => {
	// DMM is the only pay_per_call partner today and is not launch-ready yet.
	assert.equal(getLaunchReadyPartner("digital-master-media", "pay_per_call"), null);
});

test("getLaunchReadyPartner returns null when given a non-pay_per_call partner id under the pay_per_call channel filter", () => {
	// EnergySage exists but is channel "cpl" — must not be mistakenly usable by PayPerCallCTA.
	assert.equal(getLaunchReadyPartner("energysage", "pay_per_call"), null);
});

test("getLaunchReadyPartner returns null for an unknown partner id", () => {
	assert.equal(getLaunchReadyPartner("does-not-exist", "pay_per_call"), null);
});

test("DMM has no trackingPhone set anywhere in the registry (no placeholder number)", () => {
	const dmm = getPartner("digital-master-media");
	assert.ok(dmm);
	assert.equal(dmm.trackingPhone, undefined);
});

test("the component's entire template is gated on partner && partner.trackingPhone", () => {
	assert.ok(
		/\{partner\s*&&\s*partner\.trackingPhone\s*&&/.test(source),
		"PayPerCallCTA.astro must wrap its whole render in a check for both a launch-ready partner AND a real trackingPhone",
	);
});

test("the component sources its phone number only from partner.trackingPhone, never a literal number", () => {
	assert.ok(source.includes("partner.trackingPhone"), "must reference partner.trackingPhone");
	// No literal U.S.-style phone number pattern should appear anywhere in the source.
	assert.ok(!/\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/.test(source), "must not contain a hardcoded/placeholder phone number literal");
});

test("the component does not claim the call is free", () => {
	assert.ok(!/\bfree call\b/i.test(source), "must not claim the call is free unless that has been verified");
});

test("the component does not claim direct connection to an installer", () => {
	assert.ok(!/connect(s)? (you )?directly with an? installer/i.test(source), "must not claim direct installer connection unless verified");
});

test("the component makes no guaranteed-quote or savings claims", () => {
	assert.ok(!/guarantee/i.test(source), "must not use the word 'guarantee' anywhere");
});

test("the component uses the correct analytics event names", () => {
	assert.ok(source.includes('data-track-view="pay_per_call_cta_viewed"'));
	assert.ok(source.includes('data-track-click="pay_per_call_clicked"'));
});

test("the component includes a call-recording disclosure", () => {
	assert.ok(/recorded/i.test(source), "must disclose that calls may be recorded");
});

test("the component contains no em dash", () => {
	assert.ok(!source.includes("—"), "component copy must not use an em dash");
});
