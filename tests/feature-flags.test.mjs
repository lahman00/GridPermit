import { test } from "node:test";
import assert from "node:assert/strict";
import { FEATURE_FLAGS, isFeatureEnabled } from "../src/lib/feature-flags.ts";

test("every monetization feature flag defaults to disabled", () => {
	for (const [name, value] of Object.entries(FEATURE_FLAGS)) {
		assert.equal(value, false, `${name} must default to false`);
	}
});

test("isFeatureEnabled reflects the flag map", () => {
	for (const name of Object.keys(FEATURE_FLAGS)) {
		assert.equal(isFeatureEnabled(name), false);
	}
});
