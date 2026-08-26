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

const OBVIOUS_PLACEHOLDER_PHONES = ["0000000000", "1234567890", "5555555555", "5550100", "1111111111"];

test("no partner has an obviously-placeholder tracking phone", () => {
	for (const p of PARTNERS) {
		if (!p.trackingPhone) continue;
		const digitsOnly = p.trackingPhone.replace(/\D/g, "");
		for (const placeholder of OBVIOUS_PLACEHOLDER_PHONES) {
			assert.ok(!digitsOnly.includes(placeholder), `${p.name} trackingPhone looks like a placeholder`);
		}
	}
});

test("tracking phone cannot exist while tracking is disabled", () => {
	for (const p of PARTNERS) {
		if (p.trackingPhone) assert.equal(p.trackingEnabled, true, `${p.name} has a tracking phone but trackingEnabled=false`);
	}
});

test("all non-empty partner destinations use HTTPS", () => {
	for (const p of PARTNERS) {
		if (p.destination) assert.ok(p.destination.startsWith("https://"), `${p.name} destination must use HTTPS`);
	}
});

test("rejected and blocked partners are completely excluded from monetized launch", () => {
	for (const p of PARTNERS) {
		if (p.status === "rejected" || p.status === "blocked") {
			assert.equal(p.placementEligible, false, `${p.name} must not be placement eligible`);
			assert.equal(p.trackingEnabled, false, `${p.name} must not have tracking enabled`);
			assert.equal(p.launchEnabled, false, `${p.name} must not be launch enabled`);
		}
	}
});

test("disclosure cannot imply active tracked compensation without verified state", () => {
	for (const p of PARTNERS) {
		const text = getDisclosureText(p);
		if (!text) continue;
		const activeClaim = /\bmay earn\b.*\b(commission|compensation)\b/i.test(text) && !/not\s+(yet\s+)?(confirmed|tracked)/i.test(text);
		if (activeClaim) assert.ok(p.compensationVerified && p.trackingEnabled, `${p.name} disclosure outruns verified tracking/compensation state`);
	}
});

test("notes never claim full approval when status does not", () => {
	const approvedLike = new Set(["approved", "tracking_received", "ready_for_production", "production_active"]);
	for (const p of PARTNERS) {
		if (approvedLike.has(p.status)) continue;
		assert.ok(!/\b(is|now)\s+(fully\s+)?approved\b/i.test(p.notes ?? ""), `${p.name} notes outrun status ${p.status}`);
	}
});

test("permit-locality template never imports hardware affiliate CTA", () => {
	assert.ok(!read("src/layouts/LocalityGuideLayout.astro").includes("ProductAffiliateCTA"));
});

test("low/no-intent pages never import partner CTA components", () => {
	const ctas = ["InstallerCTA", "PayPerCallCTA", "ProductAffiliateCTA", "CompareSolarPricesCTA"];
	const pages = ["src/pages/about.astro", "src/pages/privacy.astro", "src/pages/terms.astro", "src/pages/contact.astro", "src/pages/methodology.astro", "src/pages/404.astro"];
	for (const page of pages) {
		const source = read(page);
		for (const cta of ctas) assert.ok(!source.includes(cta), `${page} must not import ${cta}`);
	}
});

test("inactive pay-per-call and hardware CTA components remain unwired", () => {
	const pages = [
		"src/layouts/LocalityGuideLayout.astro",
		"src/pages/index.astro",
		"src/pages/[state]/index.astro",
		"src/pages/california/index.astro",
		"src/pages/california/solar-permit-guides.astro",
		"src/pages/california/solar-permit-timeline.astro",
		"src/pages/california/county/[slug].astro",
		"src/pages/california/utility/[slug].astro",
	];
	for (const page of pages) {
		const source = read(page);
		assert.ok(!source.includes("PayPerCallCTA"), `${page} must not import PayPerCallCTA before a partner is launch-ready`);
		assert.ok(!source.includes("ProductAffiliateCTA"), `${page} must not import ProductAffiliateCTA before a partner is launch-ready`);
	}
});

test("numeric payouts are finite and plausible", () => {
	for (const p of PARTNERS) {
		if (p.payoutValue === undefined) continue;
		assert.ok(Number.isFinite(p.payoutValue) && p.payoutValue >= 0, `${p.name} payoutValue must be non-negative and finite`);
		if (p.payoutType === "per_sale_percent") assert.ok(p.payoutValue <= 100, `${p.name} percentage payout must be <=100`);
	}
});
