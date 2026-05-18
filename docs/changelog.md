# Chaos Tone — Changelog

- [0.1.0 — Scaffolding](#010--scaffolding-2026-05-18)

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
