import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(path.join(root, p), "utf8");

const REM = 16;
const layout = read("src/layouts/LocalityGuideLayout.astro");
// The sticky navbar is about 73px on desktop and measured up to 116px when it wraps on narrow phones.
const TALLEST_MEASURED_NAV_PX = 116;

function scrollMarginPx(source, selectorFragment) {
	const re = new RegExp(`([^{}]*${selectorFragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^{}]*)\\{[^}]*scroll-margin-top:\\s*([\\d.]+)(rem|px)`, "m");
	const m = source.match(re);
	assert.ok(m, `no scroll-margin-top rule found for ${selectorFragment}`);
	return Number(m[2]) * (m[3] === "rem" ? REM : 1);
}

test("every table-of-contents anchor target clears the sticky navbar", () => {
	const toc = [...layout.matchAll(/\{ id: "([a-z-]+)", label:/g)].map((m) => m[1]);
	assert.ok(toc.length >= 10, `expected the layout's ToC ids, got ${toc.join(",")}`);
	// The ToC targets are all <section id=...> elements inside <main>, except the CTA which can also be a <div>.
	const pathwayComponent = read("src/components/PermitPathwayAnswer.astro");
	const installerCta = read("src/components/InstallerCTA.astro");
	for (const id of toc) {
		if (id === "permit-pathway") {
			assert.ok(new RegExp(`<(section|div) id="${id}"`).test(pathwayComponent), `ToC id ${id} has no matching element`);
		} else if (id === "installer-cta") {
			assert.match(layout, /anchorId="installer-cta"/);
			assert.match(installerCta, /id=\{anchorId\}/);
		} else {
			assert.ok(new RegExp(`<(section|div) id="${id}"`).test(layout), `ToC id ${id} has no matching element`);
		}
	}
	assert.ok(scrollMarginPx(layout, "main section[id]") >= TALLEST_MEASURED_NAV_PX + 8);
	assert.ok(scrollMarginPx(layout, "#installer-cta") >= TALLEST_MEASURED_NAV_PX + 8);
});

test("the permit-pathway block keeps the same offset, and no JavaScript scroll handler is used for anchors", () => {
	const comp = read("src/components/PermitPathwayAnswer.astro");
	assert.ok(scrollMarginPx(comp, "#permit-pathway") >= TALLEST_MEASURED_NAV_PX + 8);
	assert.doesNotMatch(layout, /scrollIntoView|scrollTo\(|scrollBy\(/);
});
