# Virtual DJ — next steps (confirmed roadmap)

HTTP session store remains the **source of truth**. MCP (and later FE) only mirrors the same verbs.

## Ordered roadmap

1. **MCP bridge** — Thin stdio MCP server that calls the running app’s HTTP API (`/api/dj/*`). Agents get the same verbs as curl without owning session state. See [`virtual-dj-mcp.md`](./virtual-dj-mcp.md).
2. **In-app conductor FE (now)** — Cockpit instrument on `/` matching the signed-off refs in [`docs/refs/virtual-dj-ui/`](../refs/virtual-dj-ui/README.md). Same `/api/dj/*` verbs; see [`virtual-dj-conductor.md`](./virtual-dj-conductor.md).
3. **Session UX polish** — Clearer revision/intent feedback, less residual “API demo” chrome on `/sketch/*`, tighter halt residual meters if a live analyzer lands.
4. **Sound floor** — Real WAVs under `library/` behind existing `library_search` / `swap_role` (no API redesign).
5. **Hardening** — CAS/idempotency edge cases, bar timing, error surfaces, multi-agent concurrency polish.

## Deferred (not next)

- Ableton Live sibling path
- Auth / Supabase / persistence
- Sketchbook rewrite (Chaos Tone journal/synth arc stays separate)

## Branch

Work on `feat/virtual-dj-conductor` off `main`. Morning smoke uses **`main`** once this lands (see [`virtual-dj-morning-playbook.md`](./virtual-dj-morning-playbook.md)).
