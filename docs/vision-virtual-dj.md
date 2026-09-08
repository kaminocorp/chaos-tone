# Virtual DJ — Product Vision

*Agent-driven live stem deck on Chaos Tone. Brief from Jean-Michel (2026-09-07); Phil greenlit implementation.*

This document is the product north star for **Virtual DJ**. It sits alongside [`vision.md`](./vision.md) (Chaos Tone as trainable sketchbook). Virtual DJ does **not** replace that vision — it is a sibling product surface that reuses the Tone.js / SvelteKit workbench as a realtime audio host for agents.

---

## One-liner

Any agent (Claude, Grok, Jean-Michel, Hermes, …) is the **brain**. A local tool bridge is the **hands**. Tone.js in chaos-tone is the **deck**. Speakers are the **room**.

High-level DJ verbs. Deep house first. Not full-track regeneration. Not a DAW.

---

## Why this exists

Studio sessions stall when the creative partner can’t *touch* the music in realtime. Virtual DJ closes that loop:

1. Human or agent says intent (“take it darker”, “drop in 8”, “swap the hats”).
2. Tools land on the bar grid.
3. Something audible changes within 1–2 bars on the studio Mac Mini (CoreAudio system default).

The exceptional bar comes later from **curated stems**. v0 proves the **agent loop**, not Ableton mix-bus parity.

---

## Relationship to Chaos Tone

| Layer | Role |
| --- | --- |
| **chaos-tone repo** | Expand in place. Do **not** greenfield a separate `dj-bridge` app. |
| **Existing sketchbook** | Journal / synth / randomness remain the longer Chaos Tone arc (`vision.md`). |
| **Virtual DJ** | Agent-callable session + stem/role deck + HTTP (then MCP) tools. |
| **Workbench UI** | Stay thin. Agent-callable loop outranks pretty UI for v0. |
| **Ableton Live** | Later **sibling** path under the **same** high-level DJ verbs — not weekend v0. Live on Mini not confirmed. |

**Engine lock (v0):** Tone.js inside SvelteKit. `Tone.start()` only after user gesture. Stores are the contract (`createParamStore`). Dark instrument aesthetic.

**Stateless:** no Supabase / auth / persistence unless Phil or Jean-Michel explicitly reopen that.

---

## Architecture (locked shape)

```
Agent(s) ──HTTP tools──► chaos-tone (session + roles + Tone.js) ──► CoreAudio default out
              │
              └── week 2+: same verbs via MCP
```

- **Host:** Studio Mac Mini.
- **Concurrency:** multi-agent OK. **No exclusive lock.** Optimistic concurrency via **revision CAS** (`if_revision` → 409).
- **Idempotency:** `client_op_id` on mutating ops.
- **Timing:** bar-quantized changes (apply on next bar / N bars), not sample-accurate DAW scheduling in v0.
- **Library:** start empty or with Tone.js procedural / placeholder one-shots. Real construction-kit WAVs drop into `library/` later behind the **same** `swap_role` / `library_search` API — do not block scaffold on buying stems.

---

## Roles (v1)

| Role | Intent |
| --- | --- |
| `kick` | Low-end pulse |
| `bass` | Sub / bassline |
| `hats` | Hi-hat / top pattern |
| `perc` | Percussion fills |
| `chords` | Harmonic bed |
| `vox` | Vocal / topline stub |
| `fx` | Transitions, noise, sweeps |

Stems (when real) are tagged: `bpm`, `key`, `energy`, `mood`, `length_bars`.

---

## Tool surface (v1 intent)

Session lifecycle:

- `session_start` / `session_get` / `session_stop` / `session_pause`

Global musical state:

- `set_bpm` / `set_key` / `set_energy` / `set_phase`

Role ops:

- `swap_role` / `mute_role` / `solo_role` / `set_role_gain` / `set_role_filter`

Arrangement verbs:

- `transition(bars)` / `drop` / `break`

Library:

- `library_search`

Safety:

- `emergency_stop`

Weekend v0 may ship a **subset** first (see below) as long as the agent loop is real.

---

## Weekend v0 — ship this first

Success is **one audible agent loop**, not feature completeness.

1. **Session state** — `bpm`, `key`, `energy`, `bar`, `phase`, roles, `revision` (in-memory stores).
2. **HTTP tools** — at minimum: `session_get`, `session_start`, `set_energy`, `swap_role`, `mute_role`, `transition(bars)` — bar-quantized, with `client_op_id` + `if_revision`.
3. **Placeholder sound** — Tone.js per-role placeholders; `library/` ready for WAVs.
4. **Smoke test** — agent says “take it darker” → energy (and/or filter) changes within **1–2 bars**, heard on Mini speakers.

Implementation path: Claude Code CLI on the Mini (Ghostty when visibility matters). `feat/*` branches + PRs. Never force-push `main`.

---

## Explicitly out of v0

- Purchased stem libraries as a blocker
- Ableton / Link / MIDI clock as the live engine
- Suno (or any full-track gen) as the live path
- MCP (week 2 wrap of the same verbs)
- Pretty workbench polish / Threlte dependency
- Backend, auth, persistence
- Exclusive session locking

---

## Sound honesty

v0 placeholders are allowed to sound cheap. They must **respond** to verbs. Curated stems later raise the floor; the API shape must not change when WAVs arrive.

Genre focus for first library and placeholder character: **deep house**.

---

## Definition of done (v0)

- [x] Dev session runs on Mac Mini with system default audio out (weekend v0 scaffold)
- [x] HTTP agent can start a session and read revision/state
- [x] "Take it darker" produces an audible change within 1-2 bars (Slice A: rhythmic placeholders + tightened energy/transition)
- [x] Concurrent agents conflict via 409 on stale revision, not silent overwrite
- [x] PR open for Phil review; vision + scaffold documented

Slice A (musical credibility) checked above. Slice B (extra verbs) and later bridge work remain open.

---

## Reporting lines

- **Product / UX / scope:** Jean-Michel
- **Eng uncertainty / architecture / stop-go:** Woz
- **Implementer:** ChaosTone Engineer (Deck) via Claude Code on Mini

When Jean-Michel says proceed on product, act. When Woz says stop, stop immediately.

---

## Evolution

This file should track product lock changes. Implementation detail and phase completions stay in `docs/executing/`, `docs/completions/`, and `docs/changelog.md` per existing Chaos Tone patterns.
