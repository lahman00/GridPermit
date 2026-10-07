import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync(new URL("../src/layouts/LocalityGuideLayout.astro", import.meta.url), "utf8");
const compareSolar = readFileSync(new URL("../src/components/CompareSolarPricesCTA.astro", import.meta.url), "utf8");

test("first-lead routes keep in-body and TOC jumps to the quote slot", () => {
	assert.match(layout, /Planning a new solar project\? Jump to the homeowner quote path/);
	assert.match(layout, /isFirstLeadSprintPage \? \[\{ id: "installer-cta", label: "Compare Solar Quote" \}\]/);
});

test("first-lead routes reuse the compact paid slot without weakening the no-existing-solar qualification", () => {
	assert.match(layout, /requireFirstLeadQualification=\{isFirstLeadSprintPage\}/);
	assert.match(compareSolar, /const effectiveQualificationLabel = requireFirstLeadQualification[\s\S]*I own this home and this property does not already have solar\./);
	assert.match(compareSolar, /<span>\{effectiveQualificationLabel\}<\/span>/);
	assert.doesNotMatch(layout, /class="first-lead-panel"|class="first-lead-fit"|class="first-lead-process"/);
});

test("first-lead battery incentive content remains after the early quote slot", () => {
	const paid = layout.indexOf('mode="commercial-only"');
	const post = layout.indexOf('id="battery-incentive"');
	assert.ok(paid >= 0 && post > paid, "battery-incentive section must remain after the early quote slot");
	assert.match(layout, /isFirstLeadSprintPage && batteryPrograms\.length > 0/);
});
