import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync(new URL("../src/layouts/LocalityGuideLayout.astro", import.meta.url), "utf8");

test("first-lead routes expose an in-body and TOC jump to the quote panel", () => {
	assert.match(layout, /Planning a new solar project\? Jump to the homeowner quote path/);
	assert.match(layout, /isFirstLeadSprintPage \? \[\{ id: "installer-cta", label: "Compare Solar Quote" \}\]/);
});

test("first-lead panel states both positive and negative fit", () => {
	assert.match(layout, /Best fit:<\/strong> you own the home and do not already have solar/);
	assert.match(layout, /Not the right quote path:<\/strong> renters or properties that already have solar/);
});

test("battery incentive callout is moved after the first-lead panel for cohort routes", () => {
	assert.match(layout, /!isFirstLeadSprintPage && \(/);
	const panel = layout.indexOf('id="installer-cta"');
	const post = layout.indexOf('id="battery-incentive"');
	assert.ok(panel >= 0 && post > panel, "battery-incentive section must render after installer-cta for cohort routes");
	assert.match(layout, /isFirstLeadSprintPage && batteryPrograms\.length > 0/);
});
