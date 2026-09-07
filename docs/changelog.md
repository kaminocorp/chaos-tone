# Chaos Tone — Changelog

- [0.1.6 — Virtual DJ Slice A musical credibility](#016--virtual-dj-slice-a-musical-credibility-2026-09-07)
- [0.1.5 — Virtual DJ weekend v0](#015--virtual-dj-weekend-v0-2026-09-07)
- [0.1.4 — Param Store Foundation](#014--param-store-foundation-2026-08-05)
- [0.1.3 — Audio Proof-of-Life](#013--audio-proof-of-life-2026-06-11)
- [0.1.2 — Design Tokens & Primitives](#012--design-tokens--primitives-2026-05-18)
- [0.1.1 — Routing & Layout Shell](#011--routing--layout-shell-2026-05-18)
- [0.1.0 — Scaffolding](#010--scaffolding-2026-05-18)

---

## 0.1.6 — Virtual DJ Slice A musical credibility (2026-09-07)

Tighten weekend v0 so energy and transition are unmistakably audible within 1-2 bars. Rhythmic deep-house placeholders replace continuous drones. No new HTTP verbs in this PR.

### What landed

- Rhythmic deck in src/lib/dj/deck.ts: Transport-scheduled kick, hats, bass, chords, sparse perc/vox/fx. Master gain plus LPF track energy.
- Stronger set_energy via applyEnergyToRoles: wide filter and role-gain gap so 0.15 vs 0.85 is obvious.
- Audible transition(bars): dips energy about 0.4x floor 0.05 and ducks hats/perc/fx.
- Tests expanded in session.test.ts; smoke doc notes Slice A listen criteria.

### Out of scope

Further verbs and natural-language mapping wait for later slices.

### Verified

Verified on Mini with test check and build.

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

---

## 0.1.4 — Param Store Foundation (2026-08-05)

Phase 7 of the [scaffolding plan](./executing/scaffolding-plan.md) — State Foundation: `createParamStore`, and the **final phase on the stateless v1 critical path** (1 → 2 → 3 → 6 → 7). The "stores are the contract" pattern now runs end-to-end: one `frequencyStore` (110–880 Hz, log curve) is written by a new audio-grade **Knob** in the Instrument panel, read by a live readout in the Stage, and followed by the Tone.js voice's `frequency` signal via a declarative `bindTo()` — hold the tone, turn the knob, and the pitch glides in real time with zero "sync UI to audio" code. The **"Test tone (will be removed)" button was removed** as its label promised, replaced by a Play tone / Stop tone toggle beside the knob. Full what/where/why record in [`docs/completions/phase-7-completion.md`](./completions/phase-7-completion.md).

### What landed

**Param store factory** — `src/lib/stores/create-param-store.svelte.ts` (first occupant of `$stores`): rune-backed clamped `value`, curve-aware `normalized` 0..1 space (`'linear'` / `'log'`), `reset()`, `format()`, and `bindTo(toneParam, { ramp })` → unbind. The header comment is the "How to add a new param" recipe (Phase 10 lifts it into `ARCHITECTURE.md`). Audio pushes go through a plain synchronous listener set — not `$effect` — so a knob gesture reaches Tone inside the setter, and the store stays testable in a plain Node environment. `src/lib/stores/instrument-params.ts` declares the first store: `frequencyStore` (A2–A5, default A4, log curve so octaves are evenly spaced across the sweep).

**Knob primitive** — `src/lib/components/ui/Knob.svelte`, the audio-grade rotary control promised since Phase 3. 270° SVG sweep (track arc, accent value arc, indicator). Vertical drag with pointer capture (Shift = 10× fine, applied per-delta so mid-drag toggles don't jump), wheel (manually attached non-passive — Svelte 5's `onwheel` is passive, which would break `preventDefault`), full keyboard map (arrows / PgUp / PgDn / Home / End), double-click reset, complete `role="slider"` ARIA. Takes the `ParamStore` itself (`<Knob param={frequencyStore} />`) rather than duplicating `value`/`min`/`max` props that could drift from the store's range.

**Voice** — `src/lib/audio/voice.ts` replaces the deleted `test-tone.ts`. `startVoice()` / `stopVoice()` hold and release the sine (`triggerAttack`/`triggerRelease` — a 200 ms one-shot can't demo live pitch change); first use creates the module-scoped synth and binds `frequencyStore` to `synth.frequency` once for its lifetime (initial push is a direct set; every later write ramps 20 ms to kill zipper noise). Same lazy rules as `context.ts`, which is untouched.

**Wiring** — `InstrumentPanel` gains the Knob + "Freq" label + Play tone / Stop tone toggle (with the Phase 6 inline `role="alert"` error pattern); `Stage`'s "silent" placeholder became the live `440 Hz` readout; `TransportBar` dropped the test-tone button, handler, and audio imports (Rec/Play/Stop stay reserved for real transport).

**Tests** — 10 new unit tests for the factory (clamping, curves, the log `min > 0` guard, bindTo push/ramp/unbind semantics); suite now 12 passing.

### Notable decisions & why

- **Listener-set `bindTo`, not `$effect`** — synchronous audio pushes (no effect-flush latency) and Node-testability (server-compiled effects never run). UI reactivity still comes from `$state`; hence the one justified `eslint-disable svelte/prefer-svelte-reactivity` on the deliberately non-reactive Set.
- **Kebab-case `.svelte.ts` filename** — runes require the extension; the plan's own §3 conventions require the kebab-case (its example is literally `create-param-store.ts`), overriding the task line's `createParamStore.ts`.
- **The store owns the perceptual curve** — `normalized` is the shared gesture space, so knob, future 3D controls, and the randomness engine agree on what "halfway" means; factory throws on `log` with `min <= 0`.
- **No step/quantization in v1** — snapping stalls fine gestures at the bottom of a log range; `format()`/`aria-valuenow` round for display, the value stays float. Musical quantization ships with real voices.
- **Voice trigger lives in the Instrument panel, not the Transport bar** — Rec/Play/Stop are reserved for sketch transport; overloading them would burn the exact affordance a later phase needs.

### Verified by

```
pnpm lint     # prettier --check . && eslint .   →  clean
pnpm check    # svelte-kit sync && svelte-check  →  4680 FILES 0 ERRORS 0 WARNINGS
pnpm test     # vitest run                       →  12 passed (3 files)
pnpm build    # vite build                       →  ✓ built in 2.02s, no SSR crash
pnpm dev      # live probes                      →  200 × all five Alpha routes
```

SSR HTML renders the knob (`aria-valuetext="440 Hz"`), the Stage readout, and the Play tone button, with "Test tone" gone. The Phase 6 code-split still holds: Tone remains its own 340 kB chunk, referenced exactly once as a dynamic `import()`, never statically. Store → param pushes are unit-proven (`rampTo(550, 0.02)`), not just eyeballed. Flagged for human ears: the hold-and-turn pitch glide, knob feel, keyboard/VoiceOver pass, Chrome/Firefox/Safari.

### What this unblocks

**The v1 critical path is complete.** Phase 8 (Threlte) can make its first mesh *reactive* by reading `frequencyStore.normalized` exactly as Stage does; Phases 9–10 (deploy, docs) close out v0.1; and v0.2 product work starts from a working contract — real voices declare param stores, the Box of Randomness mutates stores (audio + visuals follow for free), and "save a sketch" is "snapshot the stores."

---

## 0.1.3 — Audio Proof-of-Life (2026-06-11)

Phase 6 of the [scaffolding plan](./executing/scaffolding-plan.md) — Audio Proof-of-Life, and the **first phase on the stateless v1 critical path** (1 → 2 → 3 → 6 → 7). Click a button, hear a 200 ms sine: the full **Tone.js → Web Audio** pipeline is confirmed alive inside SvelteKit + Svelte 5 runes — started behind a user gesture, SSR-safe, and code-split out of the initial bundle. A new `src/lib/audio/` module (`context.ts` lifecycle owner + throwaway `test-tone.ts`) backs a temporary "Test tone (will be removed)" button in `TransportBar`. Full what/where/why record in [`docs/completions/phase-6-completion.md`](./completions/phase-6-completion.md).

This de-risks the three audio gotchas (user-gesture requirement, SSR-hostile browser globals, bundle bloat) that would otherwise block every later audio feature. Phase 7 (`createParamStore`) plugs straight into the reusable synth instance left reachable here.

### What landed

**Audio lifecycle module** — `src/lib/audio/context.ts` is the single owner of "is audio supported?" and "has the context started?". `isAudioSupported()` is a synchronous, SSR-safe feature check (`'AudioContext' in window`); `ensureAudioStarted()` lazily does `await import('tone')` then `Tone.start()`, both idempotent via module-scoped singletons. The header comment documents the user-gesture rule, the no-top-level-import rule, and the `lookAhead` / `latencyHint` latency tunables — Phase 10 lifts this into `ARCHITECTURE.md`.

**Test tone** — `src/lib/audio/test-tone.ts` (`playTestTone()`) lazily creates one reused `Tone.Synth` (sine oscillator) and fires `triggerAttackRelease(440, 0.2)`. The Synth's amplitude envelope avoids the click/pop a bare oscillator would make. Explicitly throwaway: Phase 7 swaps the hardcoded `440` for a value read from a param store.

**Button wiring** — `TransportBar.svelte` gains a secondary "Test tone (will be removed)" button in the centre cluster, an `async handleTestTone()` (feature-detect → try/catch → `console.error`), and an inline `role="alert"` error span bound to `audioError` (`$state`). Existing Rec/Play/Stop/Keep/Mutate/Discard buttons untouched and still `disabled`.

**Dependency** — `tone@15.1.22` under `dependencies` (runtime code). No `pnpm.onlyBuiltDependencies` change — Tone is pure JS, no postinstall/native binary.

**Unit test** — `src/lib/audio/context.test.ts` mocks the dynamically-imported `tone` module and proves the start-once guard (`Tone.start()` called exactly once across multiple `ensureAudioStarted()` calls).

### Notable decisions & why

- **Dynamic `import('tone')` inside a function, never at module top level.** `TransportBar` statically imports the audio modules, so a top-level `import * as Tone from 'tone'` would execute during SSR (no `window`) and pull ~340 kB into the initial bundle. The runtime import lives only inside `ensureAudioStarted()`; type-only imports (`import type * as ToneModule from 'tone'`) give full typing and are erased at compile time. Same lazy discipline Threlte uses in Phase 8.
- **The code-split is verified, not assumed.** The build emits Tone as its own chunk (340 kB / 81 kB gzip, signature `const dr="15.1.22"`); the Workbench chunk references it exactly once as a dynamic `import("./…")`, never statically; and the SSR HTML for `/` has no static `tone` script reference. The DoD "not in the initial bundle" is confirmed structurally.
- **Lifecycle and sound source are split across two files.** `context.ts` outlives the proof-of-life (Phase 7+ keep calling `ensureAudioStarted()`); `test-tone.ts` is throwaway and self-labels as such. Deleting the test tone later won't disturb the lifecycle owner.
- **One reused `Synth`, module-scoped.** Avoids create/dispose churn per click and is reachable so Phase 7 can make its frequency reactive while a tone holds.
- **Sticky activation covers the async gap.** The click handler runs synchronously inside the gesture; the page keeps sticky activation across the awaited dynamic import, so resuming the context still counts as user-initiated.
- **Inline `$state` error message, not a `Toast`.** `Toast` was tied to the deferred Phase 5 and doesn't exist; an inline `role="alert"` span is honest and sufficient for a button that gets removed in Phase 7. Consistent with the Phase 3 "ship a primitive with its first real consumer" stance.
- **Latency left at Tone defaults but documented.** Tuning `lookAhead` / `latencyHint` belongs with the first real voice (v0.2); the knobs are recorded in the `context.ts` header so they don't have to be rediscovered.

### Verified by

Headless commands clean:

```
pnpm check    # svelte-kit sync && svelte-check  →  4676 FILES 0 ERRORS 0 WARNINGS
pnpm test     # vitest run                       →  2 passed (smoke + context start-once)
pnpm build    # vite build                       →  ✓ built, no SSR crash; Tone in its own 340 kB chunk
pnpm dev      # GET / → 200, SSR renders the button, no static tone reference
```

`pnpm lint` passes for every Phase 6 file. One pre-existing, out-of-scope prettier warning remains on the working-tree copy of `CLAUDE.md` (a user edit predating this phase; committed `HEAD:CLAUDE.md` is clean) — left untouched deliberately.

Three DoD items need a human at a browser with speakers (audible sine; no audio on load via the Step 5 console check; Chrome/Firefox/Safari on macOS, Safari strictest). The structural guarantees behind them are confirmed above; what's left is "do your ears hear it" across engines.

### Deliberately deferred (per plan)

| Item | Why deferred |
|---|---|
| Real instrument / voice / preset / effect | Out of scope — this is proof of life. v0.2. |
| Transport play/record behavior | Rec/Play/Stop stay `disabled`; scheduling is later. |
| Reactive / store-bound frequency | Phase 7 (`createParamStore`). The `440` is hardcoded on purpose. |
| Latency tuning (`lookAhead`, `latencyHint`) | First real voice (v0.2). Knobs documented in the `context.ts` header. |
| `ARCHITECTURE.md` audio section | Phase 10 owns developer docs. Rules live in the `context.ts` header for now. |

### What this unblocks

**Phase 7 (`createParamStore`)** plugs directly in: `playTestTone()`'s `440` becomes a frequency param store; a `Knob`/`Slider` in `InstrumentPanel` writes it, a `Stage` readout reads it, and turning the knob while the tone holds changes pitch live. At that point the "Test tone (will be removed)" button is removed — as its label promises — and replaced by the real bound control.

---

## 0.1.2 — Design Tokens & Primitives (2026-05-18)

Phase 3 of the [scaffolding plan](./executing/scaffolding-plan.md) — Design Token & Primitive Layer (minimal). The visual system gained a shared backbone: an expanded `@theme {}` in `src/app.css` (motion durations, border radii, font stacks alongside the Phase 2 palette), five UI primitives under `src/lib/components/ui/` (`Button`, `IconButton`, `Input`, `Slider`, `Panel`), and a region refactor so no Workbench surface or auth route uses raw HTML `<button>` or `<input>` anywhere. Full what/where/why record in [`docs/completions/phase-3-completion.md`](./completions/phase-3-completion.md).

Every clickable affordance in the app now flows through the primitive layer. Future phases add product behavior (state binding, audio, 3D) rather than reinventing button/input/slider styling.

### What landed

**Five UI primitives** — `src/lib/components/ui/Button.svelte` (variants `primary` / `secondary` / `ghost`; sizes `sm` / `md` / `lg`; spreads through any standard `<button>` attribute), `IconButton.svelte` (square; required `label` becomes the accessible name; same variant/size axes), `Input.svelte` (single-line text-y; `type` overridable to `email`/`search`/etc.; `value` is `$bindable`), `Slider.svelte` (range slider wrapping `<input type="range">`; horizontal + vertical orientations; track/thumb styled via `.ct-slider` in `app.css`), and `Panel.svelte` (section wrapper with optional header, optional collapse, and a trailing `actions` snippet slot for header right-side content).

**Expanded design tokens** — `src/app.css`'s `@theme {}` block now adds `--font-sans` and `--font-mono` (system-stack fallbacks; real font files come later), `--duration-quick: 120ms` / `--duration-normal: 160ms` / `--duration-slow: 220ms` (short and decisive per [`frontend-overview.md`](../executing/frontend-overview.md) §9), and `--radius-xs|sm|md|lg`. A `.ct-slider` CSS block at the bottom of the file handles the native range input's track and thumb styling — pseudo-elements (`::-webkit-slider-thumb`, `::-moz-range-track`, etc.) cannot be reached from Tailwind utility classes, so they live in plain CSS that still reads from the same `var(--color-*)` tokens.

**Icon library** — `@lucide/svelte@^1.16.0` installed as a devDependency (peers `svelte ^5`). Eight icons referenced so far across `TopBar` (`Command`, `User`) and `TransportBar` (`Circle`, `Play`, `Square`), each imported as a named export so Rollup's tree-shaker only bundles what's used.

**Region refactor** — `TopBar` (⌘K placeholder → `<IconButton>` with the `Command` icon; avatar circle → `<IconButton>` with `User`), `JournalPanel` (wrapped in `<Panel>`; search field added via `<Input type="search">` bound to local `$state`; "+ New sketch" → `<Button>`), `ChaosPanel` (wrapped in `<Panel>`; six vertical `<Slider>`s bound to a local `weights` `$state` record; "Mutate ▸" → `<Button>`), `InstrumentPanel` (FX 1/2/3 spans → ghost `<Button>`; macro circles stay decorative since the audio-grade knob is Phase 7), `TransportBar` (REC → primary `<Button>` + `Circle` icon; Play/Stop → `<IconButton>` with `Play`/`Square`; Keep/Mutate/Discard → `<Button>`). `/auth/login` likewise lifted to `<Input>` + `<Button>`.

### Notable decisions & why

- **Tailwind 4 `@theme {}` is the single token home — no separate config file.** Spacing, motion, fonts, radii, colors all live in `src/app.css` inside one `@theme {}` block. Tailwind 4 specifically wants tokens here: every variable named `--color-*`, `--font-*`, `--duration-*`, etc. becomes a utility class automatically (`bg-ink-100`, `font-mono`, `duration-quick`). Splitting tokens between CSS and a TS config buys nothing and makes "where does this color live" a two-place question. Consistent with the Phase 1 stance.
- **Kept Tailwind's default spacing scale; did NOT redefine `--spacing-*`.** The plan calls for "a spacing scale" as a token category. I deliberately did not define `--spacing-*` tokens. Tailwind 4 has a built-in 0.25rem-step spacing scale (`p-1`, …, `p-96`) that's been stress-tested by millions of devs. Overriding `--spacing-*` would either replace that whole scale (forcing every utility class in the codebase to be re-audited) or duplicate values that already exist. Both moves cost real time for zero gain. Semantic spacing tokens (`--spacing-panel-gutter`, etc.) belong *after* wireframes have surfaced repeated specific values worth naming.
- **Slider styling lives in `app.css`, not in the component.** The native range input's pseudo-elements — `::-webkit-slider-thumb`, `::-webkit-slider-runnable-track`, `::-moz-range-thumb`, `::-moz-range-track` — are unreachable from Tailwind utility classes. Tailwind generates rules keyed on element selectors; vendor-prefixed pseudo-elements on form controls can't be expressed as arbitrary variants without per-property workarounds. Pulling the styling into a plain CSS class is honest and keeps the component file short. The class uses `var(--color-*)` so it still reads from the same token system Tailwind utilities do.
- **`<input type="range">` instead of a custom pointer-event slider.** Native range inputs come with keyboard accessibility for free (`←`/`→`/`↑`/`↓`/`Home`/`End`/`PgUp`/`PgDn`), screen-reader announcement, focus rings, and OS-level input devices. Building a custom slider that matches *any* of that costs hours; matching *all* of it costs days. The "audio-grade knob" promised in `scaffolding-plan.md` §Phase 7 is a separate component with different physics (drag-radius, scroll-wheel fine-control, double-click-reset, scroll-pixel-to-value mapping). For Phase 3, native is correct; the tactile knob ships where it matters most (the Instrument panel) when Phase 7 lands.
- **Vertical sliders use `writing-mode: vertical-rl`.** The legacy `-webkit-appearance: slider-vertical` is Chromium-only and has been deprecated in the WHATWG spec discussion. `writing-mode` is the modern cross-browser approach (works in Firefox, Safari, and Chromium, stable since around 2023). `direction: rtl` ensures the bottom of the visible slider corresponds to `min` and the top to `max`, which matches how mixer-style faders read.
- **`Panel` accepts a `class` prop; region wrappers don't (and shouldn't).** The `class` prop is a "let the parent nudge styling" knob and should live on components that get composed in multiple contexts (primitives). Region components like `JournalPanel` exist exactly once and always go in the same grid cell — there's no caller that should be tweaking their classes. Promiscuous `class` props on every component encourages drift; reserving them for primitives keeps the constraint visible.
- **Extract `class` from `$props()` rest *before* spreading — bug caught during review.** My first pass had `<button class="… defaults" {...rest}>`. Since Svelte processes attributes left-to-right and `{...rest}` overrides earlier ones, a caller passing `<Button class="w-full">` would have *replaced* the variant/size class string with just `"w-full"` — silently. Fix: (a) pull `class` out of rest into a local `extraClass`, (b) move `{...rest}` *before* the explicit `class="…"`, with `{extraClass}` interpolated at the end so consumers can still augment without losing defaults. This is a Svelte 5 idiom worth memorizing — Svelte doesn't warn about it.
- **Icons via `@lucide/svelte`, imported as named exports.** `@lucide/svelte@1.16.0` is the Svelte-5–native package (the older `lucide-svelte` is Svelte 4 only). Each icon is its own importable component, so Rollup's tree-shaker only bundles what's referenced — production bundle includes exactly the eight icons used so far, not the ~1500-icon library. Downside: `svelte-check` now walks every icon file (319 → 4001), but that's a one-time cost on a fast SSD and not visible in dev/build wall-clock time.
- **Chaos sliders have local `$state`, not store-bound state.** The real Box-of-Randomness session store doesn't exist yet — its shape is part of Phase 7 (`createParamStore`) and the not-yet-numbered Box-of-Randomness implementation phase. Wiring the sliders to local state proves the Slider primitive works end-to-end (you can grab a thumb and watch it move) without committing to a store API that's still being designed. Swapping `$state(...)` for `randomnessSessionStore.weights` will be a one-line edit per consumer when the time comes.
- **Five primitives only — no `Toast`, `Tooltip`, `Switch`, `Tag`, `Modal`, `Drawer`, `Popover`, `Menu`.** The plan specifies exactly five primitives; the frontend overview lists a wishlist. Building `Toast` before there's a notification trigger or `Tooltip` before there's hover-content-worth-tipping is speculative. The wishlist primitives ship in the phases that introduce their callers (Toast → Phase 5 auth feedback; Tooltip → Phase 6+ when knobs need value readouts on hover; etc.).

### Verified by

All four DoD commands run clean:

```
pnpm lint     # prettier --check . && eslint .   →  All matched files use Prettier code style!
pnpm check    # svelte-kit sync && svelte-check  →  4001 FILES 0 ERRORS 0 WARNINGS
pnpm test     # vitest run                       →  1 passed (1)
pnpm build    # vite build                       →  ✓ built in 4.23s
pnpm dev      # vite dev                         →  VITE v7.3.3 ready in 398 ms
```

The `pnpm check` file count jumped from 319 → 4001 because `@lucide/svelte` ships every icon as a separate component file. Production bundle stays small because tree-shaking strips the unused 99% — the build output shows the per-route chunks barely grew, and a new shared `Input.js` chunk (1.98 kB) appeared because Vite saw that `Input` is reachable from both `/` (via `JournalPanel`) and `/auth/login` directly and hoisted it. Live-route probes on a fresh dev server: `200×5 / 303×1` across the full Alpha route set.

### Deliberately deferred (per plan)

| Item | Why deferred |
|---|---|
| Storybook | Plan §Phase 3 explicitly says "Storybook is NOT part of v0.1." Primitives are reviewed in-app. |
| Component-usage docs in `ARCHITECTURE.md` | Plan §Phase 10 owns developer docs. Each primitive carries an explanatory comment at the top of its file, which is what a contributor reads first anyway. |
| Custom spacing scale | Tailwind's default is fine until wireframes name specific spaces. See decision above. |
| Audio-reactive accent layer | Needs real analyzer signal — Phase 6+. Token comment in `app.css` flags it. |
| `Toast` / `Tooltip` / `Switch` / `Tag` / `Drawer` / `Modal` / `Popover` / `Menu` | Ship with their first real consumer rather than speculatively. |
| `Knob` (audio-grade) | Plan §Phase 3 explicitly says "real audio-grade knob comes later." Phase 7 owns it. |
| Light theme | Frontend-overview §10 — Alpha is dark only. |
| `prefers-reduced-motion` override | Deferred to v0.2 per frontend-overview §10. One-line addition when the time comes; token system uses fixed durations for now. |

### Open questions surfaced

- **Spacing-scale token naming** — when the time comes to add semantic spacing tokens, do you prefer numeric (`--spacing-3`) or semantic (`--spacing-panel-gutter`)? I lean semantic for top-level tokens and numeric for primitives. No decision needed yet.
- **Icon size convention** — I used `size={14}` for `IconButton` content and `size={10}` for inline icons inside `Button`. This is the start of a "small icon" convention. Worth formalizing into tokens (`--size-icon-sm: 14px`) the next time we add icons.
- **Lucide license** — Lucide is ISC-licensed (very permissive). No action needed unless you specifically want a non-ISC icon set.
- **`Knob` primitive timing** — the plan puts it in Phase 7, alongside `createParamStore`. That's the first phase where a real synth control matters. I'm comfortable holding the line on "Slider is sufficient until then."

### What this unblocks

- **Phase 4** (Supabase) — builds a profile-edit page in `/settings` using `Input` + `Button` without inventing styles.
- **Phase 5** (Auth) — the magic-link form is already lifted to primitives in `/auth/login`; Phase 5 wires the `onsubmit` handler and removes the `disabled` attributes.
- **Phase 6** (Audio proof-of-life) — drops a "Test tone" `<Button>` into `TransportBar`. No new primitive needed.
- **Phase 7** (`createParamStore`) — demonstrates against the existing `Slider` primitive *and* introduces the audio-grade `Knob` for the Instrument panel. The two live side-by-side: `Slider` for non-audio params (axis weights, generic settings), `Knob` for audio-rate params.
- **Phase 8** (Threlte) — no new primitives; the 3D mode toggle is the same `Button` family.
- **Future phases needing notifications, modals, or hover help** — ship `Toast`, `Modal`, `Tooltip` alongside their first real use case (see decision above).

The primitive layer is now "a small set of components everyone shares" rather than "a wishlist for someday." Every later phase that adds product surface area writes less custom CSS than it would have otherwise — and *that* compounding is the point.

---

## 0.1.1 — Routing & Layout Shell (2026-05-18)

Phase 2 of the [scaffolding plan](./executing/scaffolding-plan.md) — Routing & Layout Shell. Every Alpha route now resolves; the Workbench renders in its canonical five-region grid (TopBar / Journal / Stage / Chaos / Instrument / Transport) with each region a visibly-distinct empty stub; a small-screen blocker covers viewports below 1024px; and `src/app.css` carries the first `@theme {}` block sized just enough to give the regions a coherent "instrument" feel. No real product behavior yet — this is the spine every later phase clips features onto. Full what/where/why record in [`docs/completions/phase-2-completion.md`](./completions/phase-2-completion.md).

Every product surface that lands in Phases 3–8 now has a region to clip into and a route to render at. No future phase needs to (re)structure the Workbench grid.

### What landed

**Workbench composite + six region stubs** — `src/lib/components/workbench/Workbench.svelte` arranges six children (`TopBar`, `JournalPanel`, `Stage`, `ChaosPanel`, `InstrumentPanel`, `TransportBar`) into the canonical five-region grid documented in [`frontend-overview.md`](../executing/frontend-overview.md) §3. Each region is its own importable Svelte 5 component with no props, no state, and just enough placeholder content (an axis-label row, four macro labels, three transport-button trio, etc.) to make the layout legible at a glance.

**Auxiliary routes** — `src/routes/sketch/[id]/+page.svelte` (renders the same Workbench as `/`, no hydration yet), `src/routes/memory/+page.svelte`, `src/routes/settings/+page.svelte`, `src/routes/auth/login/+page.svelte` (visual stub of the magic-link form, all inputs disabled), and `src/routes/auth/callback/+server.ts` (placeholder GET handler that 303s back to `/` — Phase 5 will replace the body with the real Supabase code exchange).

**Global chrome** — `src/lib/components/SmallScreenBlocker.svelte` mounted once in `src/routes/+layout.svelte` so it covers *every* route uniformly (including `/auth/login`, which someone might hit from a phone link). It subscribes to `window.matchMedia('(min-width: 1024px)')` — fires once per threshold crossing rather than on every pixel of a drag — and renders a fixed full-screen "Desktop only for now" message when the viewport is too narrow. `src/routes/+page.svelte` now renders `<Workbench />` instead of the Phase 1 placeholder.

**Initial design tokens** — `src/app.css` gained an `@theme {}` block with `--color-ink-950 … --color-ink-100` (a warm-neutral ramp from near-black to parchment) and `--color-accent-500` / `--color-accent-400` (warm copper). Just enough to give the regions distinct surfaces and one accent for hover states. The full token system (spacing scale, radii, motion durations, font stacks, audio-reactive accent layer) is intentionally deferred to Phase 3, which owns it as a phase.

### Notable decisions & why

- **Canonical grid uses inline `grid-template-rows`/`columns`, not Tailwind utility classes.** `Workbench.svelte` sets `grid-template-rows: 48px minmax(0, 1fr) 220px 64px` and `grid-template-columns: 280px minmax(0, 1fr) 320px` via an inline `style=`, while the named placements (`col-span-3`, `col-start-2`, `row-start-3`) stay as Tailwind classes. Tailwind's arbitrary-value grid-template syntax (`grid-rows-[48px_minmax(0,1fr)_220px_64px]`) is technically possible but unreadable at this length and ships the unusual numbers through the JIT for no real benefit. Inline `style` makes the documented contract from `frontend-overview.md` §3 literally visible in one line; swapping in wireframe-derived numbers later is a one-line edit. The named placements remain Tailwind because that's what benefits from class sorting.
- **`min-h-0` on every row-2 grid cell.** CSS Grid items default to `min-height: auto`, which means a flex child that wants to grow taller than its row (the eventual long sketch list, for example) will silently push the row larger and break the fixed Instrument/Transport footer alignment. `min-h-0` opts each cell out of that intrinsic minimum, so `overflow-y-auto` inside the panels actually clips and scrolls instead of bleeding. Invisible bug until you have real content — easier to inoculate up front than retrofit.
- **No `$props()` call in propless region stubs.** First pass used `let {}: Record<string, never> = $props()` as a future-proof placeholder. ESLint's `no-empty-pattern` rule rejected it — and correctly so, since an empty destructure discards the right-hand value. In Svelte 5, calling `$props()` is only required when you actually consume props; propless stubs should simply omit the call, and the moment a real prop appears the destructure comes back with content. The cost of "more diff later" is much smaller than seven lint errors that silently encourage developers to disable a useful rule.
- **`SmallScreenBlocker` uses `matchMedia`, not a resize listener.** For a binary blocker that only cares "are we above 1024px or below," `matchMedia` is the right primitive — it fires once per threshold crossing, not on every pixel of a resize drag. A `resize` listener would fire dozens of times per drag and force us to debounce; `matchMedia` already gives us the debounced signal for free. The `$effect`'s returned cleanup function removes the listener correctly on teardown.
- **Blocker mounted once in `+layout.svelte`, not per route.** Every route in Alpha should be desktop-only, including `/auth/login` (phone link risk) and `/settings` (no reason to make that one less protected). Mounting once at the layout level guarantees uniform coverage and avoids the "one route forgot to add the blocker" failure mode. The blocker is `position: fixed; inset: 0; z-index: 50` — above any route content without affecting layout flow when it's not displayed.
- **`/auth/callback` returns a real 303 redirect, not a 200 placeholder.** Phase 5 will replace the handler body with the real Supabase code exchange, which itself ends in a redirect. If a contributor or CI smoke test hits the route during Phases 2–4, they end up somewhere sensible (the Workbench) rather than on a blank page. 303 is what SvelteKit's `redirect()` defaults to for non-form GETs.
- **Initial design tokens scoped narrowly; full system deferred to Phase 3.** The scaffolding plan splits this work explicitly — Phase 2's final task is "establish initial design tokens" and Phase 3 is the full "Design Token & Primitive Layer." If we shipped the entire token set here, Phase 3 would have nothing left. The minimum-viable set is the one that lets the six region stubs *look visibly distinct* — a small neutral ramp and one accent. Everything else lands when primitives need it.
- **Both `/` and `/sketch/[id]` render the same Workbench.** `frontend-overview.md` §2 is explicit — both routes show the same console, and the difference is which sketch is loaded into shared stores. With no sketch hydration yet (Phase 4 + Phase 7), the two routes literally look identical, and that's correct. Phase 4 will introduce a `+page.ts` load function that reads `params.id` and hydrates the sketch store, at which point the routes diverge by *which sketch is current*, not by *which UI renders*.

### Verified by

All four DoD commands run clean against the updated tree:

```
pnpm lint     # prettier --check . && eslint .   →  All matched files use Prettier code style!
pnpm check    # svelte-kit sync && svelte-check  →  319 FILES 0 ERRORS 0 WARNINGS
pnpm test     # vitest run                       →  1 passed (1)
pnpm build    # vite build                       →  ✓ built in 1.10s
pnpm dev      # vite dev                         →  VITE v7.3.3 ready in 413 ms
```

Live-route probe of every new path on a clean dev server:

```
GET /              → 200
GET /sketch/abc    → 200
GET /memory       → 200
GET /settings      → 200
GET /auth/login    → 200
GET /auth/callback → 303 → /        (placeholder redirect, as designed)
```

`adapter-auto`'s "Could not detect a supported production environment" warning is still present — `@sveltejs/adapter-vercel` swap is Phase 9.

### Deliberately deferred (per plan)

| Item | Why deferred |
|---|---|
| Full `@theme {}` token system (spacing, radii, type, motion) | Phase 3 owns this as a phase. Shipping it here would leave Phase 3 with nothing. |
| Primitive components (`Button`, `Slider`, `Panel`, `Input`, `IconButton`) | Same — Phase 3's whole point. Region stubs use raw `<button>`/`<input>` for now because they're disabled placeholders; Phase 3 lifts them. |
| Icon library | Phase 3 — grouped with primitives. Region stubs use inline unicode (`▶`, `■`, `●`) which is throwaway. |
| Real responsive collapse handles on Journal/Chaos | `frontend-overview.md` mentions them, but the scaffolding plan doesn't require them in Phase 2. |
| `ARCHITECTURE.md` documenting the grid | Phase 10 owns developer docs. The grid is fully documented in `frontend-overview.md` §3 and in a comment inside `Workbench.svelte`. |

### Open questions surfaced

- **Grid proportions** — I used the starting numbers from `frontend-overview.md` §3 (`280 / flex / 320`, `48 / flex / 220 / 64`). These are documented as "starting points" and will move once wireframing happens. Nothing to decide now.
- **Region stub content** — each stub has just enough placeholder content (axis labels, macro labels, transport-button text) to make the layout legible. If you'd rather the regions be truly empty boxes, it's a one-line edit per file. Current choice trades a little visual noise for a much more useful "is the layout correct" review surface.
- **Color naming** — `ink-*` rather than `neutral-*` to distinguish the project palette from Tailwind's default `neutral-*` (which is colder, blue-tinted) and to signal these aren't generic grayscale — they're the *Chaos Tone* warm-neutral ramp. Easy to rename later; flagged in case you'd prefer a different convention.
- **Auth callback redirect target** — currently bounces to `/`. Phase 5 may want a "thanks, signing you in…" intermediate, but for now `/` is the right destination (the Workbench is also the post-login landing per `frontend-overview.md` §6.3).

### What this unblocks

- **Phase 3** (Design Tokens & Primitives) — lifts the placeholder buttons/inputs in the region stubs into proper `Button`, `IconButton`, `Slider`, `Input`, `Panel` primitives without restructuring the layout.
- **Phase 4** (Supabase) — adds `+page.server.ts` files alongside existing routes; the file structure is in place.
- **Phase 5** (Auth) — replaces the body of `auth/callback/+server.ts` and wires up the `auth/login/+page.svelte` form. No new files.
- **Phase 6** (Audio proof-of-life) — drops the test-tone button into the existing `TransportBar.svelte`.
- **Phase 7** (`createParamStore`) — wires a knob in `InstrumentPanel.svelte` and a readout in `Stage.svelte`. Both files exist.
- **Phase 8** (Threlte) — dynamically imports a `Stage3D` component into the existing `Stage.svelte` 3D toggle.

Phase 2 was the last phase that touches *structure*. Phases 3+ touch *content*.

---

## 0.1.0 — Scaffolding (2026-05-18)

Phase 1 of the [scaffolding plan](./executing/scaffolding-plan.md) — Repo & Tooling Foundation. Zero-to-`pnpm dev` plumbing only: no product features, no real components, no Supabase, no audio, no 3D. The goal is "fresh clone + two commands = blank SvelteKit page that lints, typechecks, tests, and builds". Hit. Full what/where/why record in [`docs/completions/phase-1-completion.md`](./completions/phase-1-completion.md).

Each subsequent phase (routing shell, Supabase, auth, audio proof-of-life, `createParamStore`, Threlte, CI) now has a working foundation it doesn't need to retrofit.

### What landed

**Config files at the repo root** — `.gitignore`, `.gitattributes` (forces LF + marks audio/image binaries; prevents diff noise on the first cross-platform commit), `.editorconfig` (tabs + LF + UTF-8; Markdown keeps trailing whitespace for hard breaks), `.npmrc` (`engine-strict=false`, `auto-install-peers=true`), `.nvmrc` (pinned to Node 22 LTS — see [the Node version section](#the-node-version-thing)), `package.json` (deps + scripts + `engines` + `packageManager: pnpm@10.28.2` + `pnpm.onlyBuiltDependencies` allowlist), `pnpm-lock.yaml` (committed for reproducible installs).

**Build-tooling configs** — `svelte.config.js` (adapter-auto + Svelte 5 runes mode + path aliases `$features → src/lib/features`, `$stores → src/lib/stores`), `vite.config.ts` (SvelteKit + Tailwind 4 Vite plugins + Vitest test glob `src/**/*.{test,spec}.{js,ts}`), `tsconfig.json` (extends generated `.svelte-kit/tsconfig.json`; adds `strict: true` and `noUncheckedIndexedAccess: true` on top of the SvelteKit defaults).

**Lint & format** — `eslint.config.js` (ESLint 9 flat config; `typescript-eslint` helper composing `js.configs.recommended`, `ts.configs.recommended`, `svelte.configs['flat/recommended']`, `prettier`, and `svelte.configs['flat/prettier']`; injects `svelteConfig` into the `*.svelte` parser block so ESLint understands Svelte 5 runes — without it, `$state`/`$derived` get flagged as undefined globals), `.prettierrc` (tabs, single quotes, no trailing commas, 100-col, `prettier-plugin-svelte` + `prettier-plugin-tailwindcss`), `.prettierignore` (excludes generated output, lockfile, **`docs/`** [user-authored prose], **`.claude/`**, and the eventual `src/lib/db/types.ts`).

**`src/` skeleton** — `app.html` (SvelteKit HTML shell with `data-sveltekit-preload-data="hover"`), `app.d.ts` (empty `App` namespace placeholder), `app.css` (`@import 'tailwindcss';` — Tailwind 4 CSS-first entry, nothing else), `src/lib/index.ts` (empty placeholder so `$lib` is importable), `src/lib/smoke.test.ts` (one trivial Vitest test proving the harness runs), `src/routes/+layout.svelte` (imports `app.css`, renders `children` via Svelte 5 `$props`), `src/routes/+page.svelte` (centered "Chaos Tone — v0.1 scaffold" placeholder using Tailwind utility classes — proves classes apply end-to-end through the Vite plugin).

### Notable decisions & why

- **Scaffolded manually, not via `pnpm dlx sv create`.** The `sv` CLI's Tailwind add-on installs Tailwind 3 — we'd have torn it out immediately for Tailwind 4's CSS-first model and dedicated Vite plugin. Same story for the default ESLint config shape. Easier to write the exact configs we want than to rewrite generated ones. Trade-off accepted: if SvelteKit's default scaffold improves later, we won't pick up the changes for free. Phase 1 is a one-shot.
- **Tailwind 4 with no `tailwind.config.ts`.** The plan's Phase 1 mentions a "minimal `tailwind.config.ts`"; I deliberately omitted it. Tailwind 4 is **CSS-first** — theme tokens, content globs, plugins all move into CSS via `@theme {}`, with content auto-discovered by `@tailwindcss/vite`. A `tailwind.config.ts` in v4 is technically loadable (via `@config "./tailwind.config.ts"` in CSS) but vestigial. Writing one to honor the letter of the plan would have created a file that does nothing. Phase 3 will expand `src/app.css` with `@theme {}` for design tokens.
- **Aliases `$lib`, `$features`, `$stores` — folders not yet created.** Declared in `svelte.config.js` even though `src/lib/features/` and `src/lib/stores/` don't exist yet. SvelteKit's generated `.svelte-kit/tsconfig.json` (which our `tsconfig.json` extends) picks up the aliases automatically — no separate `paths` entry needed. Phase 7's `createParamStore` lands the first `$stores` import without a plumbing change.
- **`noUncheckedIndexedAccess: true`.** The single highest-leverage strict-mode flag for an audio app. Forces every `arr[i]` to be `T | undefined` rather than `T` — catches the kind of bugs that produce silent NaN audio output. Phase 7's param-store handling and Phase 8's Threlte ref handling both benefit. Cheap to enable now, painful to retrofit later.
- **ESLint flat config, not legacy `.eslintrc`.** Flat config is the only supported format in ESLint 10 and the recommended format in 9. Writing legacy config now would be technical debt from day one. The flat-config Svelte + TS + Prettier-compat composition isn't significantly longer than the legacy form.
- **`prettier-plugin-tailwindcss` upgraded `^0.6.10 → ^0.8.0` during install.** 0.6.x throws `TypeError: getVisitorKeys is not a function or its return value is not iterable` when run against `.svelte` files in a Tailwind 4 setup — known incompatibility, 0.6.x predates Tailwind 4's AST changes. 0.8.0 handles it. Flagging here so the next contributor who tries to downgrade or pin loosely knows the floor.
- **`docs/` excluded from prettier.** When I ran `pnpm format` for the first time, it reformatted seven user-authored docs (vision, alpha-tech-stack, scaffolding-plan, etc.) — flipping indentation and rewrapping prose. Those docs were already staged in git; the user wrote them with intent and voice. I reverted the changes via `git checkout -- docs/` and added `docs/` to `.prettierignore`. Treating prose as user-authored content and excluding it from automated formatting is the safer default. If we later want consistent doc style, the call belongs with the author, not the lint pipeline.
- **`pnpm.onlyBuiltDependencies: ["esbuild"]`.** pnpm 10 disables postinstall scripts by default as a supply-chain hardening measure. esbuild's postinstall is what fetches its native platform binary; without approval, Vite builds fail at runtime with a missing-binary error. Explicit allowlist in `package.json` means new contributors don't trip the warning. Future risk noted: if we add a package that needs its postinstall (native audio bindings later), the build will fail until we add it here. That's the right trade-off — we want the friction.

### The Node version thing

The user's machine is on **Node 23.3.0** (Homebrew's latest at the time of this commit). First `pnpm install` hard-failed:

```
ERR_PNPM_UNSUPPORTED_ENGINE
Expected version: ^20.19 || ^22.12 || >=24
Got: v23.3.0
```

Node 23 is an odd-numbered "Current" release, past EOL since April 2026. It falls in a literal gap in the `engines.node` constraint of `@sveltejs/vite-plugin-svelte@6.2.4` and several siblings. Resolution: three coordinated changes — `.nvmrc` pinned to `22` (LTS; what contributors should actually run), `.npmrc` set `engine-strict=false` (so installs proceed even on a mismatched Node; the packages run fine on 23 in practice — engines is a hint, not a hard incompat), and `package.json` `engines.node: ">=20.0.0"` (our own floor, looser than upstream's, so we don't artificially exclude valid Node versions). Recommendation surfaced to user: `nvm install 22 && nvm use 22` to silence the install warnings.

### Verified by

All four DoD commands run clean against a fresh install:

```
pnpm lint     # prettier --check . && eslint .   →  All matched files use Prettier code style!
pnpm check    # svelte-kit sync && svelte-check  →  301 FILES 0 ERRORS 0 WARNINGS
pnpm test     # vitest run                       →  1 passed (1)
pnpm build    # vite build                       →  ✓ built in 1.00s
pnpm dev      # vite dev                         →  VITE v7.3.3 ready in 408 ms
```

Build emits an expected "Could not detect a supported production environment" warning — `adapter-auto` is correct for now; Phase 9 swaps in `@sveltejs/adapter-vercel` when we wire up CI/CD.

### Deliberately deferred (per plan)

| Item | Why deferred |
|---|---|
| `tailwind.config.ts` | Tailwind 4 CSS-first; would be a no-op file. See decision above. |
| Husky + lint-staged | Plan §Phase 1 lists as optional, §7 Q5 lists as open question. CI gates lint in Phase 9; pre-commit hooks slow down commits and are easy to retrofit. |
| Storybook | Plan §Phase 3 explicitly says "Storybook is NOT part of v0.1". |
| `.env.example` | Phase 4 (Supabase) introduces the first real env vars. An empty placeholder now would just be a placeholder. |
| `README.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md` | Plan defers to Phase 10. Writing them now means rewriting them as each phase lands. |

### Open questions surfaced

- **Node version** — confirm whether `.nvmrc` should stay at 22 LTS (current) or move to 24 (latest Current). Either works.
- **Husky pre-commit hooks** — plan §7 Q5, still open. Cheap to add (`pnpm add -D husky lint-staged` + `prepare` script tweak).
- **License** — `LICENSE` is Apache 2.0, predates this plan. Plan §7 Q6 lists license as an open question; current file suggests the answer is "Apache 2.0". Confirm or change before any public release.
- **`pnpm` 10 vs 11** — pinned to `pnpm@10.28.2` via `packageManager` (matches user's installed version). When pnpm 11 ships, the `packageManager` field needs bumping.

### What this unblocks

Every subsequent phase now has a working foundation that doesn't need to be retouched:

- **Phase 2** (Routing & Layout) — drop new routes and components; they lint, typecheck, and hot-reload.
- **Phase 3** (Design tokens) — extend `src/app.css` with `@theme {}`.
- **Phase 4** (Supabase) — add `.env`, `supabase/`, `src/lib/db/`.
- **Phase 5** (Auth) — `+layout.server.ts` + `hooks.server.ts`, no plumbing changes.
- **Phase 6** (Audio proof-of-life) — install Tone.js, write into `src/lib/audio/`.
- **Phase 7** (`createParamStore`) — `src/lib/stores/` (alias already configured).
- **Phase 8** (Threlte) — install `@threlte/core` + `@threlte/extras`, write into `src/lib/threed/`, mandatory lazy-loading via dynamic import.
- **Phase 9** (CI/CD) — swap `adapter-auto` → `adapter-vercel` and add `.github/workflows/`.

No subsequent phase touches the Phase 1 files except `package.json` (new deps) and `svelte.config.js` (adapter swap in Phase 9). That's the whole point of "decouple plumbing from product" — and it's now done.
