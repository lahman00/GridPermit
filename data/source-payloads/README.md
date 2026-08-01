# Source payloads

Empty by design — no payload files are committed here yet. See [docs/PILOT_RUNBOOK.md](../../docs/PILOT_RUNBOOK.md) for how to prepare one.

**Naming:** `<record_id>.json`, matching the corresponding entry's `record_id` in [data/pilot-targets.json](../pilot-targets.json) and the eventual filename under `data/localities/`. Example: `ca-santa-clara-san-jose-pge.json`.

**Shape:** a payload file must be a **complete record matching [data/schema.json](../schema.json) exactly** — everything [agents/data-collector.md](../../agents/data-collector.md) would produce, including a `record_id` equal to the target's. `scripts/collect-pilot.mjs` does not assemble or transform partial facts into the schema's `value`/`confidence`/`source_ids` envelope; it only orchestrates (checks for an existing record, copies the payload into `data/localities/`, chains validation). That assembly is the payload producer's job — a human running the Data Collector process, or in the future an automated agent.
