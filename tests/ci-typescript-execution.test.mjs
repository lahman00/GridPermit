// Regression guard for the CI failure where `npm test` passed locally (modern
// Node with TypeScript type-stripping enabled by default) but failed on
// GitHub Actions' pinned Node 22.12.0 with:
//   TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts"
// because 10 of this repo's tests import .ts modules directly
// (src/lib/*.ts) and older Node versions require an explicit flag to strip
// TypeScript types rather than doing it implicitly by default.
//
// The fix was adding --experimental-strip-types to the "test" script in
// package.json so TS-module loading is explicit and version-independent
// rather than relying on whichever Node version happens to be running.
// This test fails loudly if that flag is ever removed, or if the CI
// workflow's pinned Node version drops below the version that introduced
// the flag (22.6.0) without the flag being replaced by an equivalent
// mechanism — either regression would silently reintroduce the exact
// failure that caused ~20-30 GitHub Actions failure-notification emails.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function readPackageJson() {
	return JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
}

function readCiWorkflow() {
	return readFileSync(path.join(REPO_ROOT, ".github/workflows/ci.yml"), "utf8");
}

test("at least one test file imports a .ts module directly (the scenario this guard protects)", () => {
	const testsDir = path.join(REPO_ROOT, "tests");
	const files = readFileSync(path.join(testsDir, "analytics-events.test.mjs"), "utf8");
	assert.match(
		files,
		/from ["']\.\.\/src\/lib\/analytics-events\.ts["']/,
		"expected tests/analytics-events.test.mjs to import src/lib/analytics-events.ts directly — if this import was removed, this guard test should be re-evaluated rather than silently made meaningless",
	);
});

test("package.json's test script explicitly enables TypeScript module execution", () => {
	const pkg = readPackageJson();
	const testScript = pkg.scripts?.test ?? "";
	assert.ok(
		/--experimental-strip-types|--experimental-transform-types|--loader[= ]|--import[= ].*tsx|ts-node/.test(testScript),
		`package.json "test" script ("${testScript}") no longer contains a mechanism to execute .ts files. ` +
			`Without one, "node --test tests/*.test.mjs" throws ERR_UNKNOWN_FILE_EXTENSION for ".ts" on any Node ` +
			`version that doesn't strip TypeScript types by default (e.g. the Node 22.12.0 pinned in .github/workflows/ci.yml).`,
	);
});

test("the test script's TypeScript-execution flag actually works at runtime (not just present as a string)", () => {
	const pkg = readPackageJson();
	const testScript = pkg.scripts.test;
	// Extract every flag before the first non-flag token ("--test"), so this
	// verifies the exact flags npm actually passes to node.
	const tokens = testScript.split(/\s+/);
	const nodeFlags = tokens.slice(1, tokens.indexOf("--test"));

	const probeScript = `
		import("node:assert/strict").then(async ({ default: assert }) => {
			const mod = await import(${JSON.stringify(
				path.join(REPO_ROOT, "src/lib/analytics-events.ts"),
			)});
			assert.ok(Array.isArray(mod.ANALYTICS_EVENTS) && mod.ANALYTICS_EVENTS.length > 0);
			process.stdout.write("OK");
		});
	`;

	const result = execFileSync(process.execPath, [...nodeFlags, "--input-type=module", "-e", probeScript], {
		encoding: "utf8",
		cwd: REPO_ROOT,
	});

	assert.equal(
		result.trim(),
		"OK",
		"the flags currently in package.json's test script failed to import a real .ts module at runtime",
	);
});

test("CI workflow pins a Node version that supports --experimental-strip-types (>= 22.6.0)", () => {
	const workflow = readCiWorkflow();
	const match = workflow.match(/node-version:\s*["']?(\d+)\.(\d+)\.(\d+)["']?/);
	assert.ok(match, "expected .github/workflows/ci.yml to pin an explicit node-version");

	const [, major, minor] = match.map(Number);
	const meetsMinimum = major > 22 || (major === 22 && minor >= 6);
	assert.ok(
		meetsMinimum,
		`.github/workflows/ci.yml pins Node ${match[1]}.${match[2]}.${match[3]}, which predates Node 22.6.0 ` +
			`(the version that introduced --experimental-strip-types). Either bump the pinned Node version or ` +
			`swap in a different TypeScript-execution mechanism in package.json's test script.`,
	);
});
