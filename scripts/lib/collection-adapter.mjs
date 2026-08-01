// Collection Adapter Interface
// ============================
//
// scripts/collect-pilot.mjs never fetches data itself — it delegates to
// whatever module is exported here. This file defines the interface contract
// and provides today's implementation: a placeholder that reads a
// pre-supplied, already schema-conformant record from
// data/source-payloads/<record_id>.json.
//
// A future implementation (a live run of agents/data-collector.md by an
// automated agent, or a call to an external data API) can replace the body
// of `collect()` below without collect-pilot.mjs changing at all, as long as
// the same contract is honored:
//
//   collect(target) -> Promise<{ payload: object } | { payload: null, reason: string }>
//
//   target: one entry from data/pilot-targets.json — { record_id, city,
//           county, utility, state, ... }.
//
//   payload: when non-null, MUST be a complete record matching
//            data/schema.json exactly — i.e. everything
//            agents/data-collector.md would have produced, including a
//            record_id equal to target.record_id. collect-pilot.mjs does not
//            assemble or transform partial facts into the schema's
//            value/confidence/source_ids envelope; that assembly is this
//            adapter's (or whatever produced the payload file's)
//            responsibility.
//
//   reason: when payload is null, a short human-readable explanation (e.g.
//           "no source payload file found"). collect-pilot.mjs surfaces this
//           as the target's COLLECTION_REQUIRED message.

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolved independently of process.cwd() so this works the same whether
// collect-pilot.mjs is invoked from the repo root or anywhere else.
// target.source_payload_file may also be an absolute path (used by tests),
// in which case path.resolve() returns it unchanged.
const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");

/**
 * @param {{record_id: string, source_payload_file: string}} target
 * @returns {Promise<{payload: object} | {payload: null, reason: string}>}
 */
export async function collect(target) {
  const payloadPath = path.resolve(REPO_ROOT, target.source_payload_file);

  if (!existsSync(payloadPath)) {
    return {
      payload: null,
      reason: `no source payload file found at ${payloadPath} — supply one (see docs/PILOT_RUNBOOK.md) or wait for a future automated adapter`,
    };
  }

  let payload;
  try {
    payload = JSON.parse(await readFile(payloadPath, "utf8"));
  } catch (err) {
    return { payload: null, reason: `source payload at ${payloadPath} is not valid JSON: ${err.message}` };
  }

  return { payload };
}
