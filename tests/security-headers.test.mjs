// Regression guard for the global response headers. The CSP controls only
// embedding; it must not restrict the site's existing scripts, fonts or GA4.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const netlifyToml = readFileSync(path.join(REPO_ROOT, "netlify.toml"), "utf8");
const globalHeaderBlocks = netlifyToml
	.split(/^\[\[headers\]\]\s*$/m)
	.slice(1)
	.map((block) => block.split(/^\[\[/m)[0])
	.filter((block) => /^\s*for\s*=\s*"\/\*"\s*$/m.test(block));

test("netlify.toml sets baseline security headers on every route", () => {
	assert.equal(globalHeaderBlocks.length, 1, "Keep one global response-header block");
	const headers = globalHeaderBlocks[0];
	assert.match(headers, /X-Content-Type-Options\s*=\s*"nosniff"/);
	assert.match(headers, /X-Frame-Options\s*=\s*"DENY"/);
	assert.match(headers, /Referrer-Policy\s*=\s*"strict-origin-when-cross-origin"/);
	assert.match(headers, /Permissions-Policy\s*=\s*"camera=\(\), microphone=\(\), geolocation=\(\), payment=\(\)"/);
});

test("global framing policy allows only self and the exact studio origin", () => {
	assert.equal(globalHeaderBlocks.length, 1);
	const policies = [...globalHeaderBlocks[0].matchAll(/^\s*Content-Security-Policy\s*=\s*"([^"]*)"\s*$/gm)];
	assert.equal(policies.length, 1, "Publish one enforced CSP response header");
	assert.equal(
		policies[0][1],
		"frame-ancestors 'self' https://eyal-haimovich-studio.lahman.chatgpt.site",
		"Do not widen framing to wildcard, preview, HTTP or other origins, or add unrelated fetch restrictions",
	);
});
