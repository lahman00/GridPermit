import assert from "node:assert/strict";
import test from "node:test";

import {
	COMMERCIAL_SEO_PROFILES,
	getCommercialSeoProfile,
} from "../src/lib/commercial-seo-profiles.ts";
import { isCompareSolarServedLocality } from "../src/lib/compare-solar-prices.ts";

const EXPECTED = new Map([
	["ca-kern-bakersfield-pge", "Bakersfield"],
	["ca-fresno-fresno-pge", "Fresno"],
	["ca-ventura-oxnard-sce", "Oxnard"],
	["ca-san-diego-chula-vista-sdge", "Chula Vista"],
	["ca-los-angeles-pomona-sce", "Pomona"],
	["ca-riverside-menifee-sce", "Menifee"],
	["ca-san-bernardino-chino-hills-sce", "Chino Hills"],
	["ca-orange-fullerton-sce", "Fullerton"],
	["ca-los-angeles-cerritos-sce", "Cerritos"],
	["ca-orange-laguna-beach-sce", "Laguna Beach"],
	["ca-san-bernardino-ontario-sce", "Ontario"],
	["ca-los-angeles-torrance-sce", "Torrance"],
	["ca-los-angeles-lakewood-sce", "Lakewood"],
]);

test("SEO profiles stay bounded to reviewed pages without activating unpaid routes", () => {
	assert.deepEqual([...COMMERCIAL_SEO_PROFILES.keys()].sort(), [...EXPECTED.keys()].sort());
	for (const [recordId, city] of EXPECTED) {
		assert.equal(isCompareSolarServedLocality("CA", city), !["Bakersfield", "Fresno"].includes(city), `${city} commercial eligibility must remain unchanged`);
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
		assert.match(profile.description, /(?:SDG&E|SCE|PG&E) (?:interconnection|PTO)/);
		assert.match(profile.lead, /PTO remains? separate/);
		assert.doesNotMatch(profile.title + profile.description + profile.lead, /guarantee|save \$|approval in/i);
		titles.add(profile.title);
		descriptions.add(profile.description);
	}
	assert.equal(titles.size, EXPECTED.size);
	assert.equal(descriptions.size, EXPECTED.size);
});

test("new search copy distinguishes Fresno jurisdictions and Oxnard contractor scope", () => {
	const fresno = getCommercialSeoProfile("ca-fresno-fresno-pge");
	assert.match(fresno.lead, /covers City of Fresno permits/);
	assert.match(fresno.description, /separate Fresno County permit links/);
	const oxnard = getCommercialSeoProfile("ca-ventura-oxnard-sce");
	assert.match(oxnard.lead, /for licensed contractors/);
	for (const id of ["ca-kern-bakersfield-pge", "ca-fresno-fresno-pge", "ca-ventura-oxnard-sce"]) {
		const profile = getCommercialSeoProfile(id);
		assert.doesNotMatch(profile.title + profile.description + profile.lead, /\$\d|\d+\s*kW|same.day|guarantee/i);
	}
});

test("fee language appears only where a sourced city fee is available", () => {
	for (const [recordId, profile] of COMMERCIAL_SEO_PROFILES) {
		const includesFees = /\bfees?\b/i.test(profile.title + profile.description);
		assert.equal(
			includesFees,
			recordId === "ca-san-bernardino-chino-hills-sce" || recordId === "ca-los-angeles-cerritos-sce",
		);
	}
});

test("new opportunity copy preserves the verified local distinction", () => {
	const cerritos = getCommercialSeoProfile("ca-los-angeles-cerritos-sce");
	assert.match(cerritos.description, /\$360 City planning fee/);
	assert.match(cerritos.lead, /LA County building review/);

	const lagunaBeach = getCommercialSeoProfile("ca-orange-laguna-beach-sce");
	assert.match(lagunaBeach.description, /three-business-day decision rule/);
	assert.doesNotMatch(lagunaBeach.title + lagunaBeach.description, /\$1,000|fee cap/i);

	const ontario = getCommercialSeoProfile("ca-san-bernardino-ontario-sce");
	assert.match(ontario.description, /Symbium instant plan-review/);
	assert.match(ontario.lead, /real-time plan review/);
});

test("held-candidate copy stays inside each City's published path", () => {
	const torrance = getCommercialSeoProfile("ca-los-angeles-torrance-sce");
	assert.match(torrance.description, /under 38\.4 kW AC/);
	assert.match(torrance.lead, /automated permit path/);
	assert.doesNotMatch(torrance.title + torrance.description + torrance.lead, /SolarAPP|instant|same.day/i);

	const lakewood = getCommercialSeoProfile("ca-los-angeles-lakewood-sce");
	assert.match(lakewood.description, /SolarAPP\+ instant permit path/);
	assert.match(lakewood.lead, /Submittal Checklist/);
	assert.doesNotMatch(lakewood.title + lakewood.description + lakewood.lead, /\d+\s*kW|\$\d/);
});
