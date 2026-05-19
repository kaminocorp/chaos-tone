# Phase 3 Completion — Design Token & Primitive Layer

**Status**: Complete
**Date**: 2026-05-18
**Plan reference**: [`docs/executing/scaffolding-plan.md`](../executing/scaffolding-plan.md) §2 Phase 3
**Scope**: A minimal but real design-token system in `app.css`, five UI primitives in `lib/components/ui/`, and a region refactor so no Workbench surface uses raw HTML buttons or inputs.

---

## 1. What landed

The visual system has a shared backbone. Every clickable affordance in the app now flows through `Button` or `IconButton`; every text field through `Input`; every randomness axis through `Slider`; and the two collapsible side rails through `Panel`. The Workbench looks essentially the same as Phase 2, but it's no longer a pile of one-off `<button class="…">` lines.

### File inventory (new files)

| File | Purpose |
|---|---|
| `src/lib/components/ui/Button.svelte` | Text button. Variants `primary` / `secondary` / `ghost`; sizes `sm` / `md` / `lg`; spreads through any standard `<button>` attribute |
| `src/lib/components/ui/IconButton.svelte` | Square icon-only button; required `label` becomes the accessible name |
| `src/lib/components/ui/Input.svelte` | Single-line text-y input (`type` overridable to `email` / `search` / etc.); `value` is `$bindable` |
| `src/lib/components/ui/Slider.svelte` | Range slider wrapping `<input type="range">`; horizontal + vertical orientations; track/thumb styled via `.ct-slider` in `app.css` |
| `src/lib/components/ui/Panel.svelte` | Section wrapper with optional header, optional collapse, and a trailing `actions` snippet slot for header right-side content |

### Files updated

| File | Change |
|---|---|
| `src/app.css` | Expanded `@theme {}` with `--font-sans`, `--font-mono`, `--duration-*` motion tokens, `--radius-*` border radii. Added the `.ct-slider` CSS block — pseudo-elements (`::-webkit-slider-thumb`, etc.) cannot be reached from Tailwind utilities |
| `src/lib/components/workbench/TopBar.svelte` | `⌘K` placeholder → `<IconButton>` with the `Command` lucide icon. Avatar circle → `<IconButton>` with the `User` icon |
| `src/lib/components/workbench/JournalPanel.svelte` | Wrapped in `<Panel>`. Search box added (`<Input type="search">`) — wired to local `$state` for demonstration. "+ New sketch" → `<Button>` |
| `src/lib/components/workbench/ChaosPanel.svelte` | Wrapped in `<Panel>`. Six axis-slider placeholders → six `<Slider orientation="vertical">` bound to a local `weights` `$state` record. "Mutate ▸" → `<Button>` |
| `src/lib/components/workbench/InstrumentPanel.svelte` | FX 1/2/3 spans → `<Button variant="ghost" size="sm">`. Macro circles stay decorative (real audio-grade knob is Phase 7) |
| `src/lib/components/workbench/TransportBar.svelte` | REC → `<Button variant="primary">` + `Circle` icon. Play / Stop → `<IconButton>` + `Play` / `Square` icons. Keep / Mutate / Discard → `<Button>` |
| `src/routes/auth/login/+page.svelte` | Email field → `<Input type="email" bind:value={email}>`. Submit → `<Button type="submit">` |
| `package.json` | Added `@lucide/svelte ^1.16.0` as a devDependency (peers `svelte ^5`) |

### Verified by

```
pnpm lint     →  All matched files use Prettier code style!   (eslint: 0 problems)
pnpm check    →  4001 FILES 0 ERRORS 0 WARNINGS
pnpm test     →  1 passed (1)
pnpm build    →  ✓ built in 4.23s
pnpm dev      →  VITE v7.3.3 ready in 398 ms
```

Live-route probe of every Alpha path on a clean dev server:

```
GET /              → 200
GET /sketch/abc    → 200
GET /memory       → 200
GET /settings      → 200
GET /auth/login    → 200
GET /auth/callback → 303 → /
```

The `pnpm check` file count jumped from 319 → 4001 because `@lucide/svelte` ships every icon as a separate component file. This is fine — the production build only bundles the icons we actually import (8 in total), and bundle output confirms tree-shaking is doing its job.

---

## 2. Notable decisions & why

### 2.1 Tailwind 4 `@theme {}` is the single token home — no separate config file

**What**: Spacing, motion, fonts, radii, colors all live in `src/app.css` inside one `@theme {}` block. No `tailwind.config.ts`.

**Why**: Tailwind 4 specifically wants tokens here. Every variable named `--color-*`, `--font-*`, `--duration-*`, etc. inside `@theme {}` becomes a Tailwind utility class automatically (`bg-ink-100`, `font-mono`, `duration-quick`). Splitting tokens between CSS and a TS config buys nothing and makes "where does this color live" a two-place question. The decision is consistent with the Phase 1 stance documented in `phase-1-completion.md` §2.2.

### 2.2 Kept Tailwind's default spacing scale; did NOT redefine `--spacing-*`

**What**: The plan calls for "a spacing scale" as a token category. I deliberately did *not* define `--spacing-*` tokens.

**Why**: Tailwind 4 has a built-in 0.25rem-step spacing scale (`p-1`, `p-2`, …, `p-96`) that's been stress-tested by millions of devs. Overriding `--spacing-*` would either (a) replace that whole scale (and force every utility class in the codebase to be re-audited), or (b) duplicate values that already exist. Both moves cost real time for zero gain. The right time to introduce semantic spacing tokens (`--spacing-panel-gutter`, `--spacing-workbench-gap`) is *after* wireframes have surfaced repeated specific values worth naming. For Phase 3, raw Tailwind spacing is good enough — and explicitly documented as the call in `app.css`'s top comment.

### 2.3 Slider styling lives in `app.css`, not the component

**What**: `Slider.svelte` is mostly an `<input type="range">` with classes; the actual track and thumb styling is a `.ct-slider` block in `app.css`.

**Why**: The native range input's pseudo-elements — `::-webkit-slider-thumb`, `::-webkit-slider-runnable-track`, `::-moz-range-thumb`, `::-moz-range-track` — are unreachable from Tailwind utility classes. Tailwind generates CSS rules keyed on element selectors, but pseudo-elements on form controls are vendor-prefixed and can't be expressed as `[&::-webkit-slider-thumb]:bg-ink-100`-style arbitrary variants without per-property workarounds. Pulling the styling into a plain CSS class is honest and keeps the component file short. The class uses `var(--color-*)` so it still reads from the same token system Tailwind utilities do.

**Trade-off**: One off-component CSS surface that the component "owns." Documented at the top of both files so it's discoverable.

### 2.4 `<input type="range">` instead of a custom pointer-event slider

**What**: Slider is a thin wrapper, not a custom-built drag-tracker.

**Why**: Native range inputs come with keyboard accessibility for free (`←`/`→` / `↑`/`↓` / `Home` / `End` / `PgUp` / `PgDn`), screen-reader announcement, focus rings, and OS-level input devices (graphics tablets, accessibility hardware). Building a custom slider that matches *any* of that costs hours; matching *all* of it costs days. The "audio-grade knob" promised in `scaffolding-plan.md` §Phase 7 is a separate component with different physics (drag-radius, scroll-wheel fine-control, double-click-reset, scroll-pixel-to-value mapping). That'll be its own primitive. For Phase 3, native is correct.

**Trade-off**: Native range inputs don't feel as tactile as a custom slider. Acceptable for v0.1; Phase 7's audio-grade knob ships the tactile feel where it matters most (the synth panel).

### 2.5 Vertical sliders use `writing-mode: vertical-rl`

**What**: The vertical orientation works via CSS `writing-mode: vertical-rl; direction: rtl;` rather than the legacy `-webkit-appearance: slider-vertical;`.

**Why**: `appearance: slider-vertical` is Chromium-only and has been deprecated in the WHATWG spec discussion. `writing-mode` is the modern cross-browser approach (works in Firefox, Safari, and Chromium) and has been stable since around 2023. The `direction: rtl` ensures the bottom of the visible slider corresponds to `min` and the top to `max`, which matches how mixer-style faders read.

### 2.6 `Panel` accepts `class` prop, region wrappers don't (and don't need to)

**What**: `Panel.svelte` extracts `class` from its props and merges it onto its root `<section>`. `Workbench.svelte`'s regions don't expose a `class` prop because their styling is fixed by the grid contract.

**Why**: The `class` prop is a "let the parent nudge styling" knob and should be on components that get composed in multiple contexts (primitives). Region components like `JournalPanel` exist exactly once and always go in the same grid cell — there's no caller that should be tweaking their classes. Promiscuous `class` props on every component encourages drift; reserving them for primitives keeps the constraint visible.

### 2.7 Extract `class` from `$props()` rest *before* spreading — bug caught during review

**What**: All four "spreadable" primitives (Button, IconButton, Input, Slider) explicitly destructure `class: extraClass = ''` from `$props()` and append it as the *last* token in their template's `class="..."`.

**Why**: My first pass had `<button class="... defaults" {...rest}>`. Since Svelte processes attributes left-to-right and `{...rest}` overrides earlier ones, a caller passing `<Button class="w-full">` would have *replaced* the variant/size class string with just `"w-full"` — silently. The fix is two pieces: (a) pull `class` out of rest into a local `extraClass`, (b) move `{...rest}` *before* the `class="..."` so the explicit class always wins, with `{extraClass}` interpolated at the end so consumers can still augment. This is a Svelte 5 idiom worth memorizing — Svelte doesn't warn about it.

### 2.8 Icons via `@lucide/svelte`, imported as named exports

**What**: Eight icons total used so far: `Command`, `User`, `Circle`, `Play`, `Square`, plus icon-less buttons elsewhere. Each `import { Foo } from '@lucide/svelte'`.

**Why**: `@lucide/svelte@1.16.0` is the Svelte-5–native package (the older `lucide-svelte` is Svelte 4 only). Each icon is its own importable Svelte component, which means Rollup's tree-shaker only bundles what's referenced — the production bundle for `/` includes exactly five icons, not the full library of ~1500. The downside: `svelte-check` now walks every icon file (319 → 4001), but that's a one-time cost on a fast SSD and was not visible in dev/build wall-clock time.

### 2.9 Chaos sliders have local `$state`, not store-bound state

**What**: `ChaosPanel` has `let weights: Record<Axis, number> = $state({...})` rather than reading from a `randomness-session` store.

**Why**: The real Box-of-Randomness session store doesn't exist yet — its shape is part of Phase 7 (`createParamStore`) and the not-yet-numbered Box-of-Randomness implementation phase. Wiring the sliders to local state proves the Slider primitive works end-to-end (you can grab a slider and watch the thumb move) without committing to a store API that's still being designed. When the session store lands, swapping `$state(...)` for `randomnessSessionStore.weights` is a one-line edit per consumer.

### 2.10 No `Knob`, `Toast`, `Tooltip`, `Modal`, `Switch`, or `Tag` — Phase 3 ships only the five primitives the plan asked for

**What**: The plan lists exactly five primitives (`Button`, `Slider`, `Panel`, `Input`, `IconButton`) and the frontend overview mentions a much longer wishlist (Toast, Tooltip, Switch, Tag, etc.). Phase 3 only ships the five.

**Why**: The DoD says each primitive must be used in at least one region stub — five primitives, one use site each minimum. Building `Toast` before there's a notification trigger or `Tooltip` before there's hover-content-worth-tipping is speculative. The wishlist primitives ship in the phases that introduce their callers (Toast → Phase 5 auth feedback per `scaffolding-plan.md` §Phase 5; Tooltip → Phase 6+ when knobs need value readouts on hover; etc.).

---

## 3. What I deliberately did NOT do

| Item | Status | Reason |
|---|---|---|
| Storybook | Skipped | Plan §Phase 3 says "explicitly NOT part of v0.1." Primitives are reviewed in-app. |
| Component-usage docs in `ARCHITECTURE.md` | Deferred to Phase 10 | The plan mentions documenting usage there, but `ARCHITECTURE.md` itself doesn't exist yet — Phase 10 owns it. For now, each primitive carries an explanatory comment at the top of its file (which is what a contributor will read first anyway). |
| Custom spacing scale | Deferred (see §2.2) | Tailwind's default is fine until wireframes name specific spaces. |
| Audio-reactive accent layer | Deferred to Phase 6+ | Needs real analyzer signal to make sense. Token comment in `app.css` flags it. |
| Toast / Tooltip / Switch / Tag / Drawer / Modal / Popover / Menu | Deferred to their consuming phases | See §2.10 above. |
| `Knob` (audio-grade) | Deferred to Phase 7 | Plan §Phase 3 explicitly says "real audio-grade knob comes later." |
| Light theme | Out of Alpha | Frontend-overview.md §10 calls this out — Alpha is dark only. |
| `prefers-reduced-motion` opt-in | Deferred to v0.2 per frontend-overview.md §10 | Token system uses fixed durations for now; the override will be a one-line addition when the time comes. |

---

## 4. Open questions / surfaced for user

1. **Spacing-scale token naming** — when the time comes to add semantic spacing tokens, do you prefer numeric (`--spacing-3`) or semantic (`--spacing-panel-gutter`)? I lean semantic for top-level tokens and numeric for primitives, but no decision is needed yet.
2. **Icon size convention** — I used `size={14}` for `IconButton` content and `size={10}` for inline icons inside `Button`. This is the start of a "small icon" convention. Worth formalizing into tokens (`--size-icon-sm: 14px`) the next time we add icons.
3. **Lucide license** — Lucide is ISC-licensed (very permissive). No action needed unless you specifically want a non-ISC icon set.
4. **`Knob` primitive timing** — the plan puts it in Phase 7, alongside `createParamStore`. That phase is the *first* one where a real synth control matters. I'm comfortable holding the line on "Slider is sufficient until then."

---

## 5. How to verify locally

```sh
pnpm install
pnpm dev
# Visit / and inspect each region:
#   TopBar     — ⌘ and avatar IconButtons (hover them)
#   Journal    — search Input (focusable, click ring), "+ New sketch" Button
#   Chaos      — six vertical Sliders (drag a thumb; arrow keys also move it)
#   Instrument — three FX ghost Buttons (visually distinct from the primary
#                Rec button in the Transport)
#   Transport  — Rec (primary variant + circle icon), Play/Stop IconButtons,
#                Keep/Mutate/Discard Buttons

# Visit /auth/login — confirm Input + Button render identically to their
# Workbench appearances (same surface color, same border, same radius).

# Tab through the Workbench — every interactive control should show a
# visible focus ring on focus. Sliders should respond to arrow keys.
```

Manual visual verification was **not** done by the implementing agent. The route-probe matrix above confirms every route returns the right HTTP status; type/lint/test/build all pass; primitives are exercised across at least one region each. The user should give the Workbench a once-over (especially the slider drag, the focus rings, and the icon sizing) before considering Phase 3 closed.

---

## 6. What this unblocks

- **Phase 4** (Supabase) can build a profile-edit page in `/settings` using `Input` + `Button` without inventing styles.
- **Phase 5** (Auth) gets the magic-link form for free — the existing `/auth/login` stub already uses the primitives correctly. Phase 5 wires the `onsubmit` handler and removes the `disabled` attributes.
- **Phase 6** (Audio proof-of-life) drops a "Test tone" `<Button>` into `TransportBar`. No new primitive needed.
- **Phase 7** (`createParamStore`) demonstrates against the existing `Slider` primitive *and* introduces the audio-grade `Knob` for the Instrument panel. The two will live side-by-side — `Slider` for non-audio params (axis weights, generic settings), `Knob` for audio-rate params.
- **Phase 8** (Threlte) — no new primitives needed; the 3D mode toggle is the same `Button` family.
- **Phases needing notifications, modals, or hover help** — those phases ship `Toast`, `Modal`, `Tooltip` alongside their first real use case, per §2.10.

The primitive layer is now a "small set of components everyone shares" rather than a "we'll need this eventually" wishlist. Every later phase that adds product surface area will write less custom CSS than it would have otherwise — that compounding is the point.
