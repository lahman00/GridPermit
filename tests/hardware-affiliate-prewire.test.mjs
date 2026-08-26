import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { selectPartner } from "../src/lib/partner-routing.ts";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const WRAPPER = readFileSync(path.join(REPO_ROOT, "src/components/HardwareAffiliateCTA.astro"), "utf8");
const SDGE = readFileSync(path.join(REPO_ROOT, "src/pages/blog/sdge-battery-roi-guide.astro"), "utf8");
const NEM3 = readFileSync(path.join(REPO_ROOT, "src/pages/blog/solar-battery-payback-nem3.astro"), "utf8");

test("hardware affiliate wrapper routes through the shared fail-closed selector", () => {
	assert.match(WRAPPER, /selectPartner\(\{/);
	assert.match(WRAPPER, /channel: "hardware_affiliate"/);
	assert.match(WRAPPER, /pageType: "battery_editorial"/);
	assert.match(WRAPPER, /<ProductAffiliateCTA partnerId=\{partner\.id\}/);
});

test("no hardware affiliate is active today", () => {
	assert.equal(selectPartner({ channel: "hardware_affiliate", pageType: "battery_editorial", state: "CA", city: "San Diego" }), null);
});

test("only battery-intent articles are prewired", () => {
	assert.match(SDGE, /HardwareAffiliateCTA/);
	assert.match(NEM3, /HardwareAffiliateCTA/);
});

test("prewired CTA copy stays category-level and does not manufacture product claims", () => {
	for (const source of [SDGE, NEM3]) {
		assert.match(source, /productLabel="Battery and backup-power products"/);
		assert.ok(!source.includes("best battery"));
		assert.ok(!source.includes("cheapest battery"));
		assert.ok(!source.includes("guaranteed savings"));
	}
});
