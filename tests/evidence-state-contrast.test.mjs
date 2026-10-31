import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");
const component = readFileSync(new URL("../src/components/EvidenceState.astro", import.meta.url), "utf8");

const lum = (hex) => {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const light = css.slice(css.indexOf(":root[data-theme='light']"));
const lightBg = light.match(/--gp-bg:\s*(#[0-9a-fA-F]{6})/)[1];
const lightSurface = light.match(/--gp-surface:\s*(#[0-9a-fA-F]{6})/)[1];

test("light-theme evidence badge colors meet WCAG AA on the page and card surfaces", () => {
  for (const state of ["verified", "conditional"]) {
    const rule = component.match(new RegExp(`data-theme='light'\\]\\) \\.gp-evidence-state--${state} \\{ color: (#[0-9a-fA-F]{6})`));
    assert.ok(rule, `${state} needs a light-theme color`);
    for (const surface of [lightBg, lightSurface]) assert.ok(ratio(rule[1], surface) >= 4.5, `${state} ${rule[1]} on ${surface}`);
  }
});

test("the dark-theme badge colors the light override replaces would fail on the light surface", () => {
  assert.ok(ratio("#62b982", lightSurface) < 3);
  assert.ok(ratio("#e6a34a", lightSurface) < 3);
});

test("badge text is at least 11px", () => {
  assert.match(component, /font: 11px\/1\.5 var\(--gp-mono\)/);
});
