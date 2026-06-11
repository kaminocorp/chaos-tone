# Chaos Tone — Scaffolding Implementation Plan (v0.1)

**Status**: Draft for review
**Date**: 2026-05-18
**Scope**: Zero → fully scaffolded skeleton repository (v0.1)
**Related docs**: [vision.md](./vision.md), [alpha-tech-stack.md](./alpha-tech-stack.md), [ui-proposals.md](./ui-proposals.md), [frontend-overview.md](./frontend-overview.md)

---

## Amendment — Stateless v1 (2026-06-10)

**Decision**: v1 ships with **no backend, no accounts, and no persistence**. The entire Supabase/auth track is deferred until after the product proves itself locally. We want to spend the next stretch on the parts that make Chaos Tone *Chaos Tone* — audio, the param-store contract, the Box of Randomness surface — not on platform plumbing.

**What this changes:**

- **Phase 4 (Supabase) and Phase 5 (Auth) are deferred.** They remain documented below as written, for whenever we resume them — but they are *not* on the v1 path.
- **Persistence is truly ephemeral.** A page refresh is a blank slate. No IndexedDB, no localStorage, no cloud. The "sketch is the atomic unit / save = snapshot the stores" idea still holds *in memory* for a session; it just isn't written anywhere yet. The local-cache and offline story from `alpha-tech-stack.md` §9 is a later project.
- **The `/auth/*` routes and the `src/lib/db/` folder stay dormant.** The disabled login/callback stubs from Phase 2 remain in the tree, unused, rather than being deleted — cheap to leave, cheap to revive.
- **Phase 9 (Deploy) loses its Supabase env vars** and no longer gates on auth being testable in a deployed environment.
- **The Workbench is not auth-gated.** `/` opens straight to the console.

The **v1 critical path becomes: Phase 1 → 2 → 3 → 6 → 7**, with Phase 8 (3D) parallelizable after Phase 2 and Phase 9 (deploy) / Phase 10 (docs) closing it out. The sections below are left intact for historical accuracy; where the original v0.1 text assumes a backend, read it through this amendment.

---

## 0. What "v0.1" Means

**v0.1 is the moment a new contributor can clone the repo, run two commands, and see the Workbench shell load in their browser with audio confirmed playable and 3D confirmed renderable — without any real product features yet, and (per the Stateless v1 amendment above) with no backend, accounts, or persistence.**

### v0.1 is IN scope
- SvelteKit project with strict TypeScript, Tailwind 4, ESLint, Prettier, `svelte-check`.
- All Workbench regions present as empty stub components (TopBar, Journal, Stage, Chaos, Instrument, Transport).
- All routes scaffolded (`/`, `/sketch/[id]`, `/memory`, `/settings`, `/auth/*`).
- ~~Supabase project provisioned with initial schema, RLS policies, and generated TypeScript types.~~ **Deferred — stateless v1 (see amendment).**
- ~~Email + magic-link auth working end-to-end with session restoration.~~ **Deferred — stateless v1 (see amendment).**
- A single "play test tone" button that proves the Tone.js pipeline is alive.
- A single placeholder 3D mesh in the Stage proving Threlte is wired up and lazy-loaded.
- Param-store helper (`createParamStore`) demonstrated by *one* end-to-end binding: a knob in the Instrument panel → store → Tone.js param → visual readout.
- CI running lint + typecheck + build on every PR.
- Vercel deployment with preview URLs per branch.
- Developer documentation: `README.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`.

### v0.1 is explicitly OUT of scope
- Any real synthesis voices, presets, or sound design.
- Real journal CRUD (creating, listing, searching sketches).
- The Box of Randomness — no axes, no mutation logic.
- AI features — no transcription, no embeddings, no Edge Functions.
- 3D control surfaces (only one placeholder mesh).
- Memory / learning system.
- Mobile responsiveness — small screens see the blocker message.
- Real keyboard shortcuts beyond the bare minimum.
- Settings UI beyond a stub page.

### Why this line
This boundary exists to **decouple plumbing from product**. Every hour spent building features on broken plumbing is wasted. Once v0.1 lands, every subsequent phase is product work — building synthesis, journal, randomness — without re-touching tooling, auth, deploys, or build config.

---

## 1. Sequencing Rationale

The phases are ordered by **dependency, not by visibility**. We do not start with the most visible work (the Workbench UI) because:

1. **Tooling first**: If lint/format/typecheck aren't strict from commit #1, retrofitting them later is painful.
2. **Routes & layout before primitives**: The shape of the app determines what primitives we need. Building primitives speculatively wastes effort.
3. **Backend before auth**: Auth needs a `users` table and RLS, so Supabase schema comes first.
4. **Audio and 3D "proofs of life" before any product use**: Tone.js and Threlte both have real setup gotchas (AudioContext requires a user gesture; Threlte canvases need lazy-loading discipline). Confirming they work end-to-end on day one removes huge risk.
5. **CI before deployment**: We want red builds to block green deploys.

The **critical path** is: Phase 1 → 2 → 3 → 6 → 7 (per the Stateless v1 amendment — Phases 4 and 5 are deferred). Phase 8 can run in parallel once Phase 2 lands; Phases 9–10 close it out.

---

## 2. Phases

### Phase 1 — Repo & Tooling Foundation
**Goal**: A `pnpm install && pnpm dev` repo that lints, typechecks, and serves a blank SvelteKit page.
**Effort**: S (1–2 days)
**Dependencies**: none

**Tasks**
- Initialize git repo, set up `.gitignore`, `.gitattributes`, `.editorconfig`.
- Initialize SvelteKit (latest stable, Svelte 5 runes mode) via `pnpm create svelte`.
- Configure strict TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`).
- Install and configure Tailwind 4 with a minimal `tailwind.config.ts` + `app.css`.
- Set up ESLint (`eslint-plugin-svelte`, TypeScript ESLint) + Prettier (with `prettier-plugin-svelte` and `prettier-plugin-tailwindcss`).
- Configure `svelte-check` and a `pnpm check` script.
- Create root scripts: `dev`, `build`, `preview`, `lint`, `format`, `check`, `test`.
- Configure `vite.config.ts` with sensible defaults (path aliases: `$lib`, `$features`, `$stores`).
- Set the package manager (`pnpm`) via `packageManager` field; add `engines` for Node version.
- Optional: husky + lint-staged for pre-commit lint/format.

**Definition of Done**
- Fresh clone → `pnpm install` → `pnpm dev` → blank SvelteKit page at `http://localhost:5173`.
- `pnpm lint` and `pnpm check` both pass on the empty project.
- Pre-commit hook (if added) runs lint-staged on staged files.

---

### Phase 2 — Routing & Layout Shell
**Goal**: All Alpha routes exist; the Workbench layout regions render as visible empty stubs.
**Effort**: M (2–3 days)
**Dependencies**: Phase 1

**Tasks**
- Create route tree:
  - `src/routes/+layout.svelte` (global shell)
  - `src/routes/+page.svelte` (the Workbench, renders at `/`)
  - `src/routes/sketch/[id]/+page.svelte` (Workbench loaded with a specific sketch — stub for now)
  - `src/routes/memory/+page.svelte` (stub — text "Memory view")
  - `src/routes/settings/+page.svelte` (stub)
  - `src/routes/auth/login/+page.svelte` (stub)
  - `src/routes/auth/callback/+server.ts` (placeholder)
- Build the Workbench region scaffolding:
  - `lib/components/workbench/Workbench.svelte` — composes the five regions.
  - `lib/components/workbench/TopBar.svelte` — empty bar with title text.
  - `lib/components/workbench/JournalPanel.svelte` — left rail, placeholder list.
  - `lib/components/workbench/Stage.svelte` — center, placeholder text.
  - `lib/components/workbench/ChaosPanel.svelte` — right rail, placeholder sliders.
  - `lib/components/workbench/InstrumentPanel.svelte` — bottom strip, placeholder.
  - `lib/components/workbench/TransportBar.svelte` — footer with stub buttons.
- Apply the canonical layout grid using Tailwind 4 grid utilities. Document the grid in `ARCHITECTURE.md`.
- Add a **small-screen blocker** component that shows when viewport width < threshold (e.g., 1024px), per ui-proposals §8.
- Establish initial design tokens: dark background, neutral text, one accent color. No final visual design yet.

**Definition of Done**
- Visiting `/` shows the full Workbench layout with five visibly-distinct empty regions.
- All five other routes return a stub page (no 404s).
- Viewport narrower than 1024px shows the "desktop-only for now" blocker.
- All region components are independently importable and have empty default props.

---

### Phase 3 — Design Token & Primitive Layer (minimal)
**Goal**: A short list of primitive components that the empty region stubs use, so they don't drift into ad-hoc styles.
**Effort**: S (1–2 days)
**Dependencies**: Phase 2

**Tasks**
- Establish CSS variables (or Tailwind theme extensions) for: colors (background, surface, accent, text), spacing scale, radii, transitions, monospace + humanist font stacks.
- Build the minimal primitive set:
  - `lib/components/ui/Button.svelte`
  - `lib/components/ui/Slider.svelte` (vertical + horizontal variants, but real audio-grade knob comes later)
  - `lib/components/ui/Panel.svelte` (wrapper with header + collapsed/expanded states)
  - `lib/components/ui/Input.svelte`
  - `lib/components/ui/IconButton.svelte`
- Pick and install an icon set (e.g., `lucide-svelte`).
- Document component usage conventions in `ARCHITECTURE.md`.

**Definition of Done**
- Each primitive renders standalone and is used in at least one region stub.
- No region uses raw HTML buttons / inputs — everything goes through the primitives.
- Storybook is **explicitly NOT** part of v0.1; primitives are reviewed in-app.

---

### Phase 4 — Supabase Project & Initial Schema  ⏸️ DEFERRED (stateless v1)
> Not on the v1 path — see the Stateless v1 amendment. Kept as written for when backend work resumes.

**Goal**: A live Supabase project with the v0.1 schema, RLS, and generated TypeScript types committed.
**Effort**: M (2–3 days, including waiting on platform setup)
**Dependencies**: Phase 1

**Tasks**
- Create a Supabase project (dev environment first; staging/prod come later).
- Define the initial migration. Tables:
  - `profiles` (extends `auth.users`): `id`, `display_name`, `created_at`.
  - `sketches`: `id`, `user_id`, `title`, `created_at`, `updated_at`, `metadata jsonb`. (Audio file refs and synth state come in v0.2.)
  - `presets`: `id`, `user_id`, `name`, `parameters jsonb`, `created_at`. (Stub — not used in v0.1 UI.)
  - `randomness_sessions`: `id`, `sketch_id`, `axis_weights jsonb`, `outcome jsonb`, `created_at`. (Stub.)
- Define Row Level Security policies: a user can only see/modify their own rows.
- Enable `pgvector` extension and reserve a stub `embeddings` table (no rows yet).
- Set up Supabase CLI locally, commit `supabase/migrations/*.sql` to the repo.
- Generate TypeScript types via `supabase gen types typescript` into `src/lib/db/types.ts`.
- Install `@supabase/supabase-js` and create `src/lib/db/client.ts` (browser client) and `src/lib/db/server.ts` (server client for SvelteKit).
- Set environment variables in `.env.example` and document in `README.md` and `CONTRIBUTING.md`.

**Definition of Done**
- Migration applies cleanly on a fresh Supabase project from `supabase db reset`.
- Generated types compile without errors.
- A trivial `+page.server.ts` can call `supabase.from('sketches').select()` (returns empty array for authed user).
- RLS verified: unauthenticated requests return zero rows, not an error.

---

### Phase 5 — Authentication Flow  ⏸️ DEFERRED (stateless v1)
> Not on the v1 path — see the Stateless v1 amendment. The `/auth/*` route stubs stay dormant until this resumes.

**Goal**: A user can sign up, log in via magic link, log out, and have their session persist across reloads.
**Effort**: M (2–3 days)
**Dependencies**: Phase 2, Phase 4

**Tasks**
- Implement `auth/login` page with email input → "send magic link" action.
- Implement `auth/callback` server endpoint to handle the redirect and establish the session.
- Implement session handling in `hooks.server.ts` — populate `event.locals.user` from the Supabase session.
- Implement a `+layout.server.ts` that exposes `user` to client routes.
- Protect the Workbench: unauthenticated users are redirected to `/auth/login`.
- Build a minimal user menu in the TopBar (display email + logout button) — wired up but visually minimal.
- Profile row auto-created on first sign-in (via a Postgres trigger or a server-side post-auth hook).
- Add basic toast feedback for "magic link sent", auth errors, etc. — `lib/components/ui/Toast.svelte` if it doesn't exist yet.

**Definition of Done**
- A new user can: enter email → click magic link in email → land on Workbench logged in.
- Reload preserves session.
- Logout returns to login screen.
- A `profiles` row exists for every authenticated user.
- Manual test: opening `/` in a private window without auth redirects to `/auth/login`.

---

### Phase 6 — Audio Proof-of-Life
**Goal**: Click a button, hear a sine wave. The full audio pipeline is confirmed working in the chosen framework.
**Effort**: S (1–2 days)
**Dependencies**: Phase 2

**Tasks**
- Install Tone.js.
- Build `lib/audio/context.ts` — exports `ensureAudioStarted()` that calls `Tone.start()` behind a user gesture (browsers require this).
- Build `lib/audio/test-tone.ts` — exports `playTestTone()` that fires a 200ms sine wave.
- Wire a "test tone" button into the Transport region — temporary, will be replaced. Button text: "Test tone (will be removed)".
- Confirm low-latency context configuration; document `Tone.context.lookAhead` and similar tunables in `ARCHITECTURE.md`.
- Add a basic browser-compatibility check: if Web Audio is missing, show a clear unsupported-browser message.

**Definition of Done**
- Clicking the test tone button produces audible sound.
- Audio context is **not** started on page load — only on first user gesture.
- No console errors related to audio context.
- Works in latest Chrome, Firefox, Safari on macOS.

---

### Phase 7 — State Foundation: `createParamStore`
**Goal**: One end-to-end binding example proves the "stores as the contract" pattern works.
**Effort**: M (2 days)
**Dependencies**: Phase 3, Phase 6

**Tasks**
- Build `lib/stores/createParamStore.ts` — a tiny helper that wraps a Svelte 5 rune state with `min`, `max`, `default`, and a `bindTo(toneParam)` method that syncs the store value to a `Tone.Param` (with optional ramping).
- Build a single end-to-end binding in the Workbench:
  - A `Knob` (or simple Slider) primitive in the Instrument panel controls one parameter (e.g., test tone frequency).
  - The same store is read by a small text readout in the Stage region.
  - The test tone (Phase 6) now reads its frequency from this store, so turning the knob *while it's playing* changes pitch in real time.
- Document the pattern with code comments and a section in `ARCHITECTURE.md`: "How to add a new param".

**Definition of Done**
- Turning the knob updates the readout instantly.
- Holding the test tone and turning the knob produces an audible pitch change.
- The pattern is documented well enough that a contributor could add a second param in under 15 minutes.

---

### Phase 8 — 3D Proof-of-Life (Threlte)
**Goal**: Stage region renders a basic 3D mesh, lazy-loaded, with bundle impact measured.
**Effort**: S–M (1–2 days)
**Dependencies**: Phase 2

**Tasks**
- Install `@threlte/core` and `@threlte/extras`.
- Inside the Stage region, dynamically import a `<Stage3D>` component (only loaded when 3D mode is active).
- Render a single low-poly mesh (a cube or torus) rotating slowly.
- Add a Stage mode toggle (2D / 3D) — defaults to 2D. The 3D mode is the only thing that loads the Threlte bundle.
- Confirm the initial route bundle does NOT include `three.js` when the user is in 2D mode (via `vite-bundle-visualizer` or similar).
- Document the lazy-loading discipline in `ARCHITECTURE.md`: "Any route containing a Threlte `<Canvas>` must be lazy-loaded."

**Definition of Done**
- Toggling Stage to 3D shows a rotating mesh.
- Initial JS bundle on `/` (with Stage in 2D mode) does **not** include `three.js`.
- No console errors on toggle.

---

### Phase 9 — CI/CD & Deployment
**Goal**: Every PR runs lint + typecheck + build in CI; every push to `main` deploys to Vercel; every PR gets a preview URL.
**Effort**: S (1 day)
**Dependencies**: Phase 1 (stateless v1 — the former auth/Phase 5 coupling no longer applies)

**Tasks**
- Connect the GitHub repo to Vercel; configure SvelteKit adapter (`@sveltejs/adapter-vercel`).
- ~~Configure Vercel environment variables (Supabase URL, anon key) for production + preview.~~ Deferred — stateless v1 needs no server env vars yet.
- Add `.github/workflows/ci.yml`:
  - On `pull_request`: install, lint, typecheck, build.
  - On `push` to `main`: same, plus a deploy hook (or rely on Vercel's GitHub integration).
- Add a "preview deploy" comment bot (Vercel does this automatically).
- (Optional, can defer to v0.2) Set up Sentry for error tracking.
- Document the deployment story in `CONTRIBUTING.md`.

**Definition of Done**
- Opening a PR triggers CI; failing lint blocks merge.
- Merging to `main` deploys to production within ~5 minutes.
- Each PR gets a unique preview URL. ~~(with its own Supabase preview branch / shared dev project)~~ — N/A for stateless v1.

---

### Phase 10 — Developer Documentation & Ergonomics
**Goal**: A new contributor can be productive within an hour.
**Effort**: S (1 day, ongoing)
**Dependencies**: Phases 1–9 (mostly)

**Tasks**
- `README.md`:
  - One-paragraph project description.
  - Prerequisites (Node version, pnpm).
  - Quickstart (clone, install, copy env, run dev).
  - Links to vision/tech-stack/ui/frontend docs.
- `ARCHITECTURE.md`:
  - Directory structure with rationale.
  - The "stores as the contract" pattern with the Phase 7 example.
  - Tone.js lifecycle and AudioContext rules.
  - Threlte lazy-loading rule.
  - Supabase migration workflow.
  - Region/component conventions.
- `CONTRIBUTING.md`:
  - Branch naming, PR conventions.
  - How to run local Supabase.
  - How to run migrations.
  - How to debug audio/3D issues.
- `.env.example` populated with every env var the app needs, with comments.
- (Optional) `docs/runbook.md` — how to roll back a bad deploy, how to reset the dev Supabase.

**Definition of Done**
- A teammate who hasn't seen the repo can follow the README and reach a running local dev within 30 minutes.
- `ARCHITECTURE.md` is referenced from at least three other places (README, CONTRIBUTING, in-code comments).

---

## 3. Cross-Phase Concerns

These thread through multiple phases — not their own phase, but worth calling out:

### Type safety from day one
Strict TypeScript everywhere. `any` is grep-able and should be rare. Supabase types are generated and committed.

### Environment variables
Every env var documented in `.env.example` with a comment. `.env*` (other than `.env.example`) gitignored. Use SvelteKit's `$env/static/private` and `$env/static/public` discipline.

### Folder structure (proposed)
```
src/
  routes/                 # SvelteKit routes only
  lib/
    components/
      ui/                 # Primitives (Button, Slider, Panel, ...)
      workbench/          # Region components (TopBar, JournalPanel, ...)
    stores/               # createParamStore + per-feature stores
    audio/                # Tone.js setup, voices (later), analyzers
    db/                   # Supabase client + types
    threed/               # Threlte components (lazy-loaded)
    utils/                # Small helpers
    config/               # App-wide constants
```

### Naming conventions
- Files: kebab-case for non-components (`create-param-store.ts`), PascalCase for Svelte components (`JournalPanel.svelte`).
- Stores: `xxxStore` for module-scoped, `createXxxStore()` for factories.
- Routes: SvelteKit defaults.

### Testing strategy in v0.1
- Vitest set up with one trivial passing test to prove the harness works.
- No real test coverage demanded at v0.1; coverage targets come in v0.2 alongside the first real features.
- E2E (Playwright) deferred to v0.2.

---

## 4. Acceptance Criteria for v0.1

The release is **v0.1** when *all* of the following are true:

1. Fresh clone + 30-minute setup yields a running app for any contributor.
2. CI is green on `main`.
3. Production URL works: opens directly to the Workbench shell — no login (stateless v1).
4. The test-tone button produces sound.
5. The single bound knob changes pitch in real time.
6. Toggling Stage to 3D shows a rotating mesh.
7. All five Workbench regions are visible and structurally complete (empty content, but correct layout).
8. README + ARCHITECTURE + CONTRIBUTING are present and accurate.
9. No unresolved TypeScript errors, no lint warnings, no console errors on the happy path.
10. A teammate has independently completed the quickstart without intervention.

Criterion 10 is the real test. Everything else is verifiable locally; criterion 10 is what proves the foundation actually holds up.

---

## 5. After v0.1 — What v0.2 Will Tackle

(Not in this plan, just so we know the shape of what we're scaffolding toward.)

- Real synthesis: at least one playable voice (subtractive + FM) wired through the InstrumentPanel.
- Sketch CRUD: create, list, load, save sketches via the Journal panel.
- Real Transport: REC actually records audio to Supabase Storage; playback works.
- The first Box of Randomness axes (probably 3–4) with mutation logic.
- Initial Edge Function for transcription (Whisper via OpenRouter).
- First serious E2E test covering "record → save → reload → play."

---

## 6. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Tone.js AudioContext lifecycle surprises | Phase 6 forces us to confront this on day one, not when it blocks a feature. |
| Threlte bundle bloat | Phase 8 includes a bundle audit; lazy-loading is mandatory from the first 3D component. |
| ~~Supabase RLS misconfiguration~~ | Moot for v1 — no backend (stateless v1). Revisit with Phase 4. |
| Strict TypeScript slows early velocity | Accepted cost; the alternative (loose types) compounds painfully later. |
| ~~Magic-link emails not arriving~~ | Moot for v1 — no auth (stateless v1). Revisit with Phase 5. |
| SvelteKit + Threlte version drift | Pin versions in `package.json`; document upgrade procedure in ARCHITECTURE. |

---

## 7. Open Questions Before Starting

1. **Repo location** — is this repo (`Crimson Sun/chaos-tone`) the final home, or are we moving to a fresh repo?
2. ~~**Supabase organization / project naming**~~ — deferred with Phase 4 (stateless v1).
3. **Custom domain for production** — needed for v0.1, or punt to v0.2? (Vercel preview URLs are fine for development.)
4. ~~**Email provider for magic links**~~ — deferred with Phase 5 (stateless v1).
5. **Husky pre-commit hooks** — yes/no? They speed up review but slow down commits.
6. **License** — pick now (per alpha-tech-stack §6 it's an open question) or punt?
7. **Branch protection** — should `main` be protected and require PR reviews from day one?

---

**This plan is ordered for least-painful execution, not for fastest visible progress.** Phases 1–3 set the foundation. With the backend deferred (stateless v1), demo-worthy work starts at **Phase 6 (audio proof-of-life)** and accelerates through Phases 7–8.

Once v0.1 is live, every subsequent change is product work — and *that's* when speed of iteration starts to compound.
