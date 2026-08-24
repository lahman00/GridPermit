// Regression guard for src/components/ProductAffiliateCTA.astro — a
// component that is prepared but must never render anything in production
// until a hardware-affiliate partner is fully launch-ready (see
// docs/MONETIZATION_CANONICAL_STATE.md, Lane C).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getLaunchReadyPartner, getPartnersByChannel } from "../src/lib/partners.ts";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const COMPONENT_PATH = path.join(REPO_ROOT, "src", "components", "ProductAffiliateCTA.astro");
const source = readFileSync(COMPONENT_PATH, "utf8");

test("getLaunchReadyPartner returns null for every current hardware_affiliate partner", () => {
	for (const p of getPartnersByChannel("hardware_affiliate")) {
		assert.equal(getLaunchReadyPartner(p.id, "hardware_affiliate"), null, `${p.name} must not be launch-ready yet`);
	}
});

test("getLaunchReadyPartner returns null when given a non-hardware_affiliate partner id under the hardware_affiliate channel filter", () => {
	// EnergySage exists but is channel "cpl" — must not be mistakenly usable by ProductAffiliateCTA.
	assert.equal(getLaunchReadyPartner("energysage", "hardware_affiliate"), null);
});

test("the component's entire template is gated on partner && partner.destination", () => {
	assert.ok(
		/\{partner\s*&&\s*partner\.destination\s*&&/.test(source),
		"ProductAffiliateCTA.astro must wrap its whole render in a check for both a launch-ready partner AND a real destination URL",
	);
});

test("the component sources its link only from partner.destination, never a literal URL", () => {
	assert.ok(source.includes("partner.destination"), "must reference partner.destination");
	assert.ok(!/href="https?:\/\/(?!.*\{)/i.test(source), "must not contain a hardcoded href URL literal outside of an expression");
});

test("the component does not use superlative or discount claims", () => {
	assert.ok(!/\bbest\b/i.test(source), "must not claim 'best' unless editorially supported elsewhere on the page, not hardcoded here");
	assert.ok(!/\bdiscount\b/i.test(source), "must not claim a discount");
	assert.ok(!/% off\b/i.test(source), "must not claim a percentage-off deal");
});

test("the component uses the correct analytics event names", () => {
	assert.ok(source.includes('data-track-view="affiliate_cta_viewed"'));
	assert.ok(source.includes('data-track-click="affiliate_cta_clicked"'));
});

test("the component derives disclosure text from getDisclosureText rather than hardcoding prose", () => {
	assert.ok(source.includes("getDisclosureText(partner)"), "disclosure copy must come from the shared getDisclosureText() helper, not hardcoded text");
});

test("the component only adds rel=sponsored when compensation is verified", () => {
	assert.ok(
		/compensationVerified\s*\?\s*"sponsored/.test(source),
		"rel=sponsored must be conditional on partner.compensationVerified, never unconditional",
	);
});

test("the component contains no em dash", () => {
	assert.ok(!source.includes("—"), "component copy must not use an em dash");
});
