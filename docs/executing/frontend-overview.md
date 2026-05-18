# Chaos Tone — Frontend Overview

**Status**: Vision document (not an implementation plan)
**Date**: 2026-05-18
**Scope**: The complete frontend picture for Alpha — layout, regions, behaviors, cross-cutting systems, state model, aesthetic.
**Related docs**: [vision.md](./vision.md), [alpha-tech-stack.md](./alpha-tech-stack.md), [ui-proposals.md](./ui-proposals.md), [scaffolding-plan.md](./scaffolding-plan.md)

This document describes **what the frontend should be**, not **how to build it**. A dedicated implementation plan will later be derived from this.

---

## 1. Mental Model

Chaos Tone's frontend is a **single console** — the Workbench — where all four of the product's pillars (Journal, Synth/Recorder, Box of Randomness, Memory) live in peripheral view at once. The user opens the app and is *immediately inside the instrument*. There is no home page, no project selector, no warm-up screen.

**Three load-bearing ideas**

1. **The Workbench is the app.** Other routes exist (`/memory`, `/settings`, `/auth/*`) but they are auxiliary. The Workbench is where ~95% of user time happens.
2. **The sketch is the atomic unit.** Everything the user does — playing, recording, mutating, organizing — orbits a currently-loaded sketch. The Workbench's identity is defined by which sketch is active.
3. **Stores are the contract.** Every visible control, every Tone.js parameter, every 3D object reads from and writes to the same set of reactive stores. There is no duplicate state, no "sync" step.

---

## 2. Information Architecture

### Routes (Alpha)

| Route | Surface | What it shows |
|---|---|---|
| `/` | Workbench | The console, loaded with the user's last active sketch (or a fresh sketch if none). |
| `/sketch/[id]` | Workbench | Same console, loaded with a specific sketch by ID. Used for deep-links and shareable URLs. |
| `/memory` | Modal overlay (likely) | "Your taste" — what the system has learned. Decision pending (§5). |
| `/settings` | Page | Account, audio device, AI provider, data export, consent toggles. |
| `/auth/login` | Page | Email + magic-link flow. |
| `/auth/callback` | Server-only | Magic-link redirect handler. |

### Non-route surfaces

- **Command Palette** (`⌘K`) — global, opens from any state on the Workbench.
- **Toast notifications** — bottom-center or bottom-right, transient, non-blocking.
- **Modal overlays** — used sparingly; reserved for Memory view, confirmations, and consent prompts.
- **Small-screen blocker** — full-screen message when viewport is below the desktop threshold.

---

## 3. The Workbench — Canonical Layout

The layout is a five-region grid. The grid is fixed in structure (regions don't reflow) but flexible in sizing (side panels can be collapsed or resized).

```
┌─────────────────────────────────────────────────────────────────────┐
│ TopBar                                                              │
├──────────────┬───────────────────────────────────────┬──────────────┤
│              │                                       │              │
│ JOURNAL      │                                       │ CHAOS        │
│ (left rail)  │           STAGE                       │ (right rail) │
│              │           (center)                    │              │
│              │                                       │              │
├──────────────┴───────────────────────────────────────┴──────────────┤
│ INSTRUMENT (full width)                                              │
├──────────────────────────────────────────────────────────────────────┤
│ TRANSPORT (full width, footer)                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Default proportions** (roughly, on a 1440px-wide display)
- TopBar: ~48px tall
- Journal: ~280px wide
- Chaos: ~320px wide
- Stage: flexible, fills remaining width; ~60% of vertical space
- Instrument: ~220px tall
- Transport: ~64px tall

These are starting points. Real numbers come from wireframing and prototype testing.

---

## 4. Region Specifications

For each region: position, default state, components inside, behaviors, keyboard shortcuts (if any), and empty/loading/error states.

### 4.1 TopBar

**Position**: Top of viewport, full width, fixed.
**Purpose**: Identity, navigation entry points, sketch metadata.

**Components**
- Chaos Tone wordmark (left).
- Active sketch title — inline editable. Click to rename; auto-saves on blur.
- Sketch metadata: short string like "4 bars · A minor · 92 BPM" (when known) or "untitled" otherwise.
- `⌘K` command-palette trigger (visible button on the right side, or just a keyboard hint).
- "Taste" badge — small icon that opens the Memory view. Subtly indicates "the system has learned N things about you" with a numeric or color cue.
- User avatar/menu — opens a dropdown with profile, settings link, logout.

**Behaviors**
- Inline title editing: click → focus, blur or Enter → save.
- Metadata is read-only display; clicking opens a sketch-info popover (future).
- "Taste" badge animates subtly when new learning has happened since the user last viewed Memory.

**States**
- Empty (no sketch loaded — should be rare): title shows "new sketch", metadata hidden.
- Loading (sketch hydrating): title is greyed, metadata shows "…".
- Error: a small inline error indicator near the title with hover details.

---

### 4.2 Journal Panel (left rail)

**Position**: Left side, full height between TopBar and Transport, fixed width with resize handle.
**Purpose**: Always-visible archive of sketches; entry point to revisit past ideas.

**Components**
- Search input at top — text + inline filter chips (tags, date ranges).
- Sketch list, newest at top. Each row shows:
  - Title
  - Tiny waveform thumbnail (or placeholder when audio not yet generated)
  - Time ("2m ago", "Tuesday", "May 4")
  - Tag dots / color coding
- "New sketch" button at the bottom — always reachable.
- Collapse handle (chevron) — collapses the panel to a thin icon strip showing one dot per sketch.

**Behaviors**
- Click a row → loads that sketch into the Workbench (Stage + Instrument + Chaos all rehydrate).
- Arrow keys (when Journal is focused): preview-play each sketch inline in the Stage *without* fully loading it. Enter to commit-load.
- Right-click row → context menu (rename, duplicate, delete, tag, export).
- Search input: typed query updates the list reactively. Semantic search via pgvector is the goal; substring match is the fallback when embeddings aren't ready.
- Drag-and-drop reordering is **not** in Alpha — order is always reverse chronological.
- Tags can be added via the row context menu or by typing `#tagname` in the search input.

**States**
- Empty (new user, no sketches): friendly empty state with a single "Record your first sketch" prompt and a big REC button.
- Loading: skeleton rows.
- Search no-results: "No sketches match. Try a different word, or hum it." with a quick REC button.
- Error (DB unreachable): row shows "couldn't load — retry" and a button.

---

### 4.3 Stage (center)

**Position**: Center column, between Journal and Chaos, above Instrument.
**Purpose**: The *visual* of the current sound. Where 3D delight lives.

**Components**
- 2D mode (default): high-quality waveform + spectrum view, playhead overlay, optional loop region indicators.
- 3D mode (opt-in): Threlte canvas rendering audio-reactive 3D objects. Lazy-loaded only when activated.
- Mode toggle (2D / 3D) — small control in the Stage's top-right corner.
- Subtle sketch title overlay (bottom-left, very low contrast) for screenshot context.
- "Sketch is silent" placeholder when no audio exists yet — a calming animation rather than an empty box.

**Behaviors**
- Stage continuously reads Tone.js analyzer output and updates the visualization.
- In 2D mode: waveform is canvas-rendered; CPU/GPU cost is bounded.
- In 3D mode: Threlte canvas renders. CPU/GPU usage is monitored and the canvas is paused when the tab is hidden.
- Click on the waveform to set playhead. Drag to set loop region (future).
- Stage is the primary beneficiary of **Focus Mode** (see §5.2): hides both side rails, expanding the Stage to fill the screen.

**States**
- No audio yet (fresh sketch): minimalist visual placeholder, no waveform.
- Audio loading: pulse animation.
- Audio loaded but not playing: static waveform.
- Playing: animated playhead + audio-reactive visualization.
- Error (audio decode failed): clear text with a retry option.

---

### 4.4 Chaos Panel (right rail)

**Position**: Right side, full height between TopBar and Transport, fixed width with resize handle.
**Purpose**: The Box of Randomness — steerable, ambient, attached to the active sketch.

**Components**
- Axis sliders — vertical sliders for each randomness axis. Starting set (TBD per ui-proposals §11 Q12), candidates: Chaos, Structure, Timbre Surprise, Rhythmic Glue, Emotional Temperature, Density.
- Per-axis lock toggle — small icon below each slider; locked means "don't change this when mutating."
- "Mutate ▸" button — triggers a generation pass. Shows a spinner while waiting.
- Mutation history — a small scrollable list of recent mutations, each with a tiny waveform and keep/discard actions inline.
- Collapse handle (mirror of Journal's).

**Behaviors**
- Adjusting any axis slider updates the axis weight in the active randomness session store. No commit step — values are live.
- Mutate button: sends current axis weights + sketch context to the generation pipeline (client-side rules for v0.2 instant mutations; cloud-assisted for slower, higher-quality mutations later).
- A new mutation auto-plays inline in the Stage. The user then explicitly Keeps, Mutates Again, or Discards via the Transport bar.
- Mutation history rows are clickable to replay; right-click for "promote to sketch" (saves as a new sketch).
- Locks persist across mutations within a session.

**States**
- Fresh (no mutations yet): sliders at default mid-positions, history empty with a "start mutating" hint.
- Mutating (waiting on generation): button shows spinner; sliders are read-only briefly.
- Error (generation failed): toast notification + retry button in the panel.

---

### 4.5 Instrument Panel (bottom strip)

**Position**: Full-width strip below the Stage and side rails, above the Transport.
**Purpose**: The tactile synth. The user's hands.

**Components**
- Voice selector dropdown (left edge): subtractive, FM, wavetable, granular, etc. Plus user presets later.
- Macro knobs (4–6): high-level controls that route to many underlying parameters. E.g., "Brightness", "Movement", "Body", "Air".
- Envelope shape control (visual ADSR or simpler attack/release).
- Filter section: cutoff, resonance, filter type.
- FX chain: a small horizontal strip of effect slots (filter, delay, reverb, distortion, chorus). Each slot shows on/off + one or two top params; click to expand details.
- Expand toggle: reveals deeper parameter rows (per-voice tuning, modulation matrix, etc.). Hidden by default.

**Behaviors**
- All knobs are bound to param stores via the `createParamStore` pattern. Turning a knob updates the audio immediately.
- Knob interaction: click and drag vertically, or hover and use scroll wheel. Shift-drag for fine control. Double-click to reset to default.
- Voice change: smoothly crossfades the active voice (or hard-switches if crossfade isn't feasible). The current note keeps playing.
- Macro knobs visually link to the parameters they control (subtle line or glow when you hover over a macro).
- FX slots are drag-reorderable in v0.2+; static order in Alpha.
- The panel is fully **collapsible** to a single thin row showing voice name + transport — for users in focus-on-Stage mode.

**States**
- Default voice loaded.
- Loading a voice (rare): show "loading voice…" briefly.
- Mid-mutation: the panel reflects the new parameters in real time as Chaos mutates them.

---

### 4.6 Transport Bar (footer)

**Position**: Bottom of viewport, full width, fixed.
**Purpose**: Playback controls + the *keep / mutate / discard* ritual that drives the learning signal.

**Components**
- REC button (large, left side, always visible).
- Play / pause toggle.
- Stop.
- Loop toggle + loop region indicators (mirrored from Stage).
- A/B toggle — compare two versions of the sketch (Alpha-or-v1 question; see ui-proposals §11 Q17).
- Tempo + key display (read-only in Alpha; editable later).
- **Keep · Mutate · Discard** — the three-button ritual, prominently placed to the right.
- Volume / output meter.

**Behaviors**
- REC is always one click. If a mutation is currently playing, REC overrides it.
- The keep/mutate/discard buttons are *only active* after a mutation has played. In their inactive state they're visible-but-dim, so the user learns the ritual exists.
- "Keep" merges the current mutation into the sketch (overwriting or branching, TBD) and logs a positive learning signal.
- "Mutate" re-runs generation with the same axis weights (variation on a theme).
- "Discard" removes the mutation and logs a negative learning signal.
- The asymmetry of these three signals is intentional — see vision.md.

**States**
- Idle (no audio playing, no mutation pending): basic playback controls + REC.
- Playing: play button becomes pause; meter shows live levels.
- Recording: REC button pulses red; play disabled.
- Mutation pending decision: keep/mutate/discard buttons highlighted, awaiting user.

---

## 5. Cross-Cutting Systems

These behaviors and surfaces span multiple regions or live above the layout.

### 5.1 Command Palette (`⌘K`)

**Trigger**: `⌘K` (or `Ctrl+K`) from any state. Also clickable in TopBar.

**Contents** (Alpha)
- Navigation: "Go to Memory", "Go to Settings", "Sign out".
- Semantic sketch search: type a description → pgvector results.
- Commands (some, not all v0.1): "Toggle focus mode", "Toggle 3D stage", "New sketch", "Mutate", "Save".

**Behavior**
- Open with `⌘K`, close with `Esc` or click outside.
- Results are arrow-key navigable; Enter to commit.
- Recent commands are remembered per session.

### 5.2 Focus Mode

**Trigger**: `F` key (when not typing in an input) or a small focus-mode button in the Stage.

**Behavior**
- Hides Journal and Chaos panels (slide off-screen with a short animation).
- Optionally hides the Instrument panel as well (per ui-proposals §11 Q4).
- Keeps Transport pinned at the bottom.
- The Stage expands to fill the freed space. 3D delight surfaces benefit most.
- `F` again or `Esc` exits focus mode.

### 5.3 Keyboard Shortcuts (initial proposal)

| Key | Action |
|---|---|
| `Space` | Play / pause |
| `R` | Toggle REC |
| `F` | Toggle focus mode |
| `K` | Keep current mutation |
| `M` | Mutate again |
| `D` | Discard mutation (with confirm) |
| `⌘K` / `Ctrl+K` | Command palette |
| `⌘S` / `Ctrl+S` | Save sketch (usually unnecessary — saves are automatic, but the muscle memory exists) |
| `?` | Show keyboard shortcuts overlay |
| `Esc` | Close any overlay; exit focus mode |

Shortcuts are **disabled** when an input field has focus. The shortcuts overlay (`?`) is a non-interactive cheat-sheet.

### 5.4 Audio-Reactive Motion

**Principle**: Motion in the UI is *reactive*, not *decorative*. Things move because the audio moves.

**Sources**
- Tone.js analyzers (FFT, waveform, RMS, pitch tracker) expose audio data via dedicated stores.
- Visual elements subscribe to these stores and animate in response.

**Reactive elements**
- The "Taste" badge color/pulse when learning happens.
- Macro knob subtle glow when its underlying parameters are being driven by audio analysis (future).
- 3D stage objects respond to spectral bands.
- Transport meters.
- Chaos panel axis sliders gently wobble when mutation is in progress.

**Anti-pattern**: ambient idle animations not driven by audio. The app should feel still when there's no sound.

### 5.5 Toast Notifications

**Position**: Bottom-center, just above the Transport.
**Style**: Compact, dark surface, brief text, optional icon.
**Use cases**
- "Sketch saved."
- "Mutation failed — retry?"
- "Magic link sent."
- "Sketch deleted — undo?"

Toasts are dismissable, time-limited (~4s), and never block input. Critical errors get a longer dwell time and an explicit close button.

### 5.6 Modal Overlays

**Used sparingly.** Reserved for:
- Memory view (Alpha — may be promoted to a page later).
- Destructive confirmations (delete sketch, reset learned preferences).
- First-run consent prompts (data sharing, audio permissions).
- The "?" keyboard shortcut cheat-sheet.

Modals dim the Workbench but never silence audio.

### 5.7 Loading, Empty, and Error States

Every region must define its three non-happy states. As a project rule:
- **Empty** states are *inviting*, not apologetic. They should pull the user toward action.
- **Loading** states are *quick* and visually quiet — skeleton UIs, not spinners, where possible.
- **Error** states give a *plain reason* and a *recovery action*. Never just "Error."

---

## 6. Non-Workbench Surfaces

### 6.1 Memory View (`/memory`)

**Mode**: Modal overlay over the Workbench (Alpha). Could promote to a full page later.

**Contents**
- Inferred axis weights — what the system thinks you like.
- Top kept sketches and top discarded sketches, with quick listen + revisit actions.
- "Why this suggestion?" trail — when the user revisits a recent mutation, this shows which learned preferences influenced it.
- Reset / fine-tune controls — toggle off specific preferences, or "forget the last N sessions."

**Behaviors**
- The memory state is read-only by default; explicit edits require confirmation.
- Closing the modal returns to the Workbench unchanged.

### 6.2 Settings (`/settings`)

**Sections**
- Profile: display name, avatar, email.
- Audio: input device, output device, latency hint.
- AI / Cloud: AI provider preference (when more than one is available), consent to send learning data, API quota indicators.
- Data: export sketches (audio + metadata zip), import sketches, delete account.
- Appearance: theme (dark only in Alpha), UI sound on/off (per ui-proposals §11 Q26).
- Keyboard shortcuts: read-only list in Alpha; remappable later.

Settings is a real page route (not a modal) because users may want to scroll, search, and copy values from it.

### 6.3 Auth (`/auth/*`)

**Pages**
- `/auth/login` — single email input + "send magic link" button. Subtle Chaos Tone branding.
- `/auth/callback` — server-only redirect handler. Briefly shows "signing you in…" if it renders at all.

**Behavior**
- New users sign in via the same magic-link flow as returning users.
- After login, redirect to `/` (the Workbench) — *not* to a dashboard or onboarding.
- Optional first-time onboarding tip on the Workbench itself (a dismissible overlay, not a separate route).

### 6.4 Small-Screen Blocker

**Trigger**: Viewport width below the desktop threshold (e.g., 1024px).
**Content**: A clear, calm message explaining that Chaos Tone is desktop-only for Alpha, with a link to the vision or roadmap doc for mobile timing.
**No half-broken responsive Workbench.** This is a deliberate decision per ui-proposals §8.

---

## 7. State Model

### 7.1 Store Taxonomy

The frontend's state is organized into a small number of typed store *categories*:

1. **Sketch store** — the currently-active sketch (id, title, audio refs, parameter snapshot, tags, metadata). Loading a new sketch replaces this store's contents.
2. **Param stores** — one per synth parameter, created via `createParamStore`. Bind directly to Tone.js `Param` objects.
3. **Audio analysis stores** — FFT, waveform, RMS, pitch. Updated from Tone.js analyzers at animation-frame rate. Consumed by Stage visualizations and other reactive UI.
4. **Randomness session store** — current axis weights, locks, mutation history, pending mutation result.
5. **Learning store** — inferred preferences, kept/discarded signals, "why this" trails. Synced to Supabase per user consent.
6. **UI state stores** — focus mode on/off, active panel collapse states, command-palette open/closed, current toast queue.
7. **Session store** — auth state (user, profile, supabase client).

### 7.2 Stores as the Contract

The unbreakable rule: **a parameter has exactly one source of truth, and it's a store.** A knob, a Tone.js node, a 3D object, and a save-to-DB call all read from / write to the same store.

This means:
- No "sync this UI to the audio engine" code paths.
- No "save the synth state to the sketch" gathering — the sketch *is* a snapshot of the relevant stores.
- Bindings are declarative: `$paramStore` in markup, `paramStore.bindTo(toneNode.frequency)` in setup.

### 7.3 Sketch Hydration / Dehydration

**Hydrate** (loading a sketch from DB):
1. Fetch the sketch row + its parameter snapshot.
2. Apply the snapshot to all relevant param stores (with ramping for audio-rate params to avoid clicks).
3. Set the sketch store to the loaded sketch.
4. Optionally restore randomness session state.

**Dehydrate** (saving):
- Subscribe to param-store changes (debounced) → write the current snapshot back to the sketch row.
- Saves are automatic and frequent. Manual save (`⌘S`) is a no-op confirmation.

### 7.4 Audio Pipeline at a Glance

```
   user gesture
        │
        ▼
  Tone.start()
        │
        ▼
  voice graph (synth → fx chain → master)
        │           ▲
        │           │ params driven by stores
        ▼           │
   analyzers ────────┴─→ audio analysis stores
        │
        ▼
   Stage visualization, meters, reactive UI
```

---

## 8. Component Library

Initial component inventory. Each entry is a frontend artifact that will be implemented as a real Svelte component.

### Primitives (`lib/components/ui/`)
- `Button`, `IconButton`, `ToggleButton`
- `Slider` (horizontal + vertical), `Knob` (real audio-grade — comes after Phase 7 of scaffolding)
- `Input`, `Select`, `Checkbox`, `Switch`
- `Panel` (with header + collapse), `Drawer`, `Modal`, `Toast`
- `Tooltip`, `Popover`, `Menu`
- `Tag`, `Chip`, `Badge`

### Workbench regions (`lib/components/workbench/`)
- `Workbench` (composes everything)
- `TopBar`, `JournalPanel`, `Stage`, `ChaosPanel`, `InstrumentPanel`, `TransportBar`

### Workbench-specific composites
- `SketchRow` (Journal)
- `WaveformThumbnail` (Journal + Stage)
- `AxisSlider`, `MutationHistoryRow` (Chaos)
- `VoiceSelector`, `MacroKnob`, `FXSlot`, `EnvelopeShape` (Instrument)
- `KeepMutateDiscard` (Transport)
- `LevelMeter`, `LoopRegion` (Transport / Stage)

### Stage rendering
- `Stage2D` — canvas-based waveform + spectrum.
- `Stage3D` — Threlte canvas, lazy-loaded.
- `Visualizer` shared abstractions (mode toggle, pause-on-tab-hidden).

### Global
- `CommandPalette`
- `KeyboardShortcutsOverlay`
- `SmallScreenBlocker`
- `MemoryView` (modal)

---

## 9. Aesthetic & Motion System

### Palette
- **Base**: deep neutrals — warm black (`#0e0d0c`), charcoal surfaces (`#1a1917`), parchment text (`#e8e3da`).
- **Accents**: a small set of saturated colors (1–2 primary, 1 alert) that respond to audio. They're not "brand colors" applied uniformly — they're an *active* layer that pulses, dims, glows in response to what's playing.
- **Avoid**: gradient-heavy modern SaaS aesthetics, neon Web3 vibes. The reference is *instrument*, not *dashboard*.

### Typography
- **Monospace** (e.g., JetBrains Mono, Berkeley Mono): for parameter values, sketch metadata, codes.
- **Humanist sans** (e.g., Inter, Söhne, IBM Plex Sans): for prose — sketch titles, settings, marketing-adjacent text.
- Type scale should be tight; the Workbench is dense, so most UI text is small but high-contrast.

### Motion principles
1. **Reactive, not idle.** Motion responds to audio or user action. The app is still by default.
2. **Short and decisive.** Transitions are 120–200ms. No 600ms bouncing.
3. **Spatial.** Panels slide and dock; modals fade. Each kind of motion has a meaning.
4. **Audio-rate where possible.** Visualizations are driven by analyzer data at animation-frame rate.

### 3D style
- Physical, weighted, slightly imperfect surfaces. Subtle subsurface scattering, real shadows.
- Not glossy "demo" 3D. Reference: a worn synth knob, a vintage tape reel, a foam-damped speaker.
- 3D is a *delight layer*, not a feature requirement. The 2D Stage must be excellent on its own.

### Iconography
- A single icon library (Lucide or similar) used consistently.
- Custom icons reserved for branded elements (the Chaos Tone wordmark, the "taste" badge).

### UI sound
- Off by default (per ui-proposals §11 Q26 — pending confirmation).
- If on: very subtle, low-amplitude — they should not interfere with the user's music.

---

## 10. Accessibility

### Alpha targets
- **Keyboard navigation** — every interactive element reachable by keyboard. Focus rings visible.
- **Color contrast** — WCAG AA minimum, including for the audio-reactive accent layer (test at its dimmest state).
- **Screen reader basics** — proper ARIA on interactive components; live regions for toast notifications; meaningful alt text for sketch waveform thumbnails ("waveform for sketch X").
- **No flashing** that violates seizure-safety thresholds, even at high audio reactivity.

### Deferred to v1+
- Full screen-reader narration of the playback experience.
- Internationalization (English-only in Alpha).
- High-contrast / light themes.
- Reduced-motion mode (we'll respect `prefers-reduced-motion` in v0.2 even if a full implementation comes later).

---

## 11. Out of Scope for Alpha Frontend

So we don't accidentally design around them:

- **Real-time collaboration** (multi-user sketches, live shared sessions).
- **Public sharing UI** (the routes exist but social/share affordances do not).
- **Performance / live mode** (a different UI for stage use).
- **Hardware MIDI mapping screens** — Web MIDI is targeted (alpha-tech-stack §5), but the mapping UI is post-Alpha.
- **Project / folder organization** — sketches live in a flat list per user.
- **Tablet-optimized layout** — degraded gracefully or blocked.
- **Marketing pages** (landing page, pricing, about) — separate effort.
- **In-app help system** beyond the keyboard shortcuts overlay.

---

## 12. Decisions Still Pending

Tracked here because they directly shape the frontend. All map to questions in ui-proposals.md §11.

| Topic | Pending decision | Blocks |
|---|---|---|
| Stage vs Instrument in center | Confirm Stage-center proposal | Final wireframes |
| Number of randomness axes | Pick the Alpha set (4–8) | Chaos panel layout |
| Memory: modal or page | Choose for Alpha | Routing + design effort |
| Visual reference | Pick 2–3 references | Aesthetic system |
| UI sounds on/off | Confirm default | Audio pipeline scope |
| A/B comparison in Transport | Yes/no for Alpha | Transport layout |
| Voice-switching mid-sketch | Yes/no | Sketch data model |

---

## 13. What Comes After This Document

This document is the *frontend vision*. The next artifacts derived from it should be:

1. **Wireframes** — one per region, then composited into the full Workbench. Both at default state and at edge cases (focus mode, empty Journal, mid-mutation).
2. **Interaction prototype** — clickable Figma or coded prototype that demonstrates the sketch lifecycle loop (§3 of ui-proposals).
3. **Frontend implementation plan** — phased plan that turns this document into shipped code, after v0.1 scaffolding lands.
4. **Design system documentation** — formal tokens, component specs, accessibility specs. Likely a Storybook or equivalent.

---

**This document describes the destination. The scaffolding plan describes how we get the foundation in place. The implementation plan for the actual frontend features will be derived from this document once the scaffolding is complete.**
