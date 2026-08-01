import { test } from "node:test";
import assert from "node:assert/strict";

import {
	NOT_VERIFIED,
	SITE_ORIGIN,
	getActiveBatteryPrograms,
	formatTimeline,
	withFallback,
	buildFaqs,
	buildFaqSchema,
	utilityShortName,
	resolvePermitAuthorityLabel,
	buildBreadcrumbItems,
	confidenceBadgeClass,
} from "../src/lib/locality-guide.ts";

test("confidenceBadgeClass matches the same tiering as confidenceLabel", () => {
	assert.equal(confidenceBadgeClass(0.9), "badge-high");
	assert.equal(confidenceBadgeClass(0.8), "badge-high");
	assert.equal(confidenceBadgeClass(0.79), "badge-medium");
	assert.equal(confidenceBadgeClass(0.5), "badge-medium");
	assert.equal(confidenceBadgeClass(0.49), "badge-low");
	assert.equal(confidenceBadgeClass(0.01), "badge-low");
	assert.equal(confidenceBadgeClass(0), "badge-none");
	assert.equal(confidenceBadgeClass("not a number"), "badge-unknown");
	assert.equal(confidenceBadgeClass(undefined), "badge-unknown");
});

const samplePrograms = [
	{ name: "SGIP - Residential Solar and Storage Equity", status: "unknown", description: "..." },
	{ name: "SGIP - Equity Resiliency", status: "expired", description: "..." },
	{ name: "Local Storage Rebate", status: "active", description: "..." },
];

test("getActiveBatteryPrograms filters out unknown and expired programs", () => {
	const active = getActiveBatteryPrograms(samplePrograms);
	assert.equal(active.length, 1);
	assert.ok(active.every((p) => p.status === "active"));
	assert.ok(!active.some((p) => p.status === "unknown" || p.status === "expired"));
});

test("getActiveBatteryPrograms keeps active programs", () => {
	const onlyActive = [{ name: "A", status: "active" }, { name: "B", status: "active" }];
	assert.deepEqual(getActiveBatteryPrograms(onlyActive), onlyActive);
});

test("getActiveBatteryPrograms returns an empty array for null/undefined/empty input", () => {
	assert.deepEqual(getActiveBatteryPrograms(null), []);
	assert.deepEqual(getActiveBatteryPrograms(undefined), []);
	assert.deepEqual(getActiveBatteryPrograms([]), []);
});

test("formatTimeline scopes a 0/0 range to SolarAPP+ eligibility, never a general same-day claim", () => {
	const result = formatTimeline({ min_days: 0, max_days: 0 });
	assert.equal(result.isSameDaySolarAppOnly, true);
	assert.equal(result.label, "Same-day review for eligible SolarAPP+ projects");
	assert.match(result.label, /SolarAPP\+/);
	assert.doesNotMatch(result.label, /^Same day$/);
	assert.equal(result.standardPathCaveat, "No verified standard-path permit timeline is available.");
});

test("formatTimeline renders a plain day range with no standard-path caveat when not a 0/0 range", () => {
	const single = formatTimeline({ min_days: 5, max_days: 5 });
	assert.equal(single.label, "5 days");
	assert.equal(single.standardPathCaveat, null);

	const range = formatTimeline({ min_days: 3, max_days: 10 });
	assert.equal(range.label, "3–10 days");
	assert.equal(range.standardPathCaveat, null);
});

test("withFallback renders null/undefined values as Not yet verified.", () => {
	assert.equal(withFallback(null), NOT_VERIFIED);
	assert.equal(withFallback(undefined), NOT_VERIFIED);
	assert.equal(withFallback("Oakland"), "Oakland");
	assert.equal(withFallback(0), 0);
});

function buildRecord(overrides = {}) {
	return {
		city: { value: "Oakland" },
		utility: { value: "Pacific Gas and Electric Company (PG&E)" },
		generation_supplier: { value: null },
		timeline_days: { value: null },
		required_documents: { value: null },
		official_contacts: { value: null },
		...overrides,
	};
}

test("buildFaqs always includes the utility question, scoped to record fields", () => {
	const faqs = buildFaqs(buildRecord());
	assert.equal(faqs.length, 1);
	assert.match(faqs[0].q, /utility serves solar customers in Oakland/);
	assert.match(faqs[0].a, /Pacific Gas and Electric Company \(PG&E\)/);
});

test("buildFaqs omits generation-supplier, timeline, documents, and contact facts when unsupported by the record", () => {
	const faqs = buildFaqs(buildRecord());
	const joined = faqs.map((f) => `${f.q} ${f.a}`).join(" ");
	assert.doesNotMatch(joined, /Community Choice Aggregator/);
	assert.doesNotMatch(joined, /permit take in Oakland/);
	assert.doesNotMatch(joined, /documents are required/);
	assert.doesNotMatch(joined, /contact about solar permits/);
});

test("buildFaqs' timeline entry is scoped to SolarAPP+ eligibility and carries the standard-path caveat", () => {
	const faqs = buildFaqs(
		buildRecord({ timeline_days: { value: { min_days: 0, max_days: 0, notes: null }, confidence: 0.75 } }),
	);
	const timelineFaq = faqs.find((f) => /permit take in Oakland/.test(f.q));
	assert.ok(timelineFaq, "expected a timeline FAQ entry");
	assert.match(timelineFaq.q, /SolarAPP\+-eligible/);
	assert.doesNotMatch(timelineFaq.a, /^Same day/);
	assert.match(timelineFaq.a, /No verified standard-path permit timeline is available\./);
});

test("buildFaqs adds a documents entry only when required_documents is populated", () => {
	const faqs = buildFaqs(
		buildRecord({ required_documents: { value: [{ name: "Site plan" }, { name: "Roof plan" }] } }),
	);
	const docsFaq = faqs.find((f) => /documents are required/.test(f.q));
	assert.ok(docsFaq);
	assert.match(docsFaq.a, /Site plan; Roof plan/);
});

test("buildFaqSchema returns null for an empty FAQ list and a valid FAQPage otherwise", () => {
	assert.equal(buildFaqSchema([]), null);
	const schema = buildFaqSchema([{ q: "Q?", a: "A." }]);
	assert.equal(schema["@type"], "FAQPage");
	assert.equal(schema.mainEntity.length, 1);
	assert.equal(schema.mainEntity[0].name, "Q?");
	assert.equal(schema.mainEntity[0].acceptedAnswer.text, "A.");
});

// --- Municipal utility record (no IOU-style "(ABBR)" parenthetical) ---

test("utilityShortName falls back to the full name for a municipal utility with no parenthetical", () => {
	assert.equal(utilityShortName("Pasadena Water and Power"), "Pasadena Water and Power");
});

test("utilityShortName still extracts the abbreviation for an IOU-style name", () => {
	assert.equal(utilityShortName("Pacific Gas and Electric Company (PG&E)"), "PG&E");
});

test("utilityShortName returns null for a missing utility value", () => {
	assert.equal(utilityShortName(null), null);
	assert.equal(utilityShortName(undefined), null);
	assert.equal(utilityShortName(""), null);
});

test("buildFaqs' utility question reads correctly for a municipal utility record", () => {
	const municipalRecord = buildRecord({ utility: { value: "Pasadena Water and Power" } });
	const faqs = buildFaqs(municipalRecord);
	assert.match(faqs[0].a, /Pasadena Water and Power is the interconnection and distribution utility for Oakland\./);
});

// --- County permit authority (must not assume "City of {city}") ---

test("resolvePermitAuthorityLabel uses record.permit_authority.value verbatim, even for a county authority", () => {
	const countyRecord = buildRecord({
		permit_authority: { value: "County of Alameda Planning Department" },
	});
	assert.equal(resolvePermitAuthorityLabel(countyRecord), "County of Alameda Planning Department");
});

test("resolvePermitAuthorityLabel does not fabricate a 'City of X' label when the authority isn't a city", () => {
	const countyRecord = buildRecord({
		permit_authority: { value: "County of Alameda Planning Department" },
	});
	const label = resolvePermitAuthorityLabel(countyRecord);
	assert.doesNotMatch(label, /^City of/);
});

test("resolvePermitAuthorityLabel renders Not yet verified. when permit_authority is null", () => {
	const record = buildRecord({ permit_authority: { value: null } });
	assert.equal(resolvePermitAuthorityLabel(record), NOT_VERIFIED);
});

// --- Explicit city breadcrumb path (never derived from splitting pagePath) ---

test("buildBreadcrumbItems uses the explicit cityPath, not a path derived from pagePath", () => {
	const record = buildRecord({ city: { value: "Pasadena" } });
	// Deliberately mismatched with any naive parent-of-pagePath guess, to prove
	// the city URL comes only from the explicit cityPath argument.
	const items = buildBreadcrumbItems(record, {
		cityPath: "/california/los-angeles-county/pasadena/",
		pageUrl: `${SITE_ORIGIN}/california/pasadena/solar-permit-guide/`,
	});
	const cityItem = items.find((i) => i.name === "Pasadena");
	assert.ok(cityItem);
	assert.equal(cityItem.url, `${SITE_ORIGIN}/california/los-angeles-county/pasadena/`);
});

test("buildBreadcrumbItems supports a custom page label and keeps Home/California fixed", () => {
	const record = buildRecord({ city: { value: "Fremont" } });
	const items = buildBreadcrumbItems(record, {
		cityPath: "/california/fremont/",
		pageUrl: `${SITE_ORIGIN}/california/fremont/solar-permit-guide/`,
		pageLabel: "Custom Guide Title",
	});
	assert.deepEqual(
		items.map((i) => i.name),
		["Home", "California", "Fremont", "Custom Guide Title"],
	);
	assert.equal(items[0].url, `${SITE_ORIGIN}/`);
	assert.equal(items[1].url, `${SITE_ORIGIN}/california/`);
});

// --- Malformed / missing optional fields must not crash rendering helpers ---

test("buildFaqs does not crash when generation_supplier, timeline_days, and official_contacts are entirely absent from the record", () => {
	const sparseRecord = {
		city: { value: "Oakland" },
		utility: { value: "Pacific Gas and Electric Company (PG&E)" },
		generation_supplier: { value: null },
		required_documents: { value: null },
		official_contacts: { value: null },
		// timeline_days omitted entirely (not just null) — optional chaining in
		// buildFaqs must tolerate a missing key, not just a null value.
	};
	assert.doesNotThrow(() => buildFaqs(sparseRecord));
	const faqs = buildFaqs(sparseRecord);
	assert.equal(faqs.length, 1);
});

test("getActiveBatteryPrograms does not crash on malformed program entries missing description", () => {
	const malformed = [{ name: "No description field", status: "active" }];
	assert.doesNotThrow(() => getActiveBatteryPrograms(malformed));
	const active = getActiveBatteryPrograms(malformed);
	assert.equal(active.length, 1);
	assert.equal(active[0].description, undefined);
});

test("formatTimeline does not crash when notes is missing entirely", () => {
	assert.doesNotThrow(() => formatTimeline({ min_days: 2, max_days: 4 }));
	const result = formatTimeline({ min_days: 2, max_days: 4 });
	assert.equal(result.label, "2–4 days");
});

test("withFallback does not crash on an empty string (a real, non-missing value)", () => {
	assert.doesNotThrow(() => withFallback(""));
	assert.equal(withFallback(""), "");
});
