import assert from "node:assert/strict";
import test from "node:test";

import {
	COMMERCIAL_SEO_PROFILES,
	getCommercialSeoProfile,
} from "../src/lib/commercial-seo-profiles.ts";
import { isCompareSolarServedLocality } from "../src/lib/compare-solar-prices.ts";

const EXPECTED = new Map([
	["ca-san-diego-chula-vista-sdge", "Chula Vista"],
	["ca-los-angeles-pomona-sce", "Pomona"],
	["ca-riverside-menifee-sce", "Menifee"],
	["ca-san-bernardino-chino-hills-sce", "Chino Hills"],
	["ca-orange-fullerton-sce", "Fullerton"],
]);

test("commercial SEO sprint is bounded to exactly the five reviewed active routes", () => {
	assert.deepEqual([...COMMERCIAL_SEO_PROFILES.keys()].sort(), [...EXPECTED.keys()].sort());
	for (const [recordId, city] of EXPECTED) {
		assert.equal(isCompareSolarServedLocality("CA", city), true, `${city} must remain an approved CSP locality`);
		assert.ok(getCommercialSeoProfile(recordId));
	}
	assert.equal(getCommercialSeoProfile("ca-los-angeles-los-angeles-ladwp"), null);
});

test("reviewed titles and descriptions are distinct, concise, and fact-bounded", () => {
	const titles = new Set();
	const descriptions = new Set();
	for (const [recordId, profile] of COMMERCIAL_SEO_PROFILES) {
		const city = EXPECTED.get(recordId);
		assert.ok(profile.title.startsWith(`${city} Solar Permit`));
		assert.ok(profile.title.length <= 65, `${city} title is ${profile.title.length} characters`);
		assert.ok(profile.description.length >= 120, `${city} description is too thin`);
		assert.ok(profile.description.length <= 160, `${city} description is ${profile.description.length} characters`);
		assert.match(profile.description, /(?:SDG&E|SCE) (?:interconnection|PTO)/);
		assert.match(profile.lead, /PTO remains? separate/);
		assert.doesNotMatch(profile.title + profile.description + profile.lead, /guarantee|save \$|approval in/i);
		titles.add(profile.title);
		descriptions.add(profile.description);
	}
	assert.equal(titles.size, EXPECTED.size);
	assert.equal(descriptions.size, EXPECTED.size);
});

test("fee language appears only on the reviewed page with sourced city fees", () => {
	for (const [recordId, profile] of COMMERCIAL_SEO_PROFILES) {
		const includesFees = /fees/i.test(profile.title + profile.description);
		assert.equal(includesFees, recordId === "ca-san-bernardino-chino-hills-sce");
	}
});
