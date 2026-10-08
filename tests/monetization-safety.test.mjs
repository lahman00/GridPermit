// Regression guard for the one live monetization surface (InstallerCTA +
// homepage EnergySage CTA). Both now source their link and disclosure from
// src/lib/partners.ts (getPartner, getCplState, getCplDisclosureText)
// rather than hardcoding prose, so a future approval only requires a data
// change in partners.ts. This suite checks both layers: the pure state
// machine in partners.ts, and structural safety invariants on the two
// component sources (no dead URL, no premature rel="sponsored", correct
// analytics attribute, safe external-link attributes).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPartner, getCplState, getCplDisclosureText } from "../src/lib/partners.ts";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const INSTALLER_CTA_PATH = path.join(REPO_ROOT, "src", "components", "InstallerCTA.astro");
const HOMEPAGE_PATH = path.join(REPO_ROOT, "src", "pages", "index.astro");

const installerCta = readFileSync(INSTALLER_CTA_PATH, "utf8");
const homepage = readFileSync(HOMEPAGE_PATH, "utf8");

// The exact URL that returned a real 404 from EnergySage's own server on
// 2026-08-15 (see docs/MONETIZATION_CANONICAL_STATE.md) — production was
// reverted off it once; nothing should silently point back at it.
const KNOWN_DEAD_URL = "/p/gridpermit/";

test("the live EnergySage partner record's destination is the plain root, not the known-dead page", () => {
	const energysage = getPartner("energysage");
	assert.ok(energysage);
	assert.ok(!energysage.destination.includes(KNOWN_DEAD_URL), `partners.ts energysage.destination must not reference ${KNOWN_DEAD_URL}`);
	assert.equal(energysage.destination, "https://www.energysage.com");
});

test("today's EnergySage relationship classifies as UNTRACKED_RELATIONSHIP", () => {
	const energysage = getPartner("energysage");
	assert.ok(energysage);
	assert.equal(getCplState(energysage), "UNTRACKED_RELATIONSHIP", "trackingEnabled is false today, so the CPL state machine must classify it as untracked, not a stronger state");
});

test("getCplDisclosureText never asserts a paid or verified partner relationship for an untracked resource", () => {
	const text = getCplDisclosureText("UNTRACKED_RELATIONSHIP", "EnergySage");
	assert.match(text, /independent third-party resource/i);
	assert.match(text, /not currently tracked for compensation/i);
	assert.ok(!/\bearns?\s+(a\s+)?(commission|compensation)\b/i.test(text), "must not claim compensation is actively being earned");
	assert.ok(!/approved partnership|partner relationship/i.test(text), "must not imply an approved or verified relationship in the untracked state");
});

test("getCplDisclosureText for ACTIVE_CPL states a real commission claim only for that state", () => {
	const text = getCplDisclosureText("ACTIVE_CPL", "EnergySage");
	assert.ok(/may earn GridPermit a commission/.test(text));
});

test("getCplDisclosureText produces four distinct, non-empty strings for the four CPL states", () => {
	const states = ["UNTRACKED_RELATIONSHIP", "TRACKED_UNCONFIRMED_COMPENSATION", "APPROVED_CPL", "ACTIVE_CPL"];
	const texts = states.map((s) => getCplDisclosureText(s, "EnergySage"));
	for (const t of texts) assert.ok(t.length > 0);
	assert.equal(new Set(texts).size, texts.length, "each CPL state must produce distinct disclosure copy");
});

for (const [label, source] of [
	["InstallerCTA.astro", installerCta],
	["index.astro (homepage)", homepage],
]) {
	test(`${label} does not hardcode the known-dead EnergySage partner page`, () => {
		assert.ok(!source.includes(KNOWN_DEAD_URL), `${label} must not reference ${KNOWN_DEAD_URL} anywhere in its source`);
	});

	test(`${label} sources its EnergySage link from the partner registry, not a hardcoded literal`, () => {
		assert.ok(
			/href=\{(partner|energysage)\.destination\}/.test(source),
			`${label} must use href={partner.destination} (or energysage.destination) so a future tracked-link update is a data change, not a template change`,
		);
		assert.ok(!/href="https:\/\/www\.energysage\.com/.test(source), `${label} must not also hardcode a literal EnergySage URL alongside the dynamic one`);
	});

	test(`${label} does not add rel="sponsored" in its own markup`, () => {
		assert.ok(!/rel="[^"]*\bsponsored\b/.test(source), `${label} must not mark the EnergySage link rel="sponsored" in its own markup — that asserts a paid placement, and compensation from this partnership has not been independently verified`);
	});

	test(`${label} external EnergySage link opens safely (target=_blank + noopener)`, () => {
		assert.ok(/target="_blank"/.test(source) && /rel="noopener noreferrer"/.test(source), `${label}'s external EnergySage link must use target="_blank" rel="noopener noreferrer"`);
	});

	test(`${label} EnergySage link fires the external_partner_clicked analytics event`, () => {
		assert.ok(
			source.includes('data-track-click="external_partner_clicked"'),
			`${label} must keep data-track-click="external_partner_clicked" on the EnergySage link so click volume stays measurable`,
		);
	});

	test(`${label} does not hardcode a compensation claim in its own markup`, () => {
		const compensationClaims = source.match(/earns?\s+(a\s+)?(commission|compensation|referral fee)/gi) ?? [];
		assert.equal(compensationClaims.length, 0, `${label} must not hardcode a compensation claim string; disclosure copy must come from getCplDisclosureText()`);
	});

	test(`${label} renders disclosure text via getCplDisclosureText, not a hardcoded sentence`, () => {
		assert.ok(
			/getCplDisclosureText\(getCplState\(/.test(source) || /\{(disclosure|energysageDisclosure)\}/.test(source),
			`${label} must render its disclosure paragraph from the computed CPL state, not literal prose`,
		);
	});
}


for (const rel of [
	"src/content/blog/pge-nem3-calculator.md",
	"src/content/blog/sce-guide.md",
	"src/content/blog/sgip-battery-rebates-california.md",
]) {
	test(`${rel} does not leak decision-stage traffic to a hardcoded untracked EnergySage CTA`, () => {
		const source = readFileSync(path.join(REPO_ROOT, rel), "utf8");
		assert.ok(!source.includes("[Compare solar and battery installer options on EnergySage](https://www.energysage.com)"));
	});
}
