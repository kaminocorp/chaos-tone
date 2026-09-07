## 0.1.5 — Virtual DJ weekend v0 (2026-09-07)

Agent-driven live stem deck scaffold. Weekend subset from docs/vision-virtual-dj.md:
in-memory session + revision CAS + client_op_id idempotency, HTTP JSON tools,
Tone.js placeholder deck behind a Start gesture. No Ableton, MCP, auth, or persistence.

### What landed

- Session store src/lib/dj/session.ts (roles kick|bass|hats|perc|chords|vox|fx)
- HTTP under /api/dj/* (session_get, session_start, set_energy, swap_role, mute_role, transition)
- Placeholder deck + VirtualDjPanel Start gesture; empty library/ for future WAVs
- adapter-vercel with nodejs22.x; smoke doc docs/executing/virtual-dj-v0-smoke.md

### Verified

check 0 errors; test 21 passed; build with Vercel adapter.

