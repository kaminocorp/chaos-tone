# Phase 1 Completion — Repo & Tooling Foundation

**Status**: Complete
**Date**: 2026-05-18
**Plan reference**: [`docs/executing/scaffolding-plan.md`](../executing/scaffolding-plan.md) §2 Phase 1
**Scope**: Zero → `pnpm install && pnpm dev` yields a blank SvelteKit page that lints, typechecks, tests, and builds.

---

## 1. What landed

A minimal but complete tooling foundation. No product code yet — just the plumbing every subsequent phase will stand on.

### File inventory (root-level new files)

| File | Purpose |
|---|---|
| `.gitignore` | Excludes `node_modules`, build output, `.svelte-kit`, env files (except `.env.example`), editor cruft |
| `.gitattributes` | Forces LF line endings + marks common binary types — prevents diff noise on cross-platform commits |
| `.editorconfig` | Tabs + LF + UTF-8 baseline (Markdown keeps trailing whitespace for hard breaks; JSON/YAML use 2-space) |
| `.npmrc` | `engine-strict=false`, `auto-install-peers=true` |
| `.nvmrc` | Pinned to Node 22 (LTS) — see [Node version section](#3-the-node-version-thing) |
| `package.json` | Deps, scripts, `engines`, `packageManager` field, `pnpm.onlyBuiltDependencies` allowlist |
| `pnpm-lock.yaml` | Generated, committed for reproducible installs |
| `svelte.config.js` | adapter-auto + Svelte 5 runes mode + alias declarations |
| `vite.config.ts` | SvelteKit + Tailwind 4 Vite plugins + Vitest test glob |
| `tsconfig.json` | Strict TS, extends generated `.svelte-kit/tsconfig.json` |
| `eslint.config.js` | Flat config; JS + TS + Svelte recommended rules, Prettier compat |
| `.prettierrc` | Tabs, single quotes, no trailing commas, 100-col, Svelte + Tailwind plugins |
| `.prettierignore` | Excludes generated output, lockfile, **docs/** (user-authored prose), `.claude/`, generated types |
| `src/app.html` | SvelteKit HTML shell |
| `src/app.d.ts` | Empty `App` namespace placeholder |
| `src/app.css` | `@import 'tailwindcss'` — Tailwind 4 CSS-first entry |
| `src/lib/index.ts` | Placeholder so `$lib` is importable |
| `src/lib/smoke.test.ts` | One trivial Vitest test proving the harness runs |
| `src/routes/+layout.svelte` | Imports `app.css`, renders children — Svelte 5 runes (`$props`) |
| `src/routes/+page.svelte` | Centered placeholder home — proves Tailwind classes apply end-to-end |

### Verified by

All four DoD commands run clean on a fresh install:

```
pnpm lint     # prettier --check . && eslint .   →  All matched files use Prettier code style!
pnpm check    # svelte-kit sync && svelte-check  →  301 FILES 0 ERRORS 0 WARNINGS
pnpm test     # vitest run                       →  1 passed (1)
pnpm build    # vite build                       →  ✓ built in 1.00s
pnpm dev      # vite dev                         →  VITE v7.3.3 ready in 408 ms
```

The build emits the expected "Could not detect a supported production environment" warning — `adapter-auto` is the right choice for now; Phase 9 swaps in `adapter-vercel`.

---

## 2. Notable decisions & why

### 2.1 SvelteKit scaffolded manually, not via `sv create`

**What**: I wrote every config file by hand rather than running `pnpm dlx sv create`.

**Why**:
- The `sv` CLI's Tailwind add-on installs Tailwind 3 (last I checked). Tailwind 4 has a different CSS-first config model and a dedicated Vite plugin, so we'd have ripped out the `sv`-generated config immediately anyway.
- It also picks default ESLint rules and an `eslint.config.js` shape I'd want to tune. Easier to write the exact flat config we want than to rewrite a generated one.
- Tight control over path aliases (`$features`, `$stores` are non-default — see `svelte.config.js`).

**Trade-off**: If SvelteKit's default scaffold changes meaningfully in the future, we won't pick up the changes for free. Acceptable — Phase 1 is a one-shot.

### 2.2 Tailwind 4 with no `tailwind.config.ts`

**What**: The plan (§Phase 1) mentions a "minimal `tailwind.config.ts`". I deliberately omitted it.

**Why**: Tailwind 4 is **CSS-first**. Theme tokens, content globs, plugins — all of it now lives in CSS via the `@theme {}` directive, with content auto-discovered by the Vite plugin. A `tailwind.config.ts` in v4 is technically still possible (loaded via `@config "./tailwind.config.ts"` from CSS), but it's vestigial. Writing one to honor the letter of the plan would have created a file that does nothing.

**Where the config lives now**: `src/app.css` has `@import 'tailwindcss';` and that's all Phase 1 needs. Phase 3 will expand this with `@theme {}` for design tokens (colors, spacing scale, fonts).

### 2.3 Aliases — `$lib`, `$features`, `$stores`

**What**: `svelte.config.js` declares `$features → src/lib/features` and `$stores → src/lib/stores`. `$lib` is SvelteKit's default and points at `src/lib`.

**Why these three specifically**: They match the plan's literal list in §Phase 1 ("path aliases: `$lib`, `$features`, `$stores`"). Neither `src/lib/features` nor `src/lib/stores` exists yet — those folders get created in Phase 7 (for stores) and as needed for features. Declaring the alias up front means contributors don't have to retrofit imports later. TypeScript and SvelteKit both pick up the aliases automatically; no separate `tsconfig.json` `paths` entry is needed because `.svelte-kit/tsconfig.json` (which we extend) generates them from `svelte.config.js`.

### 2.4 Strict TypeScript settings beyond the SvelteKit defaults

**What**: `tsconfig.json` adds `noUncheckedIndexedAccess: true` and explicitly sets `strict: true` even though the extended config already implies it.

**Why**: `noUncheckedIndexedAccess` is the single highest-leverage strict flag — it forces every `arr[i]` to be `T | undefined` rather than `T`. For an audio app full of parameter buffers and lookup tables, this catches the kind of bugs that produce silent NaN audio output. Phase 7's `createParamStore` and Phase 8's Threlte ref handling will both benefit.

### 2.5 ESLint flat config, not legacy `.eslintrc`

**What**: `eslint.config.js` uses ESLint 9's flat config format with the `typescript-eslint` helper.

**Why**: Flat config is the only supported format in ESLint 10 and the recommended format in 9. Writing legacy config now would be technical debt from day one. The flat-config Svelte + TS setup is well documented and not much longer than the legacy form.

**Subtle bit**: the `parserOptions.svelteConfig` injection in the `*.svelte` block is required for ESLint to understand Svelte 5 runes — without it, ESLint flags `$state` and friends as undefined globals.

### 2.6 `prettier-plugin-tailwindcss` upgraded to 0.8.0

**What**: Originally pinned `^0.6.10`; bumped to `^0.8.0` after install.

**Why**: 0.6.x throws `TypeError: getVisitorKeys is not a function` when run on `.svelte` files in a Tailwind 4 setup. It's a known incompatibility — 0.6.x predates Tailwind 4's AST changes. 0.8.0 handles it. Flagging it here so the next contributor who tries to bump versions knows the floor.

### 2.7 `docs/` excluded from prettier

**What**: `.prettierignore` includes `docs/`.

**Why**: When I ran `pnpm format` it reformatted seven user-authored docs (vision, alpha-tech-stack, scaffolding-plan, etc.). Those docs were already staged in git — the user authored them with intent, and prettier flipped indentation and wrapped lines in ways that don't preserve voice. Treating prose as user-authored content and excluding it from automated formatting is the safer default. If we later decide we want consistent doc style, the call belongs with the user, not the lint pipeline.

### 2.8 `pnpm.onlyBuiltDependencies: ["esbuild"]`

**What**: An allowlist in `package.json` for which transitive packages may run install scripts.

**Why**: pnpm 10 disables postinstall scripts by default as a supply-chain hardening measure. esbuild's postinstall is what fetches the native platform binary; without approval, Vite builds fail at runtime with a missing-binary error. Explicit allowlist means new contributors don't trip the warning.

**Future risk**: If we add a package that needs its postinstall (e.g. native bindings for audio analysis later), the build will fail until we add it here. That's the right trade-off — we want the friction.

---

## 3. The Node version thing

The user's machine is on **Node 23.3.0** (Homebrew's latest at the time). This caused a hard fail on first `pnpm install`:

```
ERR_PNPM_UNSUPPORTED_ENGINE
Expected version: ^20.19 || ^22.12 || >=24
Got: v23.3.0
```

Node 23 is an odd-numbered "Current" release that's now past EOL (April 2026). It falls in a literal gap in the `engines.node` constraint of `@sveltejs/vite-plugin-svelte@6.2.4`. Several other deps have similar ranges.

**Resolution**:
1. **`.nvmrc` pinned to `22`** — Node 22 is the active LTS; this is what we want contributors to run.
2. **`.npmrc` has `engine-strict=false`** — lets installs proceed even on a mismatched Node, so contributors aren't blocked by the very first command they run. The packages run fine on 23 in practice; engines is a hint, not a hard incompat.
3. **`package.json` `engines.node: ">=20.0.0"`** — our own floor, looser than upstream's, so we don't artificially exclude valid Node versions.

**Recommendation for the user**: switch to Node 22 LTS or 24 via nvm. `nvm use` in this repo will auto-select 22. Until then, builds work but every install emits a warning. If you want the warning gone permanently, run `nvm install 22 && nvm use 22`.

---

## 4. What I deliberately did NOT do (from the plan's "optional")

| Item | Status | Reason |
|---|---|---|
| Husky + lint-staged | Skipped | Listed as optional in §Phase 1 and as an open question (§7 Q5). Lint runs in CI in Phase 9 anyway; pre-commit hooks slow down commits and are easy to retrofit. Waiting on user decision. |
| `tailwind.config.ts` | Skipped | Tailwind 4 doesn't need it; see §2.2 above. |
| Storybook | Skipped | Plan explicitly says "Storybook is NOT part of v0.1" (§Phase 3). |
| `.env.example` | Skipped for now | Phase 4 (Supabase) is the first phase that introduces env vars. Creating an empty `.env.example` now would just be a placeholder. |
| README / ARCHITECTURE / CONTRIBUTING | Skipped | Plan defers these to Phase 10. Writing them now means rewriting them as each phase lands. |

---

## 5. Open questions / surfaced for user

These came up during Phase 1 and are worth a call out:

1. **Node version**: confirm whether contributors should be on Node 22 LTS (current `.nvmrc`) or Node 24. Either is fine; 22 is more conservative.
2. **Husky pre-commit hooks**: still open from the plan (§7 Q5). Cheap to add later (one `pnpm add -D husky lint-staged` + a `prepare` script tweak).
3. **License**: `LICENSE` is Apache 2.0 — predates this plan. The plan's §7 Q6 lists license as an open question; current file suggests the answer is "Apache 2.0". Confirm or change before any public release.
4. **`pnpm` 10 vs 11**: pinned to `pnpm@10.28.2` via `packageManager` (matches user's installed version). When pnpm 11 ships, the `packageManager` field will need bumping.

---

## 6. How to verify on a fresh clone

For the "criterion 10" test (someone else completes setup unassisted) — these are the commands they should run:

```sh
# Optional but recommended: use the pinned Node version
nvm use     # picks up .nvmrc → Node 22

# Install + verify
pnpm install
pnpm check     # typecheck — must show "0 ERRORS"
pnpm lint      # must show "All matched files use Prettier code style!"
pnpm test      # must show "1 passed (1)"
pnpm build     # must show "✓ built"
pnpm dev       # must serve at http://localhost:5173
```

Expected time-to-running-dev-server on a clean machine: **under 2 minutes**, dominated by `pnpm install`.

---

## 7. What this unblocks

Every later phase now has a working foundation:

- **Phase 2** (Routing & Layout) can drop new routes/components and they'll lint, typecheck, and hot-reload.
- **Phase 3** (Design tokens) extends `src/app.css` with `@theme {}`.
- **Phase 4** (Supabase) adds `.env`, `supabase/`, and `src/lib/db/`.
- **Phase 5** (Auth) builds on `+layout.server.ts` and `hooks.server.ts` — no plumbing changes needed.
- **Phase 6** (Audio) installs Tone.js and writes into `src/lib/audio/`.
- **Phase 7** (`createParamStore`) writes into `src/lib/stores/` (alias already configured).
- **Phase 8** (Threlte) installs `@threlte/core` + `@threlte/extras` and writes into `src/lib/threed/`.
- **Phase 9** (CI/CD) swaps `adapter-auto` → `adapter-vercel` and adds `.github/workflows/`.

No part of any subsequent phase requires touching the files written in Phase 1 except `package.json` (new deps) and `svelte.config.js` (adapter swap in Phase 9). That's the whole point of "decouple plumbing from product" — and it's now done.
