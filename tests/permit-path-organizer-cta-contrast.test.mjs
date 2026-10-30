import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/pages/permit-path.astro", import.meta.url), "utf8");

function luminance(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const token = (block, name) => block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,6})`))[1];

test("the Permit Path organizer link text meets WCAG AA contrast on the accent button in both themes", () => {
  assert.match(page, /\.cta a \{[^}]*color: var\(--gp-accent-ink\)/, "the link must use the accent-ink token, not the page ink");
  const light = css.slice(css.indexOf(":root[data-theme='light']"));
  const dark = css.slice(0, css.indexOf(":root[data-theme='light']"));
  for (const [name, block] of [["light", light], ["dark", dark]]) {
    assert.ok(ratio(token(block, "--gp-accent-ink"), token(block, "--gp-accent")) >= 4.5, `${name} theme accent-ink on accent`);
  }
});

test("the old page-ink pairing would have failed, so the token choice is what the test guards", () => {
  const light = css.slice(css.indexOf(":root[data-theme='light']"));
  assert.ok(ratio(token(light, "--gp-ink"), token(light, "--gp-accent")) < 3);
});
