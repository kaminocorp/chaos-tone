# Phase 7 — State Foundation: `createParamStore` — Completion

**Shipped**: 2026-08-05
**Plan**: [`docs/executing/scaffolding-plan.md`](../executing/scaffolding-plan.md) §Phase 7
**Phase**: 7 of the scaffolding plan — the **final phase on the stateless v1 critical path** (1 → 2 → 3 → 6 → **7**).
**Version**: `0.1.4`

---

## TL;DR

The "stores are the contract" pattern is no longer a diagram — it runs. One param store (`frequencyStore`, 110–880 Hz) is now the single source of truth that a **Knob** in the Instrument panel writes, a live readout in the **Stage** reads, and the Tone.js voice's `frequency` signal follows via a declarative `bindTo()`. Hold the tone and turn the knob: the pitch glides in real time, with zero "sync UI to audio" code anywhere. The **audio-grade rotary Knob** promised since Phase 3 shipped with it (drag / wheel / full keyboard map / double-click reset), and the Phase 6 **"Test tone (will be removed)" button was removed** — as its label promised — replaced by the real bound control. This closes the v1 critical path: every later feature (real voices, Box of Randomness axes, sketch snapshots) is now "declare a store, drop a control, bind a param."

---

## File inventory

### New files

| File | What it is |
|---|---|
| `src/lib/stores/create-param-store.svelte.ts` | The `createParamStore` factory — one param = one store with `min` / `max` / `defaultValue`, a rune-backed clamped `value`, a curve-aware `normalized` 0..1 space (`'linear'` or `'log'`), `reset()`, `format()`, and `bindTo(toneParam, { ramp })` → unbind. The header comment is the **"How to add a new param" recipe** (4 steps, no step 5) that the DoD's "second param in under 15 minutes" contributor reads first. First real occupant of `src/lib/stores/` and first use of the `$stores` alias declared in Phase 1. |
| `src/lib/stores/instrument-params.ts` | The first concrete store: `frequencyStore` — 110 Hz (A2) → 880 Hz (A5), default 440 (A4), `curve: 'log'` so octaves are evenly spaced across the knob's sweep. |
| `src/lib/stores/create-param-store.test.ts` | 10 unit tests: clamping, reset, log + linear normalized mapping, the `min > 0` log guard, formatting, bindTo's immediate direct-set push, ramped update pushes, `ramp: 0` direct sets, no-op writes not notifying, and unbind. |
| `src/lib/components/ui/Knob.svelte` | The audio-grade rotary knob (the one scaffolding-plan §Phase 3/§Phase 7 kept promising). 270° sweep rendered as SVG (track arc, accent value arc, indicator line). Takes a `ParamStore` directly — see decisions. Interactions: vertical drag (~200 px = full range, Shift = 10× fine), scroll wheel (1% / notch, Shift = 0.25%), arrows / PgUp / PgDn / Home / End, double-click = reset. Full `role="slider"` ARIA state including `aria-valuetext="440 Hz"`. |
| `src/lib/audio/voice.ts` | The proof-of-life voice that replaces `test-tone.ts`. Same lazy discipline as `context.ts` (no top-level `tone` import). `startVoice()` / `stopVoice()` hold and release the sine via `triggerAttack` / `triggerRelease`; on first use it creates the module-scoped `Tone.Synth` and calls `frequencyStore.bindTo(synth.frequency)` **once** for the synth's lifetime. |

### Modified files

| File | Change |
|---|---|
| `src/lib/components/workbench/InstrumentPanel.svelte` | New cluster after the Voice block (left-border divider): the `<Knob param={frequencyStore} />` with a "Freq" label styled like the macro labels, a **Play tone / Stop tone** toggle `Button` (with `aria-pressed`), and the same inline `role="alert"` error span pattern Phase 6 used in TransportBar. The four macro placeholders and FX buttons are untouched. |
| `src/lib/components/workbench/Stage.svelte` | The "silent" placeholder became the DoD's live readout: `{frequencyStore.format()}` ("440 Hz") in large tabular-numeral mono, with the store's label beneath. Gained a `<script>` block; the 2D/3D toggle chips stay as-is for Phase 8. |
| `src/lib/components/workbench/TransportBar.svelte` | The temporary **"Test tone (will be removed)" button is removed**, along with its handler, error state, and audio imports. Rec/Play/Stop/Keep/Mutate/Discard stay `disabled`, reserved for real transport scheduling. |
| `CLAUDE.md` | Project-state paragraph updated: phases 1–3 + 6 + 7 landed, critical path complete, what remains (8, 9, 10). |

### Deleted files

| File | Why |
|---|---|
| `src/lib/audio/test-tone.ts` | Throwaway by its own header comment. Its two jobs (own the synth, make sound) moved to `voice.ts`, now store-driven. `context.ts` — the lifecycle owner — is untouched, exactly as the Phase 6 file split intended. |

---

## How it works (the binding path)

1. `frequencyStore` is created at module scope — a `$state` rune holding `440`, clamped writes, and a plain (deliberately non-reactive) listener set for audio pushes.
2. **UI → store**: the Knob converts pointer/wheel/keyboard gestures into the store's curve-aware `normalized` 0..1 space and calls `setNormalized()`; the Stage readout and the Knob's own arc/ARIA state re-render because reading `store.value` / `store.normalized` inside a template tracks the rune.
3. **Store → audio**: the first `startVoice()` call (inside the click gesture) runs `ensureAudioStarted()` (Phase 6, unchanged), creates the synth, and calls `frequencyStore.bindTo(synth.frequency)`. `bindTo` pushes the current value immediately as a direct set (nothing is sounding yet), then every subsequent store write calls `synth.frequency.rampTo(v, 0.02)` — synchronously, inside the setter.
4. Turning the knob while the tone holds is therefore: pointer event → `setNormalized` → clamped rune write (readout updates) → listener → 20 ms frequency ramp (pitch glides, no zipper noise). No component watches the store to "apply" it to audio; the binding *is* the application.

---

## Notable decisions & why

- **`bindTo` uses a plain listener set, not `$effect`.** The obvious Svelte-idiomatic implementation (`$effect.root` + `$effect` around `param.rampTo`) was considered and rejected for two concrete reasons. (1) Effects flush at the end of the microtask; a synchronous listener notifies the audio thread *inside the setter*, so a knob gesture reaches Tone with zero added latency. (2) Server-compiled runes never run effects — and Vitest in this repo runs in a plain Node environment (SSR transform), so an effect-based `bindTo` would have been untestable without adding a DOM environment dependency just to prove the core pattern works. UI reactivity still comes from `$state`; the listener set is audio-only plumbing. This is also why the one `eslint-disable svelte/prefer-svelte-reactivity` exists: the rule assumes any `Set` in a `.svelte.ts` file is UI state, and this one intentionally isn't — nothing should re-render when a binding is added.
- **`create-param-store.svelte.ts`, not `createParamStore.ts`.** Two forced renames from the plan's literal filename: runes in a `.ts` module require the `.svelte.ts` extension, and the plan's own §3 naming conventions specify kebab-case for non-components (`create-param-store.ts` is even its example). The factory keeps the camelCase name `createParamStore` per the `createXxxStore()` convention; the module-scoped instance is `frequencyStore` per `xxxStore`.
- **The Knob takes the `ParamStore` itself, not `value`/`min`/`max` props.** A duplicate-props API (`<Knob bind:value={store.value} min={110} max={880}>`) invites the call site's range to drift from the store's — a silent bug where the knob sweeps a different range than the param clamps to. Passing the store kills that whole class: range, curve, label, format all come from one place, and the call site is one attribute (`<Knob param={frequencyStore} />`). This deliberately couples the Knob to the param-store *type* — acceptable because "stores are the contract" is the app's core pattern, not an implementation detail. Generic value-y cases keep the Slider, which stays prop-based.
- **The store owns the perceptual curve, not the control.** `curve: 'log'` lives in `createParamStore`, exposed as the `normalized` 0..1 space that any control maps gestures into. A linear frequency knob crams three octaves into the first 43% of its sweep; log spacing makes equal turns produce equal musical intervals. Putting the mapping in the store means the Knob, a future 3D control, and the randomness engine all agree on what "halfway" means. The factory throws on `curve: 'log'` with `min <= 0` rather than producing `NaN`s at runtime.
- **No step/quantization in v1.** An earlier draft snapped values to a `step`, but quantization interacts badly with fine-control gestures near the bottom of a log range (a 0.25% wheel tick at 110 Hz is ~0.25 Hz — smaller than a 1 Hz step, so the knob stalls). The value stays a float; `format()` rounds for display and `aria-valuenow` rounds for AT. Musical quantization (semitones, cents) is a v0.2 concern that belongs with real voices.
- **`bindTo`'s initial push is a direct set; updates ramp.** At bind time nothing is sounding, so gliding into the initial value is meaningless; every later write ramps over 20 ms — long enough to kill zipper noise, short enough to feel instant. `ramp: 0` opts into direct sets for params that must jump. The bind in `voice.ts` happens once, at synth creation, and the unbind handle is deliberately dropped — the voice is never disposed, and the completion of the pattern (dispose → unbind) is documented at the call site for the first consumer that does dispose nodes.
- **The tone became holdable, and its trigger moved to the Instrument panel.** Phase 6's 200 ms one-shot can't demonstrate "turn the knob *while it's playing*" — the DoD's whole point. `startVoice`/`stopVoice` (attack/release) replace it, driven by a Play tone / Stop tone toggle next to the knob. It did *not* go on the Transport bar: Rec/Play/Stop there are reserved for sketch transport (record/playback scheduling), and overloading them for a voice trigger would burn exactly the affordance a later phase needs. The Instrument panel is where an instrument's sound lives.
- **`BindableToneParam` is a structural type, not an import from `tone`.** `bindTo` accepts `{ value; rampTo() }` — the subset it actually touches — declared locally. A real `import type { Param } from 'tone'` would have been fine for the bundle (type imports erase), but the structural type also keeps the *stores* layer conceptually independent of Tone: anything rampable can be bound, which is exactly the shape the Threlte side of the contract wants later. `Tone.Signal<'frequency'>` satisfies it structurally; `pnpm check` proves that at the `voice.ts` call site.
- **The Knob's wheel listener is attached manually with `{ passive: false }`.** Svelte 5 registers `onwheel` attribute handlers as passive for scroll performance, which makes `preventDefault()` a no-op — so scrolling on the knob would also scroll the page. A small `$effect` adds the listener non-passively and removes it on teardown. Drag uses pointer capture (`setPointerCapture`) so fast drags don't drop when the cursor leaves the 48 px hit area, and `touch-action: none` keeps touch drags from panning.
- **Fine-control ratios are per-gesture, applied incrementally.** Shift-drag applies a 10× divisor to each pointer-move *delta* rather than rescaling from the gesture's origin, so toggling Shift mid-drag doesn't jump the value. Keyboard and wheel steps are percentages of the normalized range (1% / 0.25%), which in log space means "same musical interval everywhere on the dial" — the behavior a musician's hand expects.
- **`ARCHITECTURE.md` still doesn't exist — the recipe lives in the factory's header.** Third time's the pattern: Phase 3 put primitive conventions in component headers, Phase 6 put audio rules in `context.ts`'s header, and Phase 7 puts "How to add a new param" at the top of `create-param-store.svelte.ts` — the file a contributor doing that task opens first. Phase 10 owns consolidating all three into `ARCHITECTURE.md`. The DoD asks for the pattern to be documented well enough for a 15-minute second param, not for the file to exist.

---

## Verified by

Headless / automated — all clean:

```
pnpm lint     # prettier --check . && eslint .   →  clean (incl. the one justified eslint-disable)
pnpm check    # svelte-kit sync && svelte-check  →  4680 FILES 0 ERRORS 0 WARNINGS
pnpm test     # vitest run                       →  12 passed (smoke + context + 10 param-store)
pnpm build    # vite build                       →  ✓ built in 2.02s, no SSR crash
pnpm dev      # live probes                      →  200 × /, /sketch/abc, /memory, /settings, /auth/login
```

Structural checks on the live dev server and production build:

- **SSR HTML for `/`** renders the knob (`role="slider"`, `aria-valuenow="440"`, `aria-valuetext="440 Hz"`), the Stage readout ("440 Hz"), and the Play tone button; the string "Test tone" is gone; the only `tone`-ish script reference is the project's own path (`chaos-tone/…`).
- **The Phase 6 code-split still holds** with `voice.ts` statically imported by `InstrumentPanel`: Tone is still its own chunk (340.35 kB / 81 kB gzip, version signature `15.1.22`), referenced exactly once across the client bundle — as a dynamic `import()` — and never statically.
- Store → param pushes are proven by unit test (`bindTo` → `rampTo(550, 0.02)`), not just by ear.

### Requires a human at a browser (not verifiable headlessly)

- [ ] **The DoD money shot**: click **Play tone**, hold it, turn the knob — pitch glides live, readout tracks instantly, release with **Stop tone**.
- [ ] Knob feel: drag range comfortable, Shift-fine usable, wheel doesn't scroll the page, double-click resets to 440.
- [ ] Keyboard pass: Tab to the knob, arrows/PgUp/PgDn/Home/End move it, VoiceOver reads "Frequency, 440 Hz".
- [ ] Chrome / Firefox / Safari on macOS (Safari remains the strictest about the gesture-gated AudioContext).

---

## Deliberately deferred (per plan)

| Item | Why deferred |
|---|---|
| Second/third param (detune, volume, cutoff…) | The DoD wants the *pattern* proven once; more params ship with the real voice (v0.2), each a 15-minute recipe application. |
| Musical quantization (semitones/cents `step`) | Belongs with real voices; see the no-quantization decision above. |
| Audio → store direction (LFO/analyzer writing a store) | The contract's read side for Phase 8+ visuals; nothing needs it yet. |
| Macro knobs wired to stores | The four placeholders stay decorative until macros mean something (v0.2 voices). |
| `Knob` size/disabled variants, Tooltip value readouts | One consumer, one size. Variants ship with their first real caller (Phase 3 precedent). |
| `ARCHITECTURE.md` | Phase 10 owns developer docs; recipe lives in the factory header for now. |
| Sketch = snapshot-the-stores | Now *trivially possible* (stores exist to snapshot) but stateless v1 writes nothing anywhere. |

---

## What this unblocks

**The v1 critical path (1 → 2 → 3 → 6 → 7) is complete.** What remains for v0.1 is off-path:

- **Phase 8 (Threlte proof-of-life)** — parallel-track since Phase 2, and now *more* interesting: a 3D object can read `frequencyStore.normalized` the same way Stage does, making the first mesh reactive rather than idle (per the §9 aesthetic guardrails).
- **Phase 9 (CI/CD + Vercel)** and **Phase 10 (developer docs)** close out v0.1 — Phase 10 lifts the three header-comment doc islands (primitives, audio lifecycle, param recipe) into `ARCHITECTURE.md`.
- **v0.2 product work** starts from a working contract: real voices declare their params as stores, the Box of Randomness mutates *stores* (and audio + visuals follow for free), and "save a sketch" is "snapshot the stores" — the thing this phase just made snapshottable.
