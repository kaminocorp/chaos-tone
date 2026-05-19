# Phase 2 Completion — Routing & Layout Shell

**Status**: Complete
**Date**: 2026-05-18
**Plan reference**: [`docs/executing/scaffolding-plan.md`](../executing/scaffolding-plan.md) §2 Phase 2
**Scope**: All Alpha routes exist; the Workbench layout renders six visibly-distinct empty regions in the canonical grid; a small-screen blocker covers viewports below the desktop threshold.

---

## 1. What landed

A walkable shell of the entire Alpha app. Every route resolves; every region of the Workbench is structurally present and individually importable. No real product behavior — just the layout skeleton every later phase plugs features into.

### File inventory (new files)

| File | Purpose |
|---|---|
| `src/lib/components/SmallScreenBlocker.svelte` | Full-screen blocker for viewports < 1024px (see §2.4) |
| `src/lib/components/workbench/Workbench.svelte` | Composes the six regions into the canonical five-region grid |
| `src/lib/components/workbench/TopBar.svelte` | Region stub — wordmark, sketch title placeholder, ⌘K hint, avatar slot |
| `src/lib/components/workbench/JournalPanel.svelte` | Region stub — left rail with empty-state copy and disabled "+ New sketch" button |
| `src/lib/components/workbench/Stage.svelte` | Region stub — center surface with 2D/3D toggle indicators and "silent" placeholder |
| `src/lib/components/workbench/ChaosPanel.svelte` | Region stub — right rail with six placeholder axis sliders and disabled Mutate button |
| `src/lib/components/workbench/InstrumentPanel.svelte` | Region stub — bottom strip with voice readout, four macro placeholders, three FX slots |
| `src/lib/components/workbench/TransportBar.svelte` | Region stub — footer with REC/play/stop, BPM display, Keep · Mutate · Discard trio |
| `src/routes/sketch/[id]/+page.svelte` | Renders the Workbench for a sketch-specific deep link (stub — no hydration yet) |
| `src/routes/memory/+page.svelte` | Stub page; the real surface ships as a modal-over-Workbench later |
| `src/routes/settings/+page.svelte` | Stub page; full sections per `frontend-overview.md` §6.2 come later |
| `src/routes/auth/login/+page.svelte` | Visual stub of the magic-link form (inputs disabled) |
| `src/routes/auth/callback/+server.ts` | Placeholder GET handler that 303s back to `/` until Phase 5 swaps in the real Supabase exchange |

### Files updated

| File | Change |
|---|---|
| `src/app.css` | Added a small `@theme {}` block with the initial `--color-ink-*` (warm-black → parchment) and `--color-accent-*` (copper) palette, plus a base `html, body` rule so the app paints dark before any component mounts |
| `src/routes/+layout.svelte` | Mounts `<SmallScreenBlocker />` globally so it covers every route (auth/login included) |
| `src/routes/+page.svelte` | Replaced the Phase 1 placeholder with `<Workbench />` |

### Verified by

All four DoD commands run clean on the updated tree:

```
pnpm lint     →  All matched files use Prettier code style!   (eslint: 0 problems)
pnpm check    →  319 FILES 0 ERRORS 0 WARNINGS
pnpm test     →  1 passed (1)   (smoke test unchanged)
pnpm build    →  ✓ built in 1.10s
pnpm dev      →  VITE v7.3.3 ready in 413 ms
```

Live-route probe of every new path:

```
GET /              → 200
GET /sketch/abc    → 200
GET /memory        → 200
GET /settings      → 200
GET /auth/login    → 200
GET /auth/callback → 303 → /        (placeholder redirect, as designed)
```

The expected adapter-auto "Could not detect a supported production environment" warning is still present — `@sveltejs/adapter-vercel` swap is Phase 9.

---

## 2. Notable decisions & why

### 2.1 The canonical grid uses inline `grid-template-rows`/`columns`, not Tailwind utility classes

**What**: `Workbench.svelte` sets `grid-template-rows: 48px minmax(0, 1fr) 220px 64px` and `grid-template-columns: 280px minmax(0, 1fr) 320px` via an inline `style` attribute, while the named grid placements (`col-span-3`, `col-start-2`, `row-start-3`) stay as Tailwind classes.

**Why**: Tailwind's arbitrary-value syntax for grid templates (`grid-rows-[48px_minmax(0,1fr)_220px_64px]`) is technically possible but unreadable at this length, and it ships the unusual proportions through the JIT for no real benefit. Inline `style` makes the canonical layout numbers literally visible in one line, which is the documented contract from `frontend-overview.md` §3 (`TopBar ~48px`, `Journal ~280px`, etc.). When wireframing surfaces real numbers later, swapping them in is a one-line edit. **The named grid-cell placements remain Tailwind classes** because that's what styles them all the same way and benefits from class sorting.

**Trade-off**: Inline `style` doesn't go through the design-token layer. Acceptable — these specific numbers are *layout structure*, not theme. If they become tokens later (`--workbench-journal-width`), they can move into `@theme {}` and be referenced from the inline style.

### 2.2 `min-h-0` on every row-2 grid cell

**What**: Each of the Journal/Stage/Chaos wrapper divs has `min-h-0`.

**Why**: CSS Grid items default to `min-height: auto`, which means a flex child that *wants* to grow taller than the row (a long sketch list, for example) will silently push the grid row larger and break the fixed Instrument/Transport footer alignment. `min-h-0` opts each cell out of that intrinsic minimum, so `overflow-y-auto` inside the panels actually clips and scrolls instead of bleeding. This is the kind of bug that's invisible until you have real content — easier to inoculate up front than retrofit.

### 2.3 No `$props()` call in propless region stubs

**What**: The six region components and `Workbench.svelte` have no `<script>` block at all (or have one only for `import`s and local constants). They do not call `$props()`.

**Why**: My first pass used `let {}: Record<string, never> = $props()` as a "future-proof" placeholder, but ESLint's `no-empty-pattern` rule rejected it — and correctly so, since an empty destructure discards the right-hand value. In Svelte 5, calling `$props()` is only required when you actually consume props. Stubs that don't take props yet should simply omit the call; future PRs add `$props()` back the moment the first real prop appears. The cost of "more diff later" is much smaller than seven lint errors that silently encourage developers to disable a useful rule.

### 2.4 SmallScreenBlocker uses `matchMedia`, not a resize listener

**What**: The blocker subscribes to `window.matchMedia('(min-width: 1024px)')` and toggles on the `change` event.

**Why**: `matchMedia` fires *once per threshold crossing*, not on every pixel of a resize drag. For a binary blocker that only cares "are we above 1024px or below," it's the right primitive. A `resize` listener would fire dozens of times during a drag and force us to debounce; `matchMedia` already gives us the debounced signal for free. The cleanup function in `$effect` removes the listener correctly even with Svelte 5's effect-tracking model — the returned function runs on teardown, same as a `useEffect` cleanup in React.

### 2.5 The blocker is mounted in `+layout.svelte`, not per route

**What**: One `<SmallScreenBlocker />` in the root layout, no per-route copies.

**Why**: Every route in Alpha should be desktop-only — including `/auth/login` (a user could open a magic-link URL on a phone) and `/settings` (no reason to make that one less protected). Mounting once at the layout level guarantees uniform coverage and avoids the "one route forgot to add the blocker" failure mode. The blocker is `position: fixed; inset: 0; z-index: 50`, which puts it above any route content without affecting layout flow when it's not displayed.

### 2.6 `/auth/callback` returns a real 303 redirect, not a `console.log` placeholder

**What**: The placeholder server endpoint throws `redirect(303, '/')` instead of returning some empty 200.

**Why**: A redirect is the *correct* placeholder behavior — Phase 5 will replace the body of this handler with the real Supabase code exchange, which itself ends in a redirect. If a contributor (or a CI smoke test) hits `/auth/callback` during Phase 2–4, they end up somewhere sensible (the Workbench) rather than on a blank page. The 303 status code is what SvelteKit's `redirect()` uses by default for non-form GETs and is the safer choice for "POST/GET-and-redirect-after" semantics.

### 2.7 Initial design tokens scoped narrowly — full system deferred to Phase 3

**What**: `app.css` gained a `@theme {}` block with `--color-ink-*` and `--color-accent-*` but nothing else (no spacing, radii, type scale, motion durations, etc.).

**Why**: The scaffolding plan splits this work explicitly — Phase 2's final task is "establish initial design tokens" and Phase 3 is the full "design token & primitive layer." If we shipped the entire system here, Phase 3 would have nothing left. The minimum-viable token set Phase 2 needs is the one that lets the six region stubs *look visibly distinct from each other* — that means a small neutral ramp and one accent. Everything else lands when primitives need it. The `--color-accent-*` token is technically only used in `hover:border-accent-500` on two disabled buttons — almost ornamental for now, but it pins down "we are an instrument-warm copper, not a SaaS blue" before any later PR drifts.

### 2.8 The two routes that should be the Workbench *are* the Workbench

**What**: Both `/` and `/sketch/[id]` render `<Workbench />` with no wrapper differences.

**Why**: `frontend-overview.md` §2 is explicit — both routes show the same console; the difference is which sketch is loaded into the shared stores. With no sketch hydration yet (Phase 4 + 7), the two routes literally look identical, and that's correct. The route param `id` is unused for now and unnamed in the component; Phase 4 will introduce a `+page.ts` load function that reads `params.id` and hydrates the sketch store, at which point both routes diverge only by *which sketch is current*, not by *which UI renders*.

---

## 3. What I deliberately did NOT do (from the plan's Phase 2 list)

| Item | Status | Reason |
|---|---|---|
| Full `@theme {}` token system (spacing, radii, type, motion) | Deferred to Phase 3 | Phase 3 is literally "Design Token & Primitive Layer." Shipping it here would leave Phase 3 with nothing. |
| Primitive components (`Button`, `Slider`, `Panel`, …) | Deferred to Phase 3 | Same — Phase 3's whole point. Region stubs currently use raw `<button>` / `<input>` because they're disabled placeholders; Phase 3 will lift them into primitives at the same time the primitives are introduced. |
| Icon library | Deferred to Phase 3 | The plan groups icons with primitives. No icons in Phase 2 region stubs except inline unicode (`▶`, `■`, `●`) which is throwaway anyway. |
| Real responsive collapse handles on Journal/Chaos | Deferred to a later UX phase | `frontend-overview.md` mentions them but the scaffolding plan doesn't require them in Phase 2. |
| `ARCHITECTURE.md` documenting the grid | Deferred to Phase 10 | Plan §Phase 10 owns developer docs. Adding now means rewriting as later phases land. The grid is fully documented in `frontend-overview.md` §3 and in a comment inside `Workbench.svelte`, which is enough for now. |

---

## 4. Open questions / surfaced for user

1. **Grid proportions**: I used the exact starting numbers from `frontend-overview.md` §3 (`280 / flex / 320`, `48 / flex / 220 / 64`). These are documented as "starting points." Once wireframes happen, these will move — that's expected. Nothing to decide now.
2. **Region stub content**: Each stub has just enough placeholder content to make the layout legible (axis labels, macro labels, transport buttons). If you'd rather the regions be even blanker (truly empty boxes), it's a one-line edit per file. Current choice trades a little visual noise for a much more useful "is the layout correct" review surface.
3. **Color naming**: I used `ink-*` rather than `neutral-*` to distinguish the project palette from Tailwind's default `neutral-*` (which is colder, blue-tinted) and to signal these aren't generic grayscale — they're the *Chaos Tone* warm-neutral ramp. Easy to rename later; flagged in case you'd prefer a different convention.
4. **Auth callback redirect target**: The placeholder bounces to `/`. Phase 5 may want it to bounce to a "thanks, signing you in…" intermediate, but for now `/` is the right destination (the Workbench is also the post-login landing per `frontend-overview.md` §6.3).

---

## 5. How to verify locally

```sh
pnpm install
pnpm dev
# Visit each route and confirm:
#   /                → Workbench, six regions visible, no console errors
#   /sketch/abc      → Workbench, identical to /
#   /memory          → "Memory · view coming in a later phase."
#   /settings        → "Settings · …land in later phases."
#   /auth/login      → disabled magic-link form
#   /auth/callback   → 303 redirect to /

# Then resize the browser window narrower than 1024px (or open devtools and
# emulate iPhone). The SmallScreenBlocker should cover the viewport with
# "Desktop only for now." Resize wider and it disappears.
```

Manual visual verification was **not** done by the implementing agent — the harness can't render a browser. The route probes above confirm every route returns the right HTTP status; `pnpm check` confirms type correctness; `pnpm lint` confirms style. The user should visually inspect the grid proportions and the blocker once before considering Phase 2 closed.

---

## 6. What this unblocks

- **Phase 3** (Design Tokens & Primitives) can now lift the placeholder buttons/inputs in the region stubs into proper `Button`, `IconButton`, `Slider`, and `Panel` primitives without restructuring the layout.
- **Phase 4** (Supabase) can add `+page.server.ts` files to the existing routes — the file structure is in place.
- **Phase 5** (Auth) replaces the body of `auth/callback/+server.ts` and wires up `auth/login/+page.svelte`'s form; no new files needed.
- **Phase 6** (Audio Proof-of-Life) drops the test-tone button into the existing `TransportBar.svelte`.
- **Phase 7** (`createParamStore`) wires a knob in `InstrumentPanel.svelte` and a readout in `Stage.svelte`. Both files exist.
- **Phase 8** (Threlte) dynamically imports a `Stage3D` component into the existing `Stage.svelte` 3D toggle.

The five-region layout is the spine every subsequent phase clips features onto. Phase 2 was the last phase that touches *structure*; Phases 3+ touch *content*.
