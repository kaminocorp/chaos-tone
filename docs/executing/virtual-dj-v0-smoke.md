# Virtual DJ weekend v0 — smoke

Local (Mac Mini) and Vercel checks for the agent loop. Placeholders may sound cheap; they must **respond**.

## Prerequisites

1. `cd` to chaos-tone, branch `feat/virtual-dj-v0-2-loop`
2. Install deps and start the dev server
3. Open the Vite URL and click **Start deck** once (user gesture → Tone.start)

## HTTP tools

| Verb | Method | Path |
| --- | --- | --- |
| session_get | GET | `/api/dj/session` |
| session_start | POST | `/api/dj/session/start` |
| set_energy | POST | `/api/dj/energy` body `{ energy, if_revision?, client_op_id?, bars? }` |
| swap_role | POST | `/api/dj/role/swap` body `{ role, stem_id, ... }` |
| mute_role | POST | `/api/dj/role/mute` body `{ role, mute, ... }` |
| transition | POST | `/api/dj/transition` body `{ bars, ... }` |

### Example: take it darker

1. GET `/api/dj/session` — note `revision`
2. POST `/api/dj/session/start` with `client_op_id`
3. POST `/api/dj/energy` with `energy: 0.15`, matching `if_revision`, unique `client_op_id`
4. Within ~1–2 bars the deck should darken (filter/energy)
5. Replay the same `client_op_id` → `replayed: true`, revision unchanged
6. POST with stale `if_revision: 0` → HTTP 409

## Vercel

- `@sveltejs/adapter-vercel` with `runtime: 'nodejs22.x'`
- Deploy the feature branch; open URL; Start deck; hit the same paths on that origin
- In-memory session is per serverless isolate (acceptable for v0)

## Pass criteria

- Audible placeholders after Start deck on Mini system default out
- session_get / session_start work
- Energy change heard within 1–2 bars
- Stale revision returns 409
- check / test / build clean

## Slice A (v0.2) listen test

After Start deck on Mini system default out:

1. POST /api/dj/session/start
2. POST /api/dj/energy with energy 0.15 (matching if_revision) — within 1-2 bars: darker, quieter, closed filter, hats/perc ducked.
3. POST /api/dj/energy with energy 0.85 — unmistakable open/bright lift.
4. POST /api/dj/transition with bars 8 — audible energy dip / break duck on bright roles.

CAS and idempotency checks from weekend v0 still apply. Further verbs wait for Slice B.
