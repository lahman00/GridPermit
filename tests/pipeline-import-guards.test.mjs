// Every executable script in scripts/ writes to disk (output/, data/localities/,
// or src/pages/) when run as a CLI. Two of them (collect-pilot.mjs,
// generate-locality-pages.mjs) already guard their main() call behind an
// isDirectRun check so importing them as a module never triggers those
// side effects. This session found the other four scripts
// (evaluate-pilot.mjs, evaluate-next-batch.mjs, validate-record.mjs,
// render-locality-summary.mjs) called main() unconditionally at module
// top-level — importing any of them anywhere (a test, a future script)
// would silently write real output files or exit the process. This test
// asserts every script in scripts/ has the guard, so a future script added
// without one fails loudly instead of shipping a latent side-effect trap.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const SCRIPTS_DIR = path.join(REPO_ROOT, "scripts");

const scriptFiles = readdirSync(SCRIPTS_DIR, { withFileTypes: true })
	.filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
	.map((entry) => entry.name);

test("scripts/ has at least the known pipeline scripts on disk", () => {
	assert.ok(scriptFiles.length >= 6, `expected at least 6 .mjs scripts, found ${scriptFiles.length}`);
});

test("every script that calls main() guards it behind a direct-execution check", () => {
	for (const file of scriptFiles) {
		const content = readFileSync(path.join(SCRIPTS_DIR, file), "utf8");
		if (!/\bmain\(\)/.test(content)) continue;

		assert.ok(
			/isDirectRun/.test(content),
			`${file} calls main() but has no isDirectRun guard — importing it as a module would trigger its side effects (writing output/data files, or process.exit)`,
		);
		assert.ok(
			/process\.argv\[1\]/.test(content) && /import\.meta\.url/.test(content),
			`${file} has an isDirectRun-like guard but doesn't check process.argv[1] against import.meta.url`,
		);
	}
});
