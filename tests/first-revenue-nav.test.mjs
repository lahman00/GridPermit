import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync(new URL("../src/layouts/LocalityGuideLayout.astro", import.meta.url), "utf8");

test("California revenue nav defaults safely and upgrades only from a rendered approved CTA", () => {
	assert.match(layout, /data-contextual-revenue-nav>Estimate Savings<\/a>/);
	assert.match(layout, /querySelector\("#installer-cta button\[data-compare-solar-cta\]"\)/);
	assert.match(layout, /if \(nav && approvedQuote\)/);
	assert.match(layout, /nav\.href = "#installer-cta"/);
	assert.match(layout, /nav\.textContent = "Compare Solar Quote"/);
});
