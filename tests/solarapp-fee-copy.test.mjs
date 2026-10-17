import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("California SolarAPP+ guidance distinguishes free jurisdiction access from applicant fees", () => {
  const source = readFileSync(path.join(root, "src/pages/california/index.astro"), "utf8");
  assert.equal((source.match(/at no cost to participating local governments/g) || []).length, 2);
  assert.equal((source.match(/installers pay a SolarAPP\+ administrative fee/g) || []).length, 2);
  assert.match(source, /local permit fees/);
  assert.match(source, /help\.solar-app\.org\/article\/75-how-much-does-solarapp-cost-an-installer-to-use/);
  assert.doesNotMatch(source, /SolarAPP\+ \(Solar Automated Permit Processing\) is a free/);
  assert.doesNotMatch(source, /is a free online platform, developed with the National Renewable Energy Laboratory/);
  // This FAQ answer is rendered in visible HTML and serialized into FAQPage JSON-LD.
  // Reject accidental duplication of the city/project eligibility disclaimer.
  assert.equal((source.match(/Not every city uses it, and not every project qualifies even where it's offered/g) || []).length, 1);
});
