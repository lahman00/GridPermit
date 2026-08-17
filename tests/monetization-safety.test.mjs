// Regression guard for the one live monetization surface (InstallerCTA +
// homepage EnergySage CTA). Nothing here was previously asserted by a
// test — a future edit could silently point the CTA back at the dead
// /p/gridpermit/ partner page (see docs/AFFILIATE_PARTNER_PIPELINE.md), or
// start claiming compensation before it's actually confirmed, with nothing
// catching it before production.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const INSTALLER_CTA_PATH = path.join(REPO_ROOT, "src", "components", "InstallerCTA.astro");
const HOMEPAGE_PATH = path.join(REPO_ROOT, "src", "pages", "index.astro");

const installerCta = readFileSync(INSTALLER_CTA_PATH, "utf8");
const homepage = readFileSync(HOMEPAGE_PATH, "utf8");

// The exact URL that returned a real 404 from EnergySage's own server on
// 2026-08-15 (see docs/AFFILIATE_PARTNER_PIPELINE.md) — production was
// reverted off it once; nothing should silently point back at it.
const KNOWN_DEAD_URL = "https://www.energysage.com/p/gridpermit/";

for (const [label, source] of [
	["InstallerCTA.astro", installerCta],
	["index.astro (homepage)", homepage],
]) {
	// Isolate the actual <a> tag pointing at EnergySage — several tests
	// below need to check its attributes specifically, not the whole file
	// (which also contains explanatory comments that happen to mention
	// strings like rel="sponsored" as something NOT to do).
	const anchorMatch = source.match(/<a\s+href="https:\/\/www\.energysage\.com[^>]*>/);

	test(`${label} does not link to the known-dead EnergySage partner page`, () => {
		assert.ok(
			!source.includes(KNOWN_DEAD_URL),
			`${label} must not reference ${KNOWN_DEAD_URL} — it 404s; the live CTA must use the plain https://www.energysage.com root link until EnergySage confirms the partner page is published`,
		);
	});

	test(`${label} EnergySage link is a plain https URL with no unverified tracking params`, () => {
		const hrefMatch = source.match(/href="(https:\/\/www\.energysage\.com[^"]*)"/);
		assert.ok(hrefMatch, `${label} must contain an https://www.energysage.com link`);
		const href = hrefMatch[1];
		assert.ok(!href.includes("?"), `${label}'s EnergySage link must not carry query-string tracking params until a real tracked affiliate URL is supplied`);
	});

	test(`${label} does not add rel="sponsored" while compensation is unverified`, () => {
		assert.ok(anchorMatch, `${label} must contain an <a> tag linking to EnergySage`);
		assert.ok(
			!/\bsponsored\b/.test(anchorMatch[0]),
			`${label} must not mark the EnergySage link rel="sponsored" — that asserts a paid placement, and compensation from this partnership has not been independently verified (see docs/AFFILIATE_PARTNER_PIPELINE.md)`,
		);
	});

	test(`${label} external EnergySage link opens safely (target=_blank + noopener)`, () => {
		assert.ok(anchorMatch, `${label} must contain an <a> tag linking to EnergySage`);
		assert.ok(
			/target="_blank"/.test(anchorMatch[0]) && /rel="noopener noreferrer"/.test(anchorMatch[0]),
			`${label}'s external EnergySage link must use target="_blank" rel="noopener noreferrer"`,
		);
	});

	test(`${label} EnergySage link fires the external_partner_clicked analytics event`, () => {
		assert.ok(anchorMatch, `${label} must contain an <a> tag linking to EnergySage`);
		assert.ok(
			anchorMatch[0].includes('data-track-click="external_partner_clicked"'),
			`${label} must keep data-track-click="external_partner_clicked" on the EnergySage link so click volume stays measurable`,
		);
	});

	test(`${label} disclosure does not assert compensation is actually being earned`, () => {
		// The honest, current disclosure says compensation "has not yet
		// been confirmed" — that phrase is fine. What must never appear is
		// language asserting compensation IS happening (e.g. "earns a
		// commission", "receives compensation") without a "not confirmed"
		// / "not verified" qualifier alongside it.
		const compensationClaims = source.match(/earns?\s+(a\s+)?(commission|compensation|referral fee)/gi) ?? [];
		for (const claim of compensationClaims) {
			assert.fail(`${label} contains an unqualified compensation claim ("${claim}") — compensation from the EnergySage partnership has not been independently verified`);
		}
	});
}
