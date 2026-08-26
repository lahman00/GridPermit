import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

test("California locality SGIP data uses the conservative 2026 summary and current official sources", () => {
  const result = spawnSync(
    process.execPath,
    [path.join(REPO_ROOT, "scripts", "refresh-sgip-2026.mjs"), "--check"],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );

  assert.equal(
    result.status,
    0,
    ["SGIP data freshness check failed.", result.stdout, result.stderr].filter(Boolean).join("\n"),
  );
  assert.match(result.stdout, /SGIP freshness check passed for \d+ California locality record\(s\)\./);
});
