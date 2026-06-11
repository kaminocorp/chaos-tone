# Phase 6 — Audio Proof-of-Life — Implementation Plan

**Status**: Ready to build
**Date**: 2026-06-10
**Phase**: 6 of the [scaffolding plan](./scaffolding-plan.md) (first phase on the **stateless v1** path — see that plan's Stateless v1 amendment)
**Depends on**: Phase 2 (Workbench shell + `TransportBar`), Phase 3 (`Button` primitive)
**Unblocks**: Phase 7 (`createParamStore` — the knob→store→param→readout binding)

---

## 0. Goal & scope

**Goal**: Click a button, hear a 200 ms sine wave. The full Tone.js → Web Audio pipeline is confirmed alive inside SvelteKit + Svelte 5 runes, started correctly behind a user gesture, and code-split out of the initial bundle.

This is a **proof of life**, not a synth. We are de-risking three things that have real gotchas and would otherwise block every later audio feature:

1. **AudioContext requires a user gesture** — browsers refuse to start audio on page load.
2. **Tone.js touches browser globals** — naive top-level imports break SSR (`window`/`AudioContext` don't exist in Node).
3. **Tone.js is large** — it must not bloat the initial route bundle.

### In scope
- Install Tone.js.
- `src/lib/audio/context.ts` — lifecycle: `ensureAudioStarted()`, `isAudioSupported()`.
- `src/lib/audio/test-tone.ts` — `playTestTone()` firing a 200 ms sine.
- A temporary **"Test tone (will be removed)"** button wired into `TransportBar`.
- An unsupported-browser message path.
- A light unit test (mocked Tone) proving the start-once guard.
- In-file documentation of the latency tunables.

### Explicitly OUT of scope
- Any real instrument, voice, preset, or effect.
- Transport play/record (those buttons stay `disabled`).
- Store binding / reactive frequency — that is **Phase 7**; the tone is a hardcoded 440 Hz here.
- `ARCHITECTURE.md` (Phase 10 owns it — we leave a header comment in the audio module instead, matching the Phase 3 precedent for primitives).

---

## 1. Key constraints (read before writing code)

These shape every decision below; internalize them first.

- **No top-level `import … from 'tone'` anywhere reachable from a component's *static* import graph.** `TransportBar` statically imports our audio modules, so a top-level `import * as Tone from 'tone'` in those modules would (a) execute during SSR and (b) pull Tone into the initial bundle. Tone is loaded via **dynamic `import('tone')` inside a function**. Type-only imports (`import type * as Tone from 'tone'`) are fine — they're erased at compile time.
- **Start audio only inside the click handler.** Never on mount, never in an `$effect` that runs at load, never at module scope.
- **Sticky activation makes the `await import('tone')` delay safe.** Once the user has clicked, the page has sticky activation; resuming the AudioContext after an awaited dynamic import still counts as user-initiated. So the async gap between gesture and `Tone.start()` is fine.
- **Stateless v1**: nothing here persists or touches a backend. A shared synth instance lives in module memory for the session and is gone on refresh — that's correct.
- **Strict TS + `noUncheckedIndexedAccess`**: no `any` (it's grep-able and discouraged). Feature-detect with `'AudioContext' in window`, not `(window as any)`.

---

## 2. Design decisions (decided up front, so we don't re-derive mid-build)

| Decision | Choice | Why |
|---|---|---|
| How Tone is loaded | **Dynamic `import('tone')`**, cached in a module-scoped singleton | SSR-safe + keeps Tone out of the initial bundle (separate chunk), same lazy discipline as Threlte. |
| Dependency type | `dependencies` (`pnpm add tone`) | It's shipped runtime code, not tooling. (Vite bundles either way, so this is about honesty, not mechanics.) |
| `pnpm.onlyBuiltDependencies` | **No change needed** | Tone.js is pure JS/TS — no postinstall, no native binary. (The allowlist exists for native bindings we don't have yet.) |
| Sound source | A single lazily-created `Tone.Synth` with `oscillator.type: 'sine'`, reused across clicks | The Synth's built-in amplitude envelope avoids the click/pop a raw `Oscillator` at full gain produces. One reused instance avoids create/dispose churn. |
| Where the browser-support message lives | Local `$state` in `TransportBar` | `Toast` doesn't exist (it was tied to the now-deferred Phase 5). A small inline message is honest and sufficient for a throwaway button. |
| Latency config | Leave Tone defaults; **document** `lookAhead` / `latencyHint` in the module header | DoD only needs audible sound. Tuning latency belongs with the first real playable voice (v0.2), but we record the knobs now. |

---

## 3. Implementation steps

Do these in order. Each step ends with a concrete check before moving on.

### Step 1 — Install Tone.js

```sh
pnpm add tone
```

**Check**: `tone` appears under `dependencies` in `package.json`; `pnpm install` completes with no postinstall prompt (no `onlyBuiltDependencies` edit required). `pnpm dev` still boots.

---

### Step 2 — Audio lifecycle module

Create `src/lib/audio/context.ts`. This is the single owner of "is audio supported?" and "has the context been started?".

```ts
// src/lib/audio/context.ts
//
// Audio lifecycle for Chaos Tone.
//
// RULES (see docs/executing/phase-6-implementation.md §1):
//   - Tone.js is loaded via dynamic import INSIDE ensureAudioStarted(), never at
//     module top level — this keeps Tone out of the initial bundle and out of SSR.
//   - Tone.start() / AudioContext resume must be triggered by a user gesture.
//
// Latency tunables (left at Tone defaults for now; revisit with the first real voice):
//   - Tone.getContext().lookAhead        default 0.1s  — scheduling safety margin
//   - new Tone.Context({ latencyHint })  'interactive' trades buffer size for latency

import type * as ToneModule from 'tone';

let tone: typeof ToneModule | null = null;
let started = false;

/** Synchronous feature check — safe to call during SSR (guards on `window`). */
export function isAudioSupported(): boolean {
	return (
		typeof window !== 'undefined' &&
		('AudioContext' in window || 'webkitAudioContext' in window)
	);
}

/**
 * Lazily load Tone and start the AudioContext. MUST be called from within a user
 * gesture (e.g. a click handler). Idempotent — the import and Tone.start() each
 * happen at most once. Returns the loaded Tone module so callers can build nodes.
 */
export async function ensureAudioStarted(): Promise<typeof ToneModule> {
	if (!tone) {
		tone = await import('tone');
	}
	if (!started) {
		await tone.start();
		started = true;
	}
	return tone;
}
```

**Check**: `pnpm check` passes (no `any`, types resolve via the `type` import). Grep confirms there is **no** runtime `import … from 'tone'` at top level in this file.

---

### Step 3 — The test tone

Create `src/lib/audio/test-tone.ts`.

```ts
// src/lib/audio/test-tone.ts
//
// Temporary proof-of-life tone. Phase 7 replaces the hardcoded 440 Hz with a value
// read from a param store. This whole file is expected to shrink/move then.

import { ensureAudioStarted } from './context';
import type * as ToneModule from 'tone';

let synth: ToneModule.Synth | null = null;

/** Play a 200 ms sine at 440 Hz. Starts the audio context on first call. */
export async function playTestTone(): Promise<void> {
	const Tone = await ensureAudioStarted();
	if (!synth) {
		synth = new Tone.Synth({ oscillator: { type: 'sine' } }).toDestination();
	}
	synth.triggerAttackRelease(440, 0.2); // 440 Hz, 200 ms — envelope avoids clicks
}
```

**Check**: `pnpm check` passes. (No audible test yet — that's Step 4.)

---

### Step 4 — Wire the button into `TransportBar`

Edit `src/lib/components/workbench/TransportBar.svelte`. Add the temporary button + an inline error path. Keep the existing Rec/Play/Stop/Keep/Mutate/Discard buttons untouched (still `disabled`).

Add to the `<script>`:

```svelte
<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import { Circle, Play, Square } from '@lucide/svelte';
	import { isAudioSupported } from '$lib/audio/context';
	import { playTestTone } from '$lib/audio/test-tone';

	let audioError = $state<string | null>(null);

	async function handleTestTone() {
		audioError = null;
		if (!isAudioSupported()) {
			audioError = 'Web Audio is not supported in this browser.';
			return;
		}
		try {
			await playTestTone();
		} catch (err) {
			audioError = 'Could not start audio. Check the console.';
			console.error('[audio] test tone failed:', err);
		}
	}
</script>
```

Add the button to the center cluster of the footer (it's deliberately ugly/labelled — it gets removed in Phase 7):

```svelte
<div class="flex items-center gap-2">
	<Button size="sm" variant="secondary" onclick={handleTestTone}>
		Test tone (will be removed)
	</Button>
	{#if audioError}
		<span class="text-xs text-red-400" role="alert">{audioError}</span>
	{/if}
</div>
```

Notes:
- Svelte 5 runes: it's `onclick={…}` (not `on:click`) and `$state`.
- The handler is `async` but the click itself is synchronous, so sticky activation holds across the `await`.

**Check**: `pnpm dev`, open `/`, click the button → **you hear a short sine**. Click repeatedly → it retriggers cleanly with no clicks. No console errors.

---

### Step 5 — Confirm "no audio on page load"

This is a DoD requirement, not just hygiene.

**Check** (Chrome DevTools): hard-reload `/` **without clicking anything**. In the console run:

```js
// Should be 0 — Tone hasn't loaded, no context created yet:
performance.getEntriesByType('resource').filter((r) => r.name.includes('tone')).length;
```

Then in the Network tab, confirm no `tone`-named chunk is fetched until the first click. After clicking, the chunk loads and an `AudioContext` appears. (Optionally: the Media/▶ context indicator in the tab only lights up post-click.)

---

### Step 6 — Light unit test (mocked Tone)

Real Web Audio can't run in jsdom, and the plan demands no real coverage at v0.1 — but we can cheaply prove the **start-once guard** without audio. Create `src/lib/audio/context.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const startMock = vi.fn(() => Promise.resolve());

// Mock the dynamically-imported 'tone' module.
vi.mock('tone', () => ({ start: startMock }));

beforeEach(() => {
	startMock.mockClear();
	vi.resetModules(); // reset the module-scoped `started`/`tone` singletons
	vi.stubGlobal('window', { AudioContext: class {} });
});

describe('ensureAudioStarted', () => {
	it('calls Tone.start() only once across multiple calls', async () => {
		const { ensureAudioStarted } = await import('./context');
		await ensureAudioStarted();
		await ensureAudioStarted();
		expect(startMock).toHaveBeenCalledTimes(1);
	});
});
```

**Check**: `pnpm test` is green (smoke test + this one).

> If mocking the dynamic import proves fiddly in this setup, downgrade this to a single test of `isAudioSupported()` (toggle `window`/`AudioContext` via `vi.stubGlobal`) rather than fighting the harness. The start-once logic is also covered by the manual check in Step 4. Don't let the test block the phase.

---

### Step 7 — Documentation note

No `ARCHITECTURE.md` yet (Phase 10). Per the Phase 3 precedent ("each primitive carries an explanatory comment, which is what a contributor reads first anyway"), the lifecycle rules + latency tunables live in the **header comment of `context.ts`** (already included in Step 2). When `ARCHITECTURE.md` is created in Phase 10, lift that comment into an "Audio & the AudioContext lifecycle" section.

**Check**: the header comment in `context.ts` states (a) the user-gesture rule, (b) the no-top-level-import rule, (c) `lookAhead` / `latencyHint`.

---

## 4. Definition of Done

Mirrors the scaffolding plan's Phase 6 DoD, plus the bundle check:

- [ ] Clicking **Test tone** produces audible sound.
- [ ] The AudioContext is **not** started on page load — only on first user gesture (Step 5).
- [ ] No console errors related to the audio context on the happy path.
- [ ] Works in latest **Chrome, Firefox, Safari** on macOS.
- [ ] Tone.js is **not** in the initial `/` bundle — it loads as a separate chunk on first click (verify in `pnpm build` output / Network tab).
- [ ] An unsupported-browser path exists and shows a clear message.
- [ ] `pnpm lint && pnpm check && pnpm test && pnpm build` all clean.

---

## 5. Verification script

```sh
pnpm lint     # prettier --check . && eslint .
pnpm check    # svelte-kit sync && svelte-check  → 0 errors
pnpm test     # vitest run  → smoke + context test pass
pnpm build    # vite build  → look for a separate tone-*.js chunk
pnpm dev      # then, in the browser:
```

Browser pass (do all three engines):
1. Load `/`, do **not** click → run the Step 5 console snippet → result `0`, no `tone` chunk in Network.
2. Click **Test tone** → hear the sine; Network now shows the `tone` chunk; no console errors.
3. Click 5× rapidly → clean retriggers, no pops, no errors.

---

## 6. Risks & gotchas

| Risk | Mitigation |
|---|---|
| Top-level `tone` import sneaks back in (via Step 3 or a later edit) and breaks SSR / bloats the bundle | The runtime import lives **only** inside `ensureAudioStarted()`. Verify with the bundle check; an SSR crash on `pnpm build` is the loud signal. |
| Audio doesn't start despite the click | Confirm `Tone.start()` is reached and `await`ed; confirm the handler is actually a user gesture (not fired programmatically). Safari is the strictest — test it explicitly. |
| Raw oscillator clicks/pops | We use `Tone.Synth` (enveloped), not a bare `Oscillator`. Keep it. |
| Vitest can't load the dynamically-imported `tone` | Mock it (Step 6) or fall back to the `isAudioSupported()` test. Do not add jsdom Web Audio shims for a throwaway tone. |
| `noUncheckedIndexedAccess` / no-`any` friction | Feature-detect with `'AudioContext' in window`; the `type`-only Tone import gives full typing with zero runtime/bundle cost. |

---

## 7. What this unblocks

**Phase 7 (`createParamStore`)** plugs directly into this:
- `playTestTone()`'s hardcoded `440` becomes a value read from a frequency param store.
- A `Knob`/`Slider` in `InstrumentPanel` writes that store; a readout in `Stage` reads it; turning the knob **while the tone holds** changes pitch in real time.
- At that point the "Test tone (will be removed)" button is removed (as promised in its label) and replaced by the real bound control.

So keep the audio modules small and the synth instance reachable — Phase 7 will reach in and make its frequency reactive.

---

## 8. When done

Write `docs/completions/phase-6-completion.md` following the established pattern (file inventory → notable decisions & why → deliberately deferred → what it unblocks), and add a `0.1.3` entry to `docs/changelog.md`.
