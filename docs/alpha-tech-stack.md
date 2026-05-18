# Chaos Tone — Alpha Tech Stack

**Status**: Proposed (for review)  
**Date**: May 2026  
**Scope**: Alpha version (browser-based, internet required)  
**Related docs**: [vision.md](./vision.md), [soundengines.md](./soundengines.md)

---

## 1. Guiding Principles for Alpha

The Alpha phase deliberately relaxes the "full offline is sacred" constraint from the original vision. This is a pragmatic decision to maximize speed, capability, and user delight in the first public version.

**Alpha Priorities** (in order):

1. **Speed of iteration & playability** — Must feel fun and responsive from the first usable build.
2. **Strong creative surface** — Excellent tactile synth/recorder experience + beautiful, meaningful visuals (including 3D).
3. **Learning system that feels personal** — The "Box of Randomness" must start showing taste and memory early.
4. **Reliable cloud foundation** — User accounts, sync, and high-quality AI features from day one.
5. **Preserve future offline path** — Architecture should not paint us into a corner for a strong offline experience later.

We accept internet as a requirement for Alpha, while still keeping as much intelligence and state client-side as reasonable.

---

## 2. Core Stack Decision

| Layer              | Choice                          | Rationale |
|--------------------|----------------------------------|---------|
| **Framework**      | **SvelteKit + Svelte 5 (Runes)** | Best-in-class reactivity and developer experience for real-time audio + interactive creative tools. Smaller bundles and finer-grained updates than React. |
| **3D / Visualization** | **Threlte** (`@threlte/core` + `@threlte/extras`) | Mature, declarative Three.js wrapper designed for Svelte. Excellent pointer interaction, reactivity with runes, and audio helpers. |
| **Audio Engine**   | **Tone.js**                      | Battle-tested, rich feature set (synthesis, effects, scheduling, analysis), and the explicit recommendation in the vision. |
| **Backend / Platform** | **Supabase** (Postgres + Auth + Storage + Realtime + Edge Functions + pgvector) | Proven for AI creative tools (used by major music AI products). Provides auth, sync, vectors for learning, realtime, and storage with minimal glue. |
| **Hosting**        | **Vercel** (for SvelteKit) + Supabase | Best-in-class DX and performance for SvelteKit. |
| **Styling**        | **Tailwind CSS 4** + custom design system | Fast iteration. We will likely evolve toward a more "instrument-like" aesthetic over time. |

**Primary Alternative Considered**: Next.js 15 + Supabase. It remains a very close second and would be the safer "default" choice for many teams. We are choosing SvelteKit primarily because the creative/audio/interaction surface is the heart of the product.

---

## 3. Frontend Layer

### Framework & Tooling
- **SvelteKit** (latest stable with Svelte 5 runes)
- **Vite** (via SvelteKit) + TypeScript (strict)
- **Tailwind CSS 4**
- **shadcn-svelte** (or a very thin custom component layer) for rapid 2D UI primitives
- **Lucide** icons (or similar)

### UI Philosophy for Alpha
- **Hybrid interface**: Beautiful 2D controls as the reliable foundation + selective, high-impact 3D manipulators and visualizations.
- Prioritize **feel** and **responsiveness** over pixel-perfect design in the first 2–3 months.
- Mobile-responsive but optimized for desktop/laptop as the primary creative environment initially.
- Dark, minimal, slightly "analog instrument" aesthetic with strong visual feedback.

### Key Libraries
| Purpose                    | Package(s)                              | Notes |
|---------------------------|-----------------------------------------|-------|
| Forms & validation        | SvelteKit forms + Zod                   | Keep simple |
| Date/time & utilities     | `date-fns`, `nanoid`                    | — |
| Rich interactions         | Custom + `@use-gesture` if needed       | Prefer native + Svelte actions |
| Command palette / search  | `cmdk-svelte` or custom                 | Important for Journal navigation |
| Drag & drop               | HTML5 Drag API + custom                 | — |

---

## 4. 3D / Visualization Layer

### Primary Tool: Threlte

- `@threlte/core`
- `@threlte/extras` (interactivity, controls, audio helpers, etc.)
- Optional later: `@threlte/rapier` (physics), Theatre.js integration for timelines

### Usage Guidelines
- **3D is a delight layer**, not the only way to interact. Core synthesis and parameter control must work excellently in 2D.
- Use 3D for:
  - Expressive visual feedback (waveforms, particle systems, reactive objects)
  - Novel control surfaces (draggable/stretchable 3D objects that map to timbre, filter, envelope, spatial parameters, etc.)
  - "Box of Randomness" visualization (showing structure, chaos, memory influence)
- Lazy-load any route or component containing a `<Canvas>` to protect initial bundle size.

### Performance & Architecture
- Single source of truth for parameters lives in Svelte runes/stores.
- 3D objects read from and write to these stores.
- Tone.js analyzers drive reactive visual properties via `$effect` or derived stores.
- Use Threlte's `interactivity()` plugin for pointer-based manipulation.

**Example mental model** (to be validated in code):
```svelte
<!-- 3D control component -->
<T.Mesh
  position={$filterCutoffPosition}
  on:pointerdown={startDrag}
  on:pointermove={updateFromDrag}
>
  <!-- geometry + material -->
</T.Mesh>
```

The same `$filterCutoffPosition` store drives both the visual object and `filter.frequency.value` in Tone.js.

---

## 5. Audio Engine

### Foundation
- **Tone.js** (primary synthesis, effects, Transport/scheduling, analysis)
- Web Audio API directly only when Tone.js abstractions are insufficient

### Planned Synthesis Approach (Alpha)
Start with a **flexible hybrid instrument** rather than committing to one paradigm:

- Subtractive + FM foundation (Tone.js `Synth`, `FMSynth`, `PolySynth`)
- Wavetable / custom waveform support
- Granular elements for texture (via `GrainPlayer` or custom buffer work)
- Rich effects chain (filter, delay, reverb, distortion, chorus, etc.)

### Effects & Routing
- Per-voice vs global effects decision to be validated in the first playable prototype.
- User should be able to "mutate" effects as part of the Box of Randomness.

### Analysis & Feedback
- Tone.js analyzers (FFT, waveform, etc.) exposed to both 2D and 3D visualization layers.
- On-device pitch detection (Web Audio + autocorrelation or small library) for immediate hum/melody capture, even before cloud transcription.

### MIDI & Control
- Web MIDI API support targeted for Alpha (or very early post-Alpha).
- Parameter mapping from MIDI CC is high value.

---

## 6. State Management

**Primary approach**: Native Svelte 5 runes (`$state`, `$derived`, `$effect`) + lightweight custom stores where needed.

**When we may add a thin state library**:
- Complex cross-component undo/redo
- Sophisticated "memory" system for the Box of Randomness
- If runes + context become painful at scale

**Recommended light wrapper pattern** (if needed):
- A tiny `createParamStore()` helper that integrates cleanly with Tone.js `Param` objects and Threlte reactive props.

**Undo / History**:
- Critical for a creative tool. Plan for a simple command pattern or snapshot-based history from the beginning.

---

## 7. Backend & Data Layer

### Platform: Supabase

**Services we will use**:
- **Auth** (email + magic link + Google/Apple later)
- **Postgres** (main relational data)
- **pgvector** (embeddings for semantic search over sketches, prompts, and learned preferences)
- **Storage** (audio files, exports, user uploads)
- **Realtime** (generation progress, collaborative features later, live parameter sharing)
- **Edge Functions** (TypeScript/Deno) — AI orchestration, transcription proxy, randomness generation helpers
- **Row Level Security** — Everything private by default

### Data Model (High Level, Alpha)

Core entities:
- **User**
- **Sketch** (journal entry) — audio, transcription, melody data, text notes, tags, creation context
- **Instrument Preset / Patch**
- **Randomness Session** — parameters, weights, outcome, user feedback (keep/mutate/discard)
- **Memory Vector / Embedding** — derived taste model (stored server-side with consent, or hybrid)
- **Project / Collection** (grouping mechanism)

Sketches are the atomic unit. The Journal is primarily a queryable, searchable, filterable list of sketches.

### Why Supabase for the Learning System
`pgvector` enables semantic similarity queries ("find sketches that feel like this one") which is extremely powerful for the Box of Randomness and Memory & Evolution pillars.

---

## 8. AI & Intelligence Layer (Hybrid)

### Tiered Approach (still valid)

| Tier | Location          | Use Cases                              | Alpha Priority |
|------|-------------------|----------------------------------------|----------------|
| 0    | Client (rules + stats) | Basic randomness engine, simple learning from keep/discard | High — ship early |
| 1    | Supabase Edge Functions + external APIs | Transcription (Whisper), melody analysis, generative suggestions, embedding generation | Core for Alpha |
| 2    | On-device         | Pitch detection, small classification models | Nice-to-have |
| 3    | Heavier server inference | Future (not Alpha) | — |

### Specific Alpha AI Capabilities (Target)
- High-quality voice-to-text + melody transcription (via API)
- Automatic tagging / semantic description of sketches
- "Continue this idea" or "Mutate this sketch in your style" suggestions
- Intelligent parameter proposals in the Box of Randomness

**API Strategy**: Use OpenRouter (or direct providers) via Edge Functions so we can:
- Route intelligently
- Add logging / user quotas
- Swap models without client changes
- Keep API keys server-side (optional)

---

## 9. Storage & Persistence

| Data Type                  | Primary Location     | Notes |
|---------------------------|----------------------|-------|
| User accounts & auth      | Supabase Auth        | — |
| Sketches & metadata       | Supabase Postgres    | Source of truth |
| Audio files (recordings, exports) | Supabase Storage | Or Cloudflare R2 if egress becomes expensive |
| Embeddings / vectors      | Supabase (pgvector)  | Enables semantic features |
| Local cache / drafts      | IndexedDB (via `idb` or `localforage`) | Improves perceived speed and offline gracefulness |
| Parameter history / learning signals | Hybrid (client + server) | Decision to be validated |

**Local cache strategy**: Optimistic writes + background sync. Even though Alpha requires internet, we still want the app to feel instant and survive flaky connections.

---

## 10. Build, Deployment & Developer Experience

- **Package manager**: `pnpm` (recommended) or `bun`
- **Linting / Formatting**: ESLint + Prettier + `svelte-check`
- **Testing**:
  - Unit: Vitest
  - Component: Svelte Testing Library or Playwright component tests
  - E2E: Playwright (critical for audio flows — we must test real interaction)
- **Type safety**: Strict TypeScript + Supabase generated types
- **Deployment**:
  - Frontend: Vercel (SvelteKit adapter)
  - Database / Auth / Storage / Functions: Supabase
- **Secrets & Config**: Vercel + Supabase environment management
- **Monitoring**: Basic error tracking (Sentry or equivalent) + Supabase logs

**Audio testing note**: True audio behavior is hard to unit test. Focus E2E tests on user flows (record → save → mutate → keep) and performance budgets.

---

## 11. Key Architectural Patterns

1. **Stores as the contract**
   - Parameter stores are the single source of truth.
   - 2D UI, 3D objects, Tone.js nodes, and the learning system all read/write through the same stores.

2. **Sketch as the atomic creative unit**
   - Everything revolves around capturing, mutating, and evolving sketches.

3. **Hybrid randomness engine**
   - Client-side for instant, low-latency "chaos"
   - Server-assisted for higher-quality, taste-aware suggestions

4. **Progressive enhancement of intelligence**
   - Start with simple statistical learning + rules.
   - Add embeddings and semantic memory as usage data arrives.

5. **Clear consent boundaries**
   - Users must explicitly opt into any server-side storage of preference models or training data.

---

## 12. Trade-offs & Future Considerations

| Decision                  | Alpha Choice                  | Future Implication |
|---------------------------|-------------------------------|--------------------|
| Internet required         | Accepted                      | We must design a credible offline story for v1 or v2 |
| Cloud as source of truth  | Yes                           | Local-first sync (CRDTs or diff-based) becomes a later project |
| Heavy use of Supabase     | Yes                           | We gain speed but increase platform dependency |
| 3D via Threlte            | Yes                           | Bundle discipline required; 3D remains "power feature" |
| SvelteKit instead of Next.js | Chosen for creative fit     | Slightly smaller hiring pool; excellent DX compensates |

**Offline path preservation**:
- Keep a clean abstraction between "data layer" and "sync layer".
- Client-side learning engine should be able to run independently.
- Local IndexedDB remains the working cache.

---

## 13. Open Decisions & Next Steps

**High-priority decisions to validate in the first 4–6 weeks of coding**:

1. Exact synthesis voice architecture (how many voices, how effects are routed).
2. Concrete data model for sketches and memory vectors (get this into Supabase early).
3. State management threshold — when do runes + custom helpers become insufficient?
4. 3D control surface scope for Alpha (how many 3D manipulators vs visualizations).
5. Pricing / quota model for AI features (transcription, generation) — even if free in Alpha.
6. Public vs private sketch defaults and sharing mechanics.

**Immediate next actions** (proposed):

- [ ] Create repository scaffolding with SvelteKit + Tailwind + TypeScript
- [ ] Set up Supabase project + basic schema (User, Sketch, Embedding)
- [ ] Build the first playable "Recorder + Simple Synth + Save to Journal" flow
- [ ] Prototype one Threlte + Tone.js reactive control (e.g., a 3D filter cutoff handle)
- [ ] Define the initial "Box of Randomness" parameter space and basic mutation logic

---

**This document is intended to be a living proposal.** Feedback welcome on any section — especially where it diverges from the original vision or where you see better alternatives.

Let's build something musicians actually fall in love with.