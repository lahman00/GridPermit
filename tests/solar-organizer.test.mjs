import assert from "node:assert/strict";
import test from "node:test";
import { SOLAR_ORGANIZER, validatedOrganizerCheckout } from "../src/lib/solar-organizer.ts";

test("organizer price is the owner-approved one-time USD 9", () => {
  assert.equal(SOLAR_ORGANIZER.priceCents, 900);
  assert.equal(SOLAR_ORGANIZER.currency, "USD");
});

test("missing or malformed payment destinations stay disabled", () => {
  for (const value of [null, "", "not a URL", "https://whop.com/checkout/plan_other/", "https://whop.com/mygridpermit/solar-project-organizer/", "http://whop.com/checkout/plan_40O1gcALdY9Hz/", "https://whop.com.evil.example/checkout/plan_40O1gcALdY9Hz/", "https://other.example/checkout/plan_40O1gcALdY9Hz/", "https://whop.com/auth/login", "https://user:pass@whop.com/checkout/plan_40O1gcALdY9Hz/", "https://whop.com:444/checkout/plan_40O1gcALdY9Hz/", "https://whop.com/checkout/plan_40O1gcALdY9Hz/?coupon=FREE", "https://whop.com/checkout/plan_40O1gcALdY9Hz/#other"]) {
    assert.equal(validatedOrganizerCheckout(value), null, String(value));
  }
});

test("the verified GridPermit Whop checkout URL can be used without scripts or payment data on GridPermit", () => {
  assert.equal(validatedOrganizerCheckout("https://whop.com/checkout/plan_40O1gcALdY9Hz/"), "https://whop.com/checkout/plan_40O1gcALdY9Hz/");
});

import { readFileSync } from "node:fs";

test("the buy link is measured by a closed-list event and the purchase is disclosed in the terms and privacy pages", () => {
  const page = readFileSync(new URL("../src/pages/solar-project-organizer.astro", import.meta.url), "utf8");
  assert.match(page, /href=\{organizerCheckout\}[^>]*data-track-click="organizer_checkout_clicked"/);
  assert.match(page, /href="\/terms\/"/);
  const terms = readFileSync(new URL("../src/pages/terms.astro", import.meta.url), "utf8");
  assert.match(terms, /Digital Downloads:[\s\S]*Whop[\s\S]*does not receive your card details/);
  const privacy = readFileSync(new URL("../src/pages/privacy.astro", import.meta.url), "utf8");
  assert.match(privacy, /<h2>Purchases<\/h2>[\s\S]*Whop[\s\S]*without any purchase, name, email or payment details/);
});

test("the product page explains audience, contents, purchase flow and limits without unverified claims", () => {
  const page = readFileSync(new URL("../src/pages/solar-project-organizer.astro", import.meta.url), "utf8");
  for (const id of ["fit-title", "included-title", "how-title", "scope-title"]) assert.match(page, new RegExp(`<h2 id="${id}">`), id);
  for (const item of ["Project overview", "Quote comparison", "Permit office check", "Permit and inspection tracker", "Utility approval tracker", "Final handoff checklist", "Project action log", "Source check log"]) assert.ok(page.includes(item), item);
  assert.match(page, /\$9 USD, one time/);
  assert.match(page, /sign in to Whop and open Files/);
  assert.match(page, /does not include current permit rules/);
  assert.match(page, /const price = SOLAR_ORGANIZER\.priceCents \/ 100;/);
  assert.match(page, /href=\{organizerCheckout\}[^>]*data-track-click="organizer_checkout_clicked"/);
  assert.doesNotMatch(page, /refund|guarantee|testimonial|\breviews?\b|\brated\b|\bsave[sd]? you\b|hours? (a|per) (week|month)/i);
  assert.doesNotMatch(page, /—/);
});
