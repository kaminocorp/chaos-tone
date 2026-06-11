# Phase 6 — Audio Proof-of-Life — Completion

**Shipped**: 2026-06-11
**Plan**: [`docs/executing/phase-6-implementation.md`](../executing/phase-6-implementation.md)
**Phase**: 6 of the [scaffolding plan](../executing/scaffolding-plan.md) — first phase on the **stateless v1** critical path (1 → 2 → 3 → **6** → 7).
**Version**: `0.1.3`

---

## TL;DR

Click a button, hear a 200 ms sine. The full **Tone.js → Web Audio** pipeline is now confirmed alive inside SvelteKit + Svelte 5 runes: started correctly behind a user gesture, SSR-safe, and **code-split out of the initial bundle** (Tone loads as a separate 340 kB chunk only on the first click). This is a proof of life, not a synth — it de-risks the three gotchas (user-gesture requirement, SSR-hostile browser globals, bundle bloat) that would otherwise block every later audio feature. Phase 7 (`createParamStore`) plugs straight into the shared synth instance left reachable here.

---

## File inventory

### New files

| File | What it is |
|---|---|
| `src/lib/audio/context.ts` | The single owner of audio lifecycle. `isAudioSupported()` (synchronous, SSR-safe feature check) and `ensureAudioStarted()` (lazy dynamic `import('tone')` + `Tone.start()`, both idempotent). Header comment documents the user-gesture rule, the no-top-level-import rule, and the `lookAhead` / `latencyHint` latency tunables (Phase 10 will lift this into `ARCHITECTURE.md`). |
| `src/lib/audio/test-tone.ts` | The throwaway proof-of-life tone. `playTestTone()` lazily creates one module-scoped `Tone.Synth` (sine oscillator) and fires `triggerAttackRelease(440, 0.2)`. Explicitly labelled as the file Phase 7 will reach into to make the frequency reactive. |
| `src/lib/audio/context.test.ts` | Vitest unit test mocking the dynamically-imported `tone` module, proving the start-once guard (`Tone.start()` called exactly once across multiple `ensureAudioStarted()` calls). |

### Modified files

| File | Change |
|---|---|
| `src/lib/components/workbench/TransportBar.svelte` | Added the temporary **"Test tone (will be removed)"** secondary button to the centre cluster (next to the BPM readout), an `async handleTestTone()` handler with feature-detect + try/catch, and an inline `role="alert"` error span bound to `audioError` (`$state`). The existing Rec/Play/Stop/Keep/Mutate/Discard buttons are untouched and stay `disabled`. |
| `package.json` / `pnpm-lock.yaml` | `tone@15.1.22` added under `dependencies` (runtime code, not tooling). No `pnpm.onlyBuiltDependencies` change — Tone is pure JS, no postinstall/native binary. |

---

## How it works (the data path)

1. User clicks **Test tone** → `handleTestTone()` runs *synchronously inside the gesture*, giving the page sticky activation.
2. `isAudioSupported()` gates first — on an unsupported browser it sets `audioError` and returns before touching Tone.
3. `playTestTone()` → `ensureAudioStarted()` does `await import('tone')` (first call only; cached in a module singleton), then `await tone.start()` (first call only; guarded by a `started` boolean). Sticky activation survives the `await`, so the resume still counts as user-initiated.
4. A single `Tone.Synth` is lazily created and reused across clicks; `triggerAttackRelease(440, 0.2)` plays the sine. The Synth's built-in amplitude envelope is what avoids the click/pop a bare `Oscillator` at full gain would produce.

---

## Notable decisions & why

- **Tone is loaded via dynamic `import('tone')` inside a function, never at module top level.** `TransportBar` statically imports our audio modules, so a top-level `import * as Tone from 'tone'` would (a) execute during SSR — where `window`/`AudioContext` don't exist — and (b) pull Tone's ~340 kB into the initial route bundle. The runtime import lives *only* inside `ensureAudioStarted()`. **Type-only** imports (`import type * as ToneModule from 'tone'`) are kept for full typing — they're erased at compile time, so they cost nothing at runtime or in the bundle. This is the same lazy discipline Threlte will use in Phase 8.
- **Verified the code-split, didn't just assume it.** The production build emits Tone as its own chunk (`B4_z7ZI7.js`, 340 kB / 81 kB gzip, content signature `const dr="15.1.22"`). The compiled Workbench chunk references it exactly once, as `import("./B4_z7ZI7.js")` — a dynamic import expression — and nowhere as a static import. SSR HTML for `/` contains no static `tone` script reference (the only "tone" substrings are "Chaos Tone" and the project path). So the DoD "not in the initial bundle" is confirmed structurally, not just by eyeballing sizes.
- **Lifecycle and the sound source are split across two files.** `context.ts` owns "is audio up?" and is meant to outlive the proof-of-life — Phase 7+ keep calling `ensureAudioStarted()`. `test-tone.ts` is explicitly throwaway and self-labels as such. Keeping them separate means deleting the test tone later doesn't disturb the lifecycle owner.
- **One reused `Synth`, not create-and-dispose per click.** Avoids node-graph churn and the GC pressure of allocating/tearing down a voice on every press. The instance is module-scoped specifically so Phase 7 can reach in and make its frequency reactive while a tone holds.
- **`tone` in `dependencies`, not `devDependencies`.** It's shipped runtime code. Vite bundles either way, so this is about honesty of intent, not mechanics.
- **Browser-support message is local `$state` in `TransportBar`, not a `Toast`.** `Toast` doesn't exist — it was tied to the now-deferred Phase 5 auth track. A small inline `role="alert"` span is honest and sufficient for a button that gets removed in Phase 7. Building `Toast` here would be speculative, against the Phase 3 "ship primitives with their first real consumer" precedent.
- **Latency left at Tone defaults, but documented.** The DoD only needs audible sound. Tuning `lookAhead` (default 0.1 s scheduling margin) and `latencyHint: 'interactive'` belongs with the first real playable voice (v0.2), but the knobs are recorded in the `context.ts` header so the next person doesn't have to rediscover them.
- **Feature-detect with `'AudioContext' in window`, not `(window as any)`.** Strict TS + no-`any` (it's grep-able and discouraged in this repo). The `type`-only Tone import already provides full typing with zero runtime cost, so there's no reason to reach for `any`.

---

## Verified by

Headless / automated — all clean:

```
pnpm check    # svelte-kit sync && svelte-check  →  4676 FILES 0 ERRORS 0 WARNINGS
pnpm test     # vitest run                       →  2 passed (smoke + context start-once)
pnpm build    # vite build                       →  ✓ built, no SSR crash; Tone in its own 340 kB chunk
pnpm dev      # vite dev                          →  GET / → 200, SSR renders the button, no static tone reference
```

`pnpm lint` is clean for every file Phase 6 touched (`src/lib/audio/**` and `TransportBar.svelte` all pass `prettier --check` and `eslint`). One **pre-existing, out-of-scope** warning remains: the working-tree copy of `CLAUDE.md` (a user edit that predates this phase, `M` at session start) has prettier drift. The committed `HEAD:CLAUDE.md` passes prettier, so this is the uncommitted edit, not Phase 6 — left untouched deliberately.

### Requires a human at a browser (not verifiable headlessly)

These DoD items need speakers and the three macOS engines, and are flagged for manual sign-off:

- [ ] Clicking **Test tone** produces audible sound; 5× rapid clicks retrigger cleanly with no pops.
- [ ] AudioContext is **not** started on page load — only on first gesture (run the Step 5 console snippet: `performance.getEntriesByType('resource').filter(r => r.name.includes('tone')).length` → `0` before any click, and no `tone` chunk in the Network tab until the first click).
- [ ] Works in latest **Chrome, Firefox, Safari** on macOS (Safari is the strictest about the gesture requirement — test it explicitly).

The structural guarantees behind these (gesture-gated start, dynamic chunk, idempotent `start()`) are all confirmed above; what's left is literally "do your ears hear it" across engines.

---

## Deliberately deferred (per plan)

| Item | Why deferred |
|---|---|
| Any real instrument / voice / preset / effect | Out of scope — this is proof of life. The first playable voice is v0.2. |
| Transport play/record behavior | Rec/Play/Stop stay `disabled`; transport scheduling is a later phase. |
| Reactive / store-bound frequency | **Phase 7** (`createParamStore`). The `440` is hardcoded here on purpose. |
| Latency tuning (`lookAhead`, `latencyHint`) | Belongs with the first real voice (v0.2). Knobs documented in the `context.ts` header. |
| `ARCHITECTURE.md` "Audio lifecycle" section | **Phase 10** owns developer docs. The rules live in the `context.ts` header comment for now (Phase 3 primitive precedent). |
| `Toast` for audio errors | Ships with a real consumer, not speculatively. Inline `role="alert"` span suffices for a throwaway button. |

---

## What this unblocks

**Phase 7 (`createParamStore`)** plugs directly into what landed here:

- `playTestTone()`'s hardcoded `440` becomes a value read from a frequency param store.
- A `Knob`/`Slider` in `InstrumentPanel` writes that store; a readout in `Stage` reads it; turning the knob **while the tone holds** changes pitch in real time (the module-scoped `synth` instance is reachable precisely so this works).
- At that point the **"Test tone (will be removed)"** button is removed — as its label promises — and replaced by the real bound control.

The audio modules are intentionally small and the synth instance intentionally reachable, so Phase 7 reaches in and makes the frequency reactive rather than rebuilding the pipeline.
