// Cross-cutting monetization safety guardrails that aren't specific to any
// one partner or component. These exist so a future change that quietly
// introduces a real regression (a placeholder tracking number, a hardcoded
// stronger-than-true compensation claim, a hardware-affiliate CTA leaking
// onto a permit-locality page, a low-intent page gaining a partner CTA)
// fails loudly here rather than shipping silently.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PARTNERS, getDisclosureText } from "../src/lib/partners.ts";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function read(relPath) {
	return readFileSync(path.join(REPO_ROOT, relPath), "utf8");
}

const OBVIOUS_PLACEHOLDER_PHONES = [
	"0000000000",
	"1234567890",
	"5555555555",
	"5550100", // the reserved 555-01xx fictional-number range
	"1111111111",
];

test("no partner has an obviously-placeholder trackingPhone", () => {
	for (const p of PARTNERS) {
		if (!p.trackingPhone) continue;
		const digitsOnly = p.trackingPhone.replace(/\D/g, "");
		for (const placeholder of OBVIOUS_PLACEHOLDER_PHONES) {
			assert.ok(!digitsOnly.includes(placeholder), `${p.name}'s trackingPhone looks like a placeholder (contains ${placeholder})`);
		}
	}
});

test("no partner has a trackingPhone set while trackingEnabled is false", () => {
	for (const p of PARTNERS) {
		if (p.trackingPhone) {
			assert.equal(p.trackingEnabled, true, `${p.name} has a trackingPhone but trackingEnabled is false — a real number must never sit unused/unflagged`);
		}
	}
});

test("no partner has an HTTP (non-HTTPS) destination", () => {
	for (const p of PARTNERS) {
		if (p.destination.length > 0) {
			assert.ok(!p.destination.startsWith("http://"), `${p.name}'s destination must not be plain HTTP`);
		}
	}
});

test("every rejected or blocked partner is excluded from placement and tracking", () => {
	for (const p of PARTNERS) {
		if (p.status === "rejected" || p.status === "blocked") {
			assert.equal(p.placementEligible, false, `${p.name} is ${p.status} and must not be placementEligible`);
			assert.equal(p.trackingEnabled, false, `${p.name} is ${p.status} and must not be trackingEnabled`);
			assert.equal(p.launchEnabled, false, `${p.name} is ${p.status} and must not be launchEnabled`);
		}
	}
});

test("no partner's disclosure text claims stronger compensation than its own verified state", () => {
	for (const p of PARTNERS) {
		const text = getDisclosureText(p);
		if (!text) continue;
		const claimsActiveCommission = /\bmay earn\b.*\b(commission|compensation)\b/i.test(text) && !/not\s+(yet\s+)?(confirmed|tracked)/i.test(text);
		if (claimsActiveCommission) {
			assert.ok(p.compensationVerified && p.trackingEnabled, `${p.name}'s disclosure implies an active tracked commission but compensationVerified/trackingEnabled don't both support that`);
		}
	}
});

test("no partner's internal research notes assert a stronger approval status than its own status field", () => {
	// A notes field is allowed to describe research/history ("confirmed by
	// email", "direct fit confirmed"), but must not claim the partner itself
	// is APPROVED/ACTIVE in the sense the registry's own status vocabulary
	// uses, unless the status field agrees.
	const approvedLikeStatuses = new Set(["approved", "tracking_received", "ready_for_production", "production_active"]);
	for (const p of PARTNERS) {
		if (approvedLikeStatuses.has(p.status)) continue;
		const notes = p.notes ?? "";
		assert.ok(
			!/\b(is|now)\s+(fully\s+)?approved\b/i.test(notes),
			`${p.name}'s notes claim it "is approved" while status is "${p.status}" — notes must not outrun the registry's own status field`,
		);
	}
});

test("LocalityGuideLayout.astro (the permit/locality page template) never imports a hardware-affiliate CTA component", () => {
	const layout = read("src/layouts/LocalityGuideLayout.astro");
	assert.ok(!layout.includes("ProductAffiliateCTA"), "hardware affiliate links must never appear on permit-locality pages, per docs/MONETIZATION_PLACEMENT_MAP.md");
});

test("low/no-intent pages never import any partner CTA component", () => {
	const partnerCtaNames = ["InstallerCTA", "PayPerCallCTA", "ProductAffiliateCTA", "CompareSolarPricesCTA"];
	const lowIntentPages = ["src/pages/about.astro", "src/pages/privacy.astro", "src/pages/terms.astro", "src/pages/contact.astro", "src/pages/methodology.astro", "src/pages/404.astro"];
	for (const pagePath of lowIntentPages) {
		const source = read(pagePath);
		for (const name of partnerCtaNames) {
			assert.ok(!source.includes(name), `${pagePath} must not import ${name} — trust/legal/informational pages carry no monetization per docs/MONETIZATION_PLACEMENT_MAP.md`);
		}
	}
});

test("PayPerCallCTA and ProductAffiliateCTA are not imported by any currently-committed production page", () => {
	// These components are staged/inert by design. If a future change wires
	// one in, that's a deliberate activation decision that should update this
	// test explicitly, not slip in silently as a side effect of an unrelated
	// change.
	const pagesAndLayouts = [
		"src/layouts/LocalityGuideLayout.astro",
		"src/pages/index.astro",
		"src/pages/[state]/index.astro",
		"src/pages/california/index.astro",
		"src/pages/california/solar-permit-guides.astro",
		"src/pages/california/solar-permit-timeline.astro",
		"src/pages/california/county/[slug].astro",
		"src/pages/california/utility/[slug].astro",
	];
	for (const pagePath of pagesAndLayouts) {
		const source = read(pagePath);
		assert.ok(!source.includes("PayPerCallCTA"), `${pagePath} must not import PayPerCallCTA yet — no pay-per-call partner is launch-ready`);
		assert.ok(!source.includes("ProductAffiliateCTA"), `${pagePath} must not import ProductAffiliateCTA yet — no hardware-affiliate partner is launch-ready`);
	}
});

test("every partner's payoutValue, when present, is a plausible finite non-negative number", () => {
	for (const p of PARTNERS) {
		if (p.payoutValue === undefined) continue;
		assert.ok(Number.isFinite(p.payoutValue) && p.payoutValue >= 0, `${p.name}'s payoutValue must be a plausible non-negative number`);
		if (p.payoutType === "per_sale_percent") {
			assert.ok(p.payoutValue <= 100, `${p.name}'s per_sale_percent payoutValue must be a plausible percentage (<=100)`);
		}
	}
});
