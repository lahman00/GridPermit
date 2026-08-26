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
import { getLaunchReadyPartner, getPartner, getDisclosureText, PARTNERS } from "../src/lib/partners.ts";

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

test("the component renders its disclosure from getDisclosureText(), not a hardcoded sentence", () => {
	assert.match(source, /getDisclosureText\(partner\)/, "disclosure must be computed from partner state, not literal prose, so a partner-specific requiredDisclosureText override actually takes effect");
	assert.match(source, /\{disclosure &&/, "the disclosure paragraph must only render when getDisclosureText() actually returns text");
});

test("the generic pay_per_call disclosure template still mentions call recording for any partner without a requiredDisclosureText override", () => {
	const genericPayPerCall = { disclosureType: "pay_per_call" };
	assert.match(getDisclosureText(genericPayPerCall), /recorded/i);
});

test("a partner's requiredDisclosureText, when set, overrides the generic pay_per_call template verbatim", () => {
	const withOverride = {
		disclosureType: "pay_per_call",
		requiredDisclosureText: "GridPermit connects you with an independent service provider. Calls may be recorded; results are not guaranteed.",
	};
	assert.equal(getDisclosureText(withOverride), withOverride.requiredDisclosureText);
});

test("every current pay_per_call partner's payout fields are never referenced anywhere in the component source", () => {
	for (const p of PARTNERS) {
		if (p.channel !== "pay_per_call") continue;
		assert.ok(!source.includes("payoutValue"), "PayPerCallCTA.astro must never render payoutValue to users");
		assert.ok(!source.includes("payoutType"), "PayPerCallCTA.astro must never render payoutType to users");
	}
});

test("the component fails closed against a populated eligibleZips list when serviceZip is not confirmed to be in it", () => {
	assert.match(source, /zipEligible/, "must gate rendering on a computed zipEligible check when eligibleZips is populated");
	assert.match(source, /partner\?\.eligibleZips\?\.length/, "must only apply the ZIP gate when eligibleZips is actually populated, never treat an unset list as zero eligible ZIPs");
});

test("the component contains no em dash", () => {
	assert.ok(!source.includes("—"), "component copy must not use an em dash");
});
