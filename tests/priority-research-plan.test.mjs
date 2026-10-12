import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../scripts/build-priority-research-plan.mjs", import.meta.url), "utf8");

test("priority research plan is bounded to the owner-selected 14 cities and official sources", () => {
	const cityBlock = script.match(/const PRIORITY_CITIES = \[([\s\S]*?)\];/)?.[1] ?? "";
	const cities = [...cityBlock.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
	assert.equal(cities.length, 14);
	assert.equal(new Set(cities).size, 14);
	assert.equal(cities[0], "Los Angeles", "the largest city market should run first");
	assert.ok(cities.indexOf("Irvine") > cities.indexOf("Riverside"), "19 impressions must not override a larger market");
	assert.match(script, /official 2020 Census population/);
	assert.match(script, /does not invent search-volume estimates/);
	assert.match(script, /Accept only a current first-party source/);
	assert.match(script, /If the official source does not state the answer, leave the value unverified/);
});
