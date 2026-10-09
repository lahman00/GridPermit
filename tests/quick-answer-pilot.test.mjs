import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { QUICK_ANSWER_PILOTS, getQuickAnswerPilot } from "../src/lib/quick-answer-pilots.ts";

const component = readFileSync(new URL("../src/components/LocalityPermitPath.astro", import.meta.url), "utf8");
const layout = readFileSync(new URL("../src/layouts/LocalityGuideLayout.astro", import.meta.url), "utf8");

test("Quick Answer pilot is bounded to Pomona only", () => {
	assert.deepEqual([...QUICK_ANSWER_PILOTS.keys()], ["ca-los-angeles-pomona-sce"]);
	assert.equal(getQuickAnswerPilot("ca-los-angeles-pomona-sce")?.id, "pomona-permit-intent-v1");
	assert.equal(getQuickAnswerPilot("ca-san-diego-chula-vista-sdge"), null);
});

test("Pomona answers remain inside current official-source scope", () => {
	const pilot = getQuickAnswerPilot("ca-los-angeles-pomona-sce");
	assert.ok(pilot);
	assert.deepEqual(pilot.options.map(option => option.id), ["new_rooftop_solar", "solar_plus_storage", "not_sure"]);
	const copy = pilot.options.map(option => `${option.answer} ${option.detail}`).join(" ");
	assert.match(copy, /licensed-contractor/);
	assert.match(copy, /38\.4 kW AC/);
	assert.match(copy, /LA County Fire Department/);
	assert.match(copy, /SCE (?:interconnection and PTO|approval remains separate)/);
	assert.doesNotMatch(copy, /guarantee|savings|instant approval|permit fee/i);
});

test("pilot reuses the existing permit-path component and preserves the paid CTA boundary", () => {
	assert.match(layout, /getQuickAnswerPilot\(record\.record_id\)/);
	assert.match(layout, /quickAnswerPilot=\{quickAnswerPilot\}/);
	assert.equal((layout.match(/mode="commercial-only"/g) ?? []).length, 1);
	assert.equal((layout.match(/mode="resource-only"/g) ?? []).length, 1);
	assert.doesNotMatch(component, /CompareSolarPrices|\/go\/|data-compare-solar-cta/);
});

test("interaction measurement is finite, privacy-safe, and distinct from referral events", () => {
	assert.match(component, /quick_answer_viewed/);
	assert.match(component, /quick_answer_intent_selected/);
	assert.match(component, /project_intent/);
	const safeParams = component.match(/const safeParams = \{[\s\S]*?\n    \};/)?.[0] ?? "";
	assert.match(safeParams, /pilot_id/);
	assert.match(safeParams, /city_slug/);
	assert.match(safeParams, /page_path/);
	assert.doesNotMatch(safeParams, /\b(?:email|phone|address|zip|full_name)\s*:/i);
	assert.match(component, /not a lead or referral/);
});
