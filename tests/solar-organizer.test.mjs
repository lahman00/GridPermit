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
