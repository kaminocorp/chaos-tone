# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

Chaos Tone is a SvelteKit-based "trainable offline music sketchbook." The repo is **v0.1 scaffolding** following a 10-phase plan in [`docs/executing/scaffolding-plan.md`](./docs/executing/scaffolding-plan.md). **Phases 1–3, 6, and 7 have landed** (tooling foundation, routing & layout shell, design tokens & UI primitives, audio proof-of-life, and the `createParamStore` state foundation — see `docs/completions/` and `docs/changelog.md`). **The stateless v1 critical path (1 → 2 → 3 → 6 → 7) is complete**: one end-to-end binding runs (Knob in the Instrument panel → `frequencyStore` → Tone.js `frequency` signal + Stage readout), proving the "stores are the contract" pattern. Still no real product features: no voices/presets, no Threlte (Phase 8), no CI/deploy (Phase 9), no consolidated `ARCHITECTURE.md` (Phase 10). The param pattern recipe lives in the header of `src/lib/stores/create-param-store.svelte.ts`.

**Stateless v1 (decided 2026-06-10).** v1 ships with **no backend, no accounts, and no persistence** — it is **truly ephemeral** (a refresh is a blank slate; no IndexedDB/localStorage/cloud). The entire **Supabase + auth track (Phases 4 & 5) is deferred**; do not add `@supabase/supabase-js`, a `src/lib/db/` client, auth gating, or persistence without explicit direction. The `/auth/*` route stubs stay **dormant** (kept, unused). The v1 critical path is **Phase 1 → 2 → 3 → 6 → 7** (audio → param-store), with Phase 8 (3D) parallel and Phases 9–10 closing out. See the "Stateless v1" amendment at the top of the scaffolding plan for the full consequence list. The "sketch = snapshot the stores" idea still holds _in memory_ for a session; it just isn't written anywhere yet.

When asked to "add a feature," first check whether the relevant phase has landed. If it hasn't, the work probably belongs to that phase's plan, not a one-off addition. See `docs/completions/` for what's actually shipped.

## Commands

```sh
pnpm dev          # vite dev — serves at http://localhost:5173
pnpm build        # vite build (currently uses adapter-auto)
pnpm preview      # preview built output
pnpm check        # svelte-kit sync && svelte-check (typecheck)
pnpm check:watch  # same, in watch mode
pnpm lint         # prettier --check . && eslint .
pnpm format       # prettier --write . (NOTE: docs/ is intentionally excluded)
pnpm test         # vitest run
pnpm test:watch   # vitest in watch mode
```

Run a single test file: `pnpm test src/lib/smoke.test.ts`
Run tests matching a name: `pnpm test -t 'partial name'`

Vitest picks up `src/**/*.{test,spec}.{js,ts}` (see `vite.config.ts`).

## Environment requirements

- **Node**: 22 LTS pinned in `.nvmrc`. `engine-strict=false` in `.npmrc` lets installs proceed on mismatched Node versions, but Node 23 sits in a literal gap in upstream `engines.node` ranges and will warn. Use `nvm use` to switch.
- **pnpm**: 10.28.2 (pinned via `packageManager`). pnpm 10 disables postinstall scripts by default; `package.json` `pnpm.onlyBuiltDependencies` allowlists `esbuild` because Vite needs its native binary. Adding a package that needs a postinstall (e.g. native audio bindings later) requires adding it to this list.

## Architecture

### Stack

- **Framework**: SvelteKit (latest stable) + **Svelte 5 with runes mode** (`runes: true` in `svelte.config.js`). Use `$state`, `$derived`, `$effect`, `$props` — not legacy reactive statements or `export let`.
- **Styling**: **Tailwind CSS 4, CSS-first** via `@tailwindcss/vite`. There is intentionally **no `tailwind.config.ts`** — theme tokens, plugins, and content globs live in `src/app.css` (currently just `@import 'tailwindcss';`). Phase 3 will add `@theme { … }` design tokens here.
- **TypeScript**: strict, with `noUncheckedIndexedAccess: true` on top of the SvelteKit defaults. Treat array/object index access as `T | undefined`.
- **Testing**: Vitest only (no Playwright yet; deferred to v0.2).

### Path aliases (declared in `svelte.config.js`)

- `$lib` → `src/lib` (SvelteKit default)
- `$features` → `src/lib/features` (folder not yet created)
- `$stores` → `src/lib/stores` (folder not yet created)

Aliases flow into TypeScript via the generated `.svelte-kit/tsconfig.json`. Do not duplicate them in `tsconfig.json` `paths`.

### Planned source layout (per scaffolding plan §3)

```
src/
  routes/                 # SvelteKit routes only
  lib/
    components/
      ui/                 # Primitives (Button, Slider, Panel, …)
      workbench/          # Region components (TopBar, JournalPanel, …)
    stores/               # createParamStore + per-feature stores
    audio/                # Tone.js setup, voices, analyzers
    db/                   # Supabase client + generated types
    threed/               # Threlte components (lazy-loaded)
    utils/
    config/
```

### Load-bearing architectural ideas

These are documented in [`docs/executing/frontend-overview.md`](./docs/executing/frontend-overview.md) and `alpha-tech-stack.md`. They shape future PRs even though most aren't implemented yet:

1. **The Workbench is the app.** One five-region layout (TopBar / Journal / Stage / Chaos / Instrument / Transport) handles ~95% of user time. Other routes (`/memory`, `/settings`, `/auth/*`) are auxiliary. Don't introduce a "home page" or dashboard.
2. **Stores are the contract.** Every parameter has exactly one source of truth — a Svelte rune store. The same store is read by 2D UI controls, written by Tone.js param bindings, and rendered by Threlte 3D objects. There is no "sync UI to audio" code path; bindings are declarative. The `createParamStore` helper (Phase 7) is the canonical pattern.
3. **The sketch is the atomic unit.** Saving = snapshotting the relevant stores. Loading = applying the snapshot back to those stores (with ramping for audio-rate params to avoid clicks).
4. **Threlte must be lazy-loaded.** Any route containing a `<Canvas>` is dynamically imported. The 2D Stage works on its own; 3D is a delight layer that should not be in the initial bundle.
5. **Tone.js requires a user gesture.** `Tone.start()` only runs in response to a click/keypress. Never start the audio context on page load.

### Aesthetic guardrails (per `frontend-overview.md` §9)

- Dark, "instrument" feel — not modern SaaS dashboards, not Web3 neon.
- Motion is **reactive, not idle** — visuals respond to audio analyzers or user input. Avoid ambient animations.
- Desktop-only for Alpha; viewports < 1024px show a blocker, not a degraded responsive layout.

## Tooling quirks worth knowing

- **`prettier-plugin-tailwindcss` ≥ 0.8.0 is required.** 0.6.x throws `TypeError: getVisitorKeys is not a function` on `.svelte` files in Tailwind 4 setups.
- **`docs/` is in `.prettierignore`.** The docs in this repo are user-authored prose; do not reformat them. If you write a new doc, place it in `docs/` and write it the way the author would.
- **`.claude/` is also in `.prettierignore`.** Local agent settings shouldn't churn from formatter runs.
- **ESLint flat config** (`eslint.config.js`) needs the `svelteConfig` injection into the `*.svelte` parser block — without it, `$state` and friends get flagged as undefined globals.
- **Adapter is currently `adapter-auto`**, which prints a "Could not detect a supported production environment" warning on build. Expected for Phase 1; Phase 9 swaps in `@sveltejs/adapter-vercel`.
- **Generated files**: `.svelte-kit/` and `src/lib/db/types.ts` (the latter not yet generated). Both are ignored by prettier.

## Working with the planning docs

`docs/` contains the source-of-truth narrative for this project. Before making non-trivial changes, skim:

- [`docs/vision.md`](./docs/vision.md) — product north star.
- [`docs/alpha-tech-stack.md`](./docs/alpha-tech-stack.md) — stack decisions for the first internet-required release.
- [`docs/executing/scaffolding-plan.md`](./docs/executing/scaffolding-plan.md) — the 10-phase plan and what each phase opens up.
- [`docs/executing/frontend-overview.md`](./docs/executing/frontend-overview.md) — region-by-region UI spec.
- [`docs/completions/`](./docs/completions/) — what has actually shipped, with the why-not-just-the-what.
- [`docs/changelog.md`](./docs/changelog.md) — running condensed record.

When a phase is completed, follow the pattern in `docs/completions/phase-1-completion.md` (file inventory, notable decisions with reasoning, what was deliberately skipped, what it unblocks) rather than just stating "done."
