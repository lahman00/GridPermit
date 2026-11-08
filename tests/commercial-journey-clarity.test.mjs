// Guards for the 2026-11 journey clarity pass: the free checker is reachable from
// every page, the stage navigator links match their labels, the organizer page
// states its checkout handoff and product data truthfully, and buyers who need
// help land on a contact section written for them.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";
import { SOLAR_ORGANIZER } from "../src/lib/solar-organizer.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const organizer = read("src/pages/solar-project-organizer.astro");
const contact = read("src/pages/contact.astro");
const header = read("src/components/Header.astro");
const footer = read("src/components/Footer.astro");
const navigator = read("src/components/ProjectNavigator.astro");
const css = read("src/styles/global.css");

test("the free Permit Path checker is in the shared header and footer", () => {
  assert.match(header, /\{ href: '\/permit-path\/', label: 'Permit checker' \}/);
  assert.match(footer, /<a href="\/permit-path\/">Permit path checker<\/a>/);
});

test("homepage stage links go where their labels say", () => {
  const panel = (stage) => navigator.match(new RegExp(`data-stage-panel="${stage}"[\\s\\S]*?</div>\\s*</div>`))?.[0] ?? "";
  assert.match(panel("docs"), /href="\/permit-path\/">Open the permit path checker/);
  assert.match(panel("pto"), /href="\/blog\/city-permit-vs-utility-pto\/">Understand permit vs\. PTO/);
  assert.ok(existsSync(new URL("../src/content/blog/city-permit-vs-utility-pto.md", import.meta.url)), "the PTO guide exists");
});

test("organizer Product data uses the single price constant and only exists while checkout is valid", () => {
  assert.match(organizer, /const productSchema = organizerCheckout \? \{/);
  assert.match(organizer, /"@type": "Product"/);
  assert.match(organizer, /price: price\.toFixed\(2\)/);
  assert.match(organizer, /priceCurrency: SOLAR_ORGANIZER\.currency/);
  assert.match(organizer, /availability: "https:\/\/schema\.org\/InStock"/);
  assert.match(organizer, /\{productSchema && <script is:inline type="application\/ld\+json"/);
  assert.doesNotMatch(organizer, /aggregateRating|ratingValue|"review"/i);
  assert.equal((SOLAR_ORGANIZER.priceCents / 100).toFixed(2), "9.00");
});

test("the buy link says where checkout happens before the visitor leaves the site", () => {
  assert.match(organizer, /href=\{organizerCheckout\}[^>]*aria-describedby="checkout-note"/);
  assert.match(organizer, /<p class="checkout-note" id="checkout-note">Checkout opens on Whop, which handles payment and tax\./);
  assert.match(organizer, /<li>Any applicable tax is shown at checkout\. See the <a href="\/terms\/">digital download terms<\/a>\.<\/li>/);
});

test("the preview ships a lossless WebP with the PNG fallback and its real intrinsic size", () => {
  const png = readFileSync(new URL("../public/products/solar-project-organizer-preview.png", import.meta.url));
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  assert.match(organizer, /<source srcset="\/products\/solar-project-organizer-preview\.webp" type="image\/webp" \/>/);
  assert.match(organizer, new RegExp(`src="/products/solar-project-organizer-preview\\.png"[^>]*width="${width}" height="${height}"`));
  const webp = readFileSync(new URL("../public/products/solar-project-organizer-preview.webp", import.meta.url));
  assert.equal(webp.toString("ascii", 0, 4), "RIFF");
  assert.equal(webp.toString("ascii", 8, 12), "WEBP");
  assert.ok(webp.length < png.length, "WebP is smaller than the PNG");
});

test("buyers asking for help reach a contact section written for organizer orders", () => {
  assert.match(organizer, /through <a href="\/contact\/#organizer-orders">GridPermit support<\/a>, using your checkout email address/);
  assert.match(organizer, /<section class="details" id="how-it-works" aria-labelledby="how-title">/);
  assert.match(contact, /<section class="contact-orders" id="organizer-orders"/);
  assert.match(contact, /href="mailto:support@mygridpermit\.com\?subject=Solar%20Project%20Organizer%20order"/);
  assert.match(contact, /from the email address you used at checkout/);
  assert.match(contact, /href="\/solar-project-organizer\/#how-it-works"/);
  assert.match(contact, /refund terms are in our <a href="\/terms\/">Terms of Service<\/a>/);
  assert.doesNotMatch(contact, /style="color: var\(--gp-accent\);"/, "no inline link colors");
});

test("shared tokens: an 8px spacing scale, themed status colors and guarded motion primitives", () => {
  for (const [name, value] of [["--gp-space-1", "8px"], ["--gp-space-2", "16px"], ["--gp-space-3", "24px"], ["--gp-space-4", "32px"], ["--gp-space-8", "64px"]]) {
    assert.match(css, new RegExp(`${name}: ${value};`), name);
  }
  assert.match(css, /:root\[data-theme='light'\] \{ --gp-ok: #1b6b3a; --gp-warn: #8a5300; --gp-danger: #9f1d14; \}/);
  for (const selector of [".t-panel-slide { transition: none !important; }", ".t-input { animation: none !important; transform: none !important; }"]) {
    assert.ok(css.includes(selector), selector);
  }
  assert.match(css, /\.gp-field-error:empty \{ display: none; \}/);
});
