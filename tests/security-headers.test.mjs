// Regression guard for the baseline security headers declared in
// netlify.toml's global [[headers]] block. Content-Security-Policy is
// deliberately not asserted here — the site loads several inline scripts
// and external origins (Google Fonts, GA4) that would need careful
// allowlisting/testing before a CSP could be added safely.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const netlifyToml = readFileSync(path.join(REPO_ROOT, "netlify.toml"), "utf8");

test("netlify.toml sets baseline security headers on every route", () => {
	assert.match(netlifyToml, /X-Content-Type-Options\s*=\s*"nosniff"/);
	assert.match(netlifyToml, /X-Frame-Options\s*=\s*"DENY"/);
	assert.match(netlifyToml, /Referrer-Policy\s*=\s*"strict-origin-when-cross-origin"/);
	assert.match(netlifyToml, /Permissions-Policy\s*=\s*"[^"]*camera=\(\)/);
});
