# GridPermit Operations Coordinator

The coordinator is the single entry point for the five bounded operational roles. It loads `data/operations/state.json`, validates `data/operations/registry.json`, runs each role once, and writes one immutable evidence directory.

It never starts recursive agent loops, sends external messages, spends money, activates partners, or changes production. Missing evidence stays `UNKNOWN` or `BLOCKED`.

Run it with:

```bash
npm run operations -- --out output/operations/<timestamp>
```
