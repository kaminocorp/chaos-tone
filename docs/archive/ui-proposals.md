# Chaos Tone — UI / Layout Proposals

**Status**: Draft for refinement
**Date**: May 2026
**Scope**: Alpha UI architecture — pages, regions, components, flows
**Related docs**: [vision.md](./vision.md), [soundengines.md](./soundengines.md), [alpha-tech-stack.md](./alpha-tech-stack.md)

---

## 0. Why this document exists

The UI is not a skin over the product — it *is* the product. Chaos Tone has to feel like an **instrument you trust**, not an app you operate. Before we build anything, we need to agree on:

1. What the user sees the moment they open Chaos Tone.
2. Where each of the four pillars (Journal, Synth/Recorder, Box of Randomness, Memory) lives.
3. How a single creative gesture — *capture → play → mutate → keep* — flows visually.
4. How mobile capture and desktop jamming relate (same UI? different surfaces? same data model?).
5. How the learning system is made *visible* without becoming spammy or judgmental.

This document proposes **four distinct UI architectures**, recommends a hybrid, and lists the questions we need to answer to lock the design.

---

## 1. Design Principles (proposed)

Before layout, the principles. If we disagree on these, the layout argument is unwinnable.

1. **Instrument before app.** The default state should feel like opening a synth, not a dashboard. Sound is one gesture away — never two screens away.
2. **The sketch is the document.** Everything else (synth state, randomness session, learning signals) hangs off a sketch. There is no "untitled new project" friction.
3. **Capture is sacred.** From any screen, on any device, recording an idea is one tap. The capture surface is the only thing that *must* work on a phone walking down the street.
4. **Randomness is steerable, not a button.** The Box of Randomness is a persistent surface with weighted axes, not a "surprise me" button. Users should be able to nudge chaos in real time.
5. **Memory is honest.** The user can always see *what the system has learned about them* and *why a suggestion appeared*. No black box.
6. **2D first, 3D as delight.** Every parameter has a reliable 2D control. 3D adds expressiveness on top, never replaces.
7. **Two contexts, one model.** Phone-on-the-move and desktop-in-the-studio are different *surfaces* over the same data and the same engine.
8. **No modal dead-ends.** You can always hear the last thing you made. The synth never goes silent because you opened a settings panel.

---

## 2. Core UX Tensions to Resolve

These are the conflicts the layout has to mediate. Naming them explicitly keeps us honest.

| Tension | Side A | Side B |
|--|--|--|
| **Entry point** | Open straight into Journal (review-first) | Open straight into Synth (play-first) |
| **Information density** | Feed-style Journal (low density, scannable) | Instrument panel (high density, dense controls) |
| **Box of Randomness placement** | Its own room (focused, ceremonial) | Always-on side panel (ambient, steerable) |
| **Mobile vs desktop** | Same UI, responsive | Two different "modes" of the app |
| **Sketch ↔ session** | One sketch = one synth state | A sketch is independent of which synth made it |
| **Learning visibility** | Quiet background process | Explicit, surfaced "your taste" view |
| **Performance vs editing** | Live-jam mode vs precise-edit mode as separate views | Single surface that handles both |

---

## 3. The Atomic Flow: Sketch Lifecycle

Every layout proposal must support this flow without friction. If a proposal makes any step take more than one gesture, it loses.

```
   [idle/empty]
        │
        ▼
   ┌────────────┐
   │  CAPTURE   │   ← one tap from anywhere (voice / hum / play / text)
   └─────┬──────┘
         │  (auto-creates a sketch)
         ▼
   ┌────────────┐
   │   PLAY /   │   ← the synth + recorder become "loaded" with this sketch
   │   JAM      │
   └─────┬──────┘
         │
         ▼
   ┌────────────┐
   │  MUTATE    │   ← Box of Randomness offers variations; user steers
   └─────┬──────┘
         │
         ▼
   ┌──────────────────────────┐
   │  KEEP / MUTATE / DISCARD │   ← the learning signal
   └──────────────┬───────────┘
                  │
                  ▼
            [Journal entry]
```

This loop is the heartbeat of the product. **Everything in the UI exists to make this loop fast, expressive, and addictive.**

---

## 4. UI Architecture Proposals

Four distinct shapes. Each is internally consistent; the question is which best serves the loop above.

### Proposal A — "Three Rooms"

Three full-screen modes, switchable via a persistent left rail or top tab:

- **Journal** (review your sketches, search, filter, listen)
- **Studio** (the synth + recorder + 3D delight surfaces)
- **Lab** (Box of Randomness as its own focused space)

```
┌──────────────────────────────────────────────────────┐
│ [J] [S] [L]   chaos tone               user · ●●●    │
├──────────────────────────────────────────────────────┤
│                                                      │
│                                                      │
│                  ACTIVE ROOM CONTENT                 │
│                                                      │
│                                                      │
├──────────────────────────────────────────────────────┤
│  ◉ REC   ▶ playing: "morning hum 3"     mutate ▸     │
└──────────────────────────────────────────────────────┘
```

**Strengths**
- Clean mental model. Each room has a clear purpose.
- Easy to design each room independently — good for early team velocity.
- The bottom "now playing / record" strip preserves principle #8 (no silent dead-ends).

**Weaknesses**
- Switching rooms breaks the *instrument* feel — every transition feels like changing apps.
- Box of Randomness as a "destination" makes it ceremonial rather than ambient. May reduce how often users reach for it.
- Cross-room context (e.g., loading a Journal sketch into the Studio) requires explicit handoffs.

---

### Proposal B — "One Workbench"

A single canvas with everything visible: Journal as a left drawer, Synth as the center, Box of Randomness as a right panel, transport at the bottom.

```
┌───────────┬──────────────────────────────┬───────────┐
│ JOURNAL   │                              │  CHAOS    │
│ ───────   │                              │  ──────   │
│ ▸ hum 3   │                              │ chaos ▓▓▒ │
│ ▸ hum 2   │      SYNTH / 3D STAGE        │ struct▓░░ │
│ ▸ idea 7  │      (active sketch)         │ timbre▓▓░ │
│ ▸ ...     │                              │ glue ▓▒░ │
│           │                              │           │
│ + new     │                              │ [mutate]  │
├───────────┴──────────────────────────────┴───────────┤
│  ◉ REC    ▶ ▮▮ ◀◀ ▶▶    knobs / pads / keyboard      │
└───────────────────────────────────────────────────────┘
```

**Strengths**
- Feels like a real instrument console. Nothing more than a glance away.
- The Box of Randomness is *ambient* — steerable mid-jam, as principle #4 requires.
- Journal stays peripherally visible — encourages revisiting old sketches.

**Weaknesses**
- Dense. On 13" laptops it gets cramped; on phones it's untenable without major redesign.
- Risk of "cockpit overwhelm" for new users — violates principle #1's *fall into it* quality.
- Hard to give any single feature room to breathe (esp. 3D delight surfaces).

---

### Proposal C — "Sketch-Centric Canvas"

The open sketch *is* the workspace. Journal is a collapsible launcher (think: Cmd-K palette + recent list). The synth, controls, and randomness surfaces all attach to the *active sketch* in the center. No "rooms" — only one stage, contextualized by what sketch is loaded.

```
┌────────────────────────────────────────────────────────┐
│ ⌘K  morning hum 3 · 4 bars · A minor       ⓘ taste ▸  │
├────────────────────────────────────────────────────────┤
│                                                        │
│              waveform / 3D delight stage               │
│            (the sketch as a living object)             │
│                                                        │
├────────────────────────────────────────────────────────┤
│ ╔══ INSTRUMENT ══╗  ╔══════ CHAOS ══════╗              │
│ ║ knobs · pads   ║  ║ chaos · structure ║              │
│ ║ envelope · fx  ║  ║ timbre · glue     ║              │
│ ╚════════════════╝  ╚═══════════════════╝              │
├────────────────────────────────────────────────────────┤
│  ◉ REC   ▶  keep  mutate  discard       next ▸        │
└────────────────────────────────────────────────────────┘
```

The Journal is reached via `⌘K` or a swipe-from-edge — it surfaces *as needed*, not as a destination. The keep/mutate/discard ritual is built into the bottom bar.

**Strengths**
- The flow in §3 maps directly onto the UI — there's literally one stage for the loop.
- Box of Randomness sits beside the instrument, both feeding the same sketch — exactly the relationship the vision describes.
- Generalizes cleanly to mobile (collapse instrument panel, keep stage + transport).
- "Instrument before app" wins decisively.

**Weaknesses**
- Discovery cost — newcomers don't immediately see the Journal as a pillar. Needs onboarding.
- Multi-sketch comparison (A/B between two ideas) needs a deliberate UX (tabs? split view?).
- Without a visible Journal, the *archive* feeling of vision.md ("commuting capture") might be under-served.

---

### Proposal D — "Adaptive Two-Surface"

Explicitly acknowledges two contexts and designs different surfaces over the same data/engine.

- **Capture Surface (mobile-first, always available)**: A huge record button, voice note list, hum-to-melody, text scratchpad. Optimized for one-handed, half-awake, sub-3-second-to-recording. Maybe even a PWA shortcut that opens directly here.
- **Studio Surface (desktop-first)**: Either Proposal B or C above. The full creative environment.

The surfaces share: auth, sketch database, learning model, sync. They diverge: layout, control density, what's reachable.

```
   MOBILE (Capture)              DESKTOP (Studio)
┌──────────────────┐         ┌─────────────────────────┐
│                  │         │  full instrument panel  │
│   ●  TAP TO REC  │         │  + journal + chaos      │
│                  │         │  + 3D stage             │
│  recent: hum 3   │         │                         │
│  recent: idea 7  │         │                         │
└──────────────────┘         └─────────────────────────┘
```

**Strengths**
- Honest about the two real-world contexts — no compromise UI that fails both.
- Capture stays a sacred, no-friction surface (principle #3).
- Each surface can be optimized aggressively for its context.

**Weaknesses**
- Two UIs to design and maintain — Alpha velocity cost.
- Risk of the mobile surface feeling like a "lite version" rather than a peer.
- Users on tablets / iPad split the difference awkwardly.

---

## 5. Direction Chosen — Proposal B ("One Workbench") + deferred mobile

**Decision (2026-05-18)**: We are building **Proposal B** for Alpha desktop. Proposal D's separate mobile capture surface is **acknowledged but deferred** — not part of Alpha scope, but kept in mind so the architecture doesn't preclude it.

Implication: Chaos Tone's identity is a **single console where Journal, Instrument, Chaos, and Transport all live in peripheral view at once**. Nothing is more than a glance away. This is the "instrument cockpit" mental model.

What this commits us to:

- **Desktop-first.** The first build assumes a laptop or larger screen. Mobile is *not* a responsive degradation in Alpha — it's a future, deliberately-designed surface.
- **Density is the central design challenge.** B's biggest risk is cockpit overwhelm. The visual language, progressive disclosure, and "focus modes" (see §7) exist primarily to mitigate this.
- **Journal is always visible.** This makes the archive a constant gentle invitation to return to old ideas — not a destination you navigate to.
- **Box of Randomness is ambient.** It steers chaos *while* you're playing, not as a ceremonial mode.

What we are explicitly **not** doing in Alpha:

- A separate `/capture` route or mobile surface (deferred per D).
- Responsive shrinking of B onto phones (would compromise the cockpit feel; better to wait and design mobile properly).
- The 3D "stage" as a dominant element — it lives between the panels and earns space when needed (see §7).

---

## 6. Page / Route Inventory (under Proposal B)

Under B, there is essentially **one page that matters** — the Workbench. Everything else is auxiliary.

| Route | Purpose |
|---|---|
| `/` | The Workbench. Loads with last active sketch. This is where ~95% of user time is spent. |
| `/sketch/[id]` | The Workbench, loaded with a specific sketch. Shareable / bookmarkable. |
| `/memory` | "Your taste" view — what the system has learned about you. Honest learning surface (principle #5). |
| `/settings` | Account, audio device, AI provider, data export, consent toggles. |
| `/auth/*` | Supabase auth flows. |

**Notes**
- The full-screen `/journal` page from Proposal C is **not needed** under B — the Journal *is* the left panel, always visible. Deep search happens inline via the palette / search input within that panel.
- No `/capture` route — under B you're always one click from REC in the persistent transport.
- No `/random` or `/chaos` route — Box of Randomness lives in the right panel, attached to whatever sketch is loaded.
- `/memory` could be a modal overlay on the Workbench rather than a separate page. Open question (§11).

---

## 7. Component Regions (the Workbench — Proposal B)

The Workbench is divided into **five named regions**. Every UI component lives in exactly one region. This is the canonical layout we'll wireframe and build against.

```
┌─────────────────────────────────────────────────────────────────────┐
│ TopBar:  logo · sketch title/meta · ⌘K palette · taste · user       │
├──────────────┬───────────────────────────────────────┬──────────────┤
│ JOURNAL      │                                       │ CHAOS        │
│ (left rail)  │           STAGE                       │ (right rail) │
│              │                                       │              │
│ search…      │  - waveform / spectrum / 3D delight   │ axis sliders │
│ ───────      │  - playhead, loop region              │  Chaos    ▓▒ │
│ ▸ hum 3      │  - sketch title overlay (subtle)      │  Structure▓▒ │
│ ▸ hum 2      │                                       │  Timbre   ▓▓ │
│ ▸ idea 7     │                                       │  Glue     ▒░ │
│ ▸ ...        │                                       │  Temp     ▓░ │
│              │                                       │              │
│ tags · ai    │                                       │ mutate ▸     │
│              │                                       │ lock ▢ ▢ ▢   │
│ + new sketch │                                       │ history ▾    │
├──────────────┴───────────────────────────────────────┴──────────────┤
│ INSTRUMENT (full width)                                              │
│  voice ▾   knobs · macros · envelope · filter · fx chain            │
├──────────────────────────────────────────────────────────────────────┤
│ TRANSPORT:  ◉ REC   ▶ ▮▮ ◀◀ ▶▶  loop   A/B   keep · mutate · discard │
└──────────────────────────────────────────────────────────────────────┘
```

**Why Instrument is full-width-below, not center**

Under B, the original sketch placed Instrument in the center. I'm proposing we instead put **Stage in the center** and **Instrument as a full-width strip below it**. Reasons:

- Knob/pad rows want horizontal space — they tile much better in a wide strip than a square center.
- The Stage benefits from a square-ish area for waveform/3D — center column gives it that.
- The eye reads top→bottom: see what's playing (Stage) → reach for the controls that change it (Instrument). This matches how a hardware synth is laid out.

This is the most arguable structural choice in B. If you'd rather have Instrument in the center (a more "controller-first" feel), say so and we'll flip it.

**Regional responsibilities**

- **TopBar** — identity, sketch metadata, `⌘K` palette (semantic search, navigation), "taste" badge that opens the Memory view, user menu.
- **Journal (left rail)** — vertical list of sketches, newest at top. Inline search input. Tag filters and AI-generated similarity links. New-sketch button at the bottom. Fixed width by default (~280px), but resizable / collapsible to a thin strip showing just dots-per-sketch.
- **Stage (center)** — the *visual* of the current sound. Default 2D waveform + spectrum. Optional 3D delight mode (Threlte) that takes over the center column without expanding into the panels. A "focus mode" key (e.g. `F`) collapses both side panels and lets the Stage fill the screen for delight moments.
- **Chaos (right rail)** — the steerable Box of Randomness. Axes from vision.md as vertical sliders with weight, lock toggles, and a mutation history list. `mutate ▸` triggers a generation pass; results play inline and can be kept/discarded.
- **Instrument (bottom strip, full width)** — voice selector, macro knobs, envelope, filter, FX chain. Expandable sections for granular/wavetable. Designed to look like a real instrument's front panel.
- **Transport (footer)** — REC, play/pause/scrub, loop, A/B toggle, and the **keep / mutate / discard** ritual. These three are visually adjacent because the *choice between them* is the learning signal.

**Progressive disclosure (to fight cockpit overwhelm)**

This is the key tactic for keeping B from feeling like an airline cockpit:

- **Default state**: each panel shows only its most-used controls. Instrument shows macro knobs, not the full envelope graph. Chaos shows 4–5 axes, not 12. Journal shows recent + search.
- **Expand on intent**: click a panel header → it deepens (more knobs revealed, more axes shown). Click again → collapses.
- **Focus mode** (`F` key or button): hide both side rails, leaving Stage + Transport. For delight moments, performance, or screenshots.
- **Beginner / Expert toggle** (future): not Alpha-day-one, but the panels should be built so this is possible later.

---

## 8. Mobile (Deferred)

Mobile is **out of scope for Alpha**. The Workbench is desktop-only in the first build.

**What we'll do anyway** to avoid painting ourselves into a corner:

- Keep the data layer, auth, and engine entirely surface-agnostic. The Workbench is one consumer of the underlying stores; future mobile surfaces will be other consumers.
- Treat the Workbench layout as a single composition rather than a system of breakpoints. We won't waste time making it "kind of work" on a phone — better to design a real mobile capture surface later.
- Document the future mobile direction (Proposal D — a dedicated Capture Surface, not a shrunken Workbench) so the team remembers the plan.

**Minimum viable degradation** for small screens in Alpha: show a "Chaos Tone is desktop-only for now — open on a laptop or larger screen" message. This is the honest move; a half-broken responsive layout would be worse than a clear message.

---

## 9. Key Flow Walkthroughs

Quick sanity checks: can each canonical user moment happen without friction on the Workbench?

**Flow 1 — Quick desktop capture**
1. User opens app → `/` loads the Workbench with last active sketch.
2. Hits REC in the transport (or `R` keystroke). Plays/hums/sings for a few seconds. Hits stop.
3. A new sketch entry appears at the top of the Journal panel on the left, auto-titled and auto-tagged. The Stage now shows its waveform.
4. No modal, no "save?" dialog. The capture *is* the save.

**Flow 2 — Studio jam**
1. From the Journal (left), user clicks an older sketch → Stage + Instrument + Chaos all rehydrate to that sketch's state.
2. Hits REC, plays 8 bars over the loaded synth state.
3. Nudges the Chaos slider up; clicks `mutate ▸` — system proposes a variation playing inline.
4. Likes it → clicks `keep` in the transport. The variation is merged into the sketch; the preference signal is logged.

**Flow 3 — "What was that thing I made last Tuesday?"**
1. Types in the Journal search box (or `⌘K`) → "minor melody breakbeat" → semantic search via pgvector.
2. The Journal list narrows; arrow keys preview each result inline (audio plays in Stage).
3. Click loads it fully — Instrument and Chaos panels rehydrate.

**Flow 4 — Auditing what the system learned**
1. User clicks the "taste" badge in TopBar → Memory view opens (modal overlay or `/memory` page — TBD per §11).
2. Sees: weighted axes inferred from past sessions, top kept-vs-discarded examples, a "reset" option.
3. Can disable specific learned preferences with a toggle (principle #5).

**Flow 5 — Delight / focus moment**
1. Mid-jam, user wants to *see* the sound. Presses `F` (or clicks the focus button).
2. Journal and Chaos panels slide away; the Stage expands to fill the screen, 3D delight surfaces taking over.
3. Transport remains pinned at the bottom — playback never interrupts.
4. Press `F` again → panels slide back.

If any of these flows feels wrong, the layout needs to change before we write code.

---

## 10. Visual Language Notes (early, non-binding)

- **Palette**: deep neutrals (charcoal, warm black) with one or two saturated accent colors that *move with the music* (driven by Tone.js analyzers). Aesthetic reference: vintage synths + modern terminal UIs.
- **Typography**: monospace for parameters/values; humanist sans for prose (sketch titles, journal entries).
- **Motion**: motion is reactive, not decorative. UI elements vibrate / pulse in response to audio analysis, not on a timer.
- **3D**: never "shiny demo" 3D. The delight surfaces should feel like *physical artifacts* — dusty, weighted, slightly imperfect — to match the "analog instrument" aesthetic from alpha-tech-stack §3.
- **No emoji in product chrome.** The aesthetic is instrument, not consumer app.

---

## 11. Open Questions (the point of this doc)

Now that we've committed to Proposal B (desktop, deferred mobile), the questions are sharper. Numbered so we can answer inline.

### B-specific layout questions
1. **Center column — Stage or Instrument?** I'm proposing Stage in the center, Instrument as a full-width strip below it (§7). Do you agree, or would you rather Instrument occupy the center?
2. **Panel sizing** — Fixed-width side rails (e.g., Journal 280px, Chaos 320px), or user-resizable? Saved per user, or session-only?
3. **Panel collapse behavior** — Should Journal/Chaos collapse to a thin icon strip (still visible) or hide entirely when collapsed? My instinct is thin strip — preserves principle #1.
4. **Focus mode** — Does the `F` key idea (hide both side panels for Stage takeover) feel right, or should focus mode also hide the Instrument strip?
5. **Stage 3D from day one, or 2D-first?** Threlte adds bundle weight and complexity. A possible path: ship 2D waveform/spectrum for the first playable build, add 3D delight in the second pass.

### Journal panel
6. **Journal density** — Each sketch row shows: title + tiny waveform + tags + time? Or just title + time, with hover-to-reveal more?
7. **Inline preview** — Should hovering / arrow-keying a Journal row preview-play in Stage immediately? Risk: noisy if user is mid-jam.
8. **Filters & tags** — Where do they live? Inline above the search? A drawer that opens from the panel header?

### Instrument panel
9. **Default voice** — What does the user hear when they first open the app? Should there be a default "starter synth" preset, or silence until they pick a voice?
10. **Voice-switching mid-sketch** — Can a sketch's instrument change after recording? (Decides whether sketch = audio recording, or sketch = parameter graph that's re-renderable.)
11. **Macro-vs-detailed knobs** — Start with 4–6 macro knobs that map to many params under the hood, or expose detailed envelope/filter/fx from the start?

### Chaos panel
12. **Axis count & names** — Vision.md lists Chaos, Structure, Timbre Surprise, Rhythmic Glue, Emotional Temperature, "etc." What's the actual starting set for Alpha — 4? 6? 8?
13. **`mutate ▸` behavior** — Does it generate one variation, or N variations to compare? Does it auto-play or wait for user to hit play?
14. **Locks** — Per-axis lock toggles ("don't change timbre") — confirm this is desired? (Standard in generative tools but worth confirming.)
15. **Local vs cloud generation** — In Alpha, does `mutate` always call the cloud (Supabase Edge → OpenRouter), or is there a "local-only fast mutate" mode?

### Transport & ritual
16. **Keep / mutate / discard** — Explicit three-button ritual after each pass (my proposal), or implicit (close-without-saving = discard, hit-record-again = mutate)?
17. **A/B comparison** — Worth building in Alpha (toggle between two versions of the same sketch), or skip until v1?
18. **Looping** — Hardware-style loop region (set in/out points on the timeline) from day one?

### Navigation & routes
19. **`/memory` — modal or page?** Modal keeps the Workbench in view but limits surface area; page is a context switch. My lean: modal in Alpha, promote to page if it grows.
20. **`⌘K` palette scope** — Just navigation + search, or also commands ("mutate", "toggle focus mode", "switch voice")? Power-user feature; could be Alpha or v1.
21. **Shareable sketch URLs** — Build `/sketch/[id]` routes in Alpha (even if sharing UI comes later), or skip routing entirely?

### Learning surface
22. **Memory transparency** — How much to expose? Slider weights? Source sketches? A "why this suggestion" tooltip?
23. **Consent UI** — Where does the "send my data to the cloud for learning" toggle live? Onboarding? Settings? Both?

### Aesthetic & feel
24. **Visual reference** — Any synths, apps, films, or instruments you want us to feel like? (Affects palette, motion, typography.) Examples to react to: Ableton, Teenage Engineering OP-1, Endlesss, Korg Volca, vintage analog gear, Blade Runner UIs, terminal aesthetics.
25. **Dark mode only**, or both? Most creative tools are dark-only; worth confirming.
26. **UI sound effects** — Do UI interactions (clicks, panel opens) make small sounds, or is the app silent until *you* make sound?

### Scope guardrails
27. **What's explicitly out of Alpha UI scope?** — Collaboration, public sharing, performance/live mode, hardware MIDI mapping screens, multi-project organization. Confirm which of these we're *not* designing for now so layout decisions don't try to accommodate them.

---

## 12. Next Steps

Once we've answered enough of §11 to commit to a direction, the proposed sequence is:

1. **Wireframes** (low-fi) of the chosen architecture — one per route, both desktop and mobile.
2. **Interactive prototype** of the studio canvas — focus on the sketch lifecycle loop (§3) with stub audio.
3. **First playable build** wiring the prototype to Tone.js + Supabase per alpha-tech-stack.md.
4. **Internal use** for ~2 weeks — every team member should be making sketches daily before we commit to the layout.

---

**This document is a starting frame, not a verdict.** The right Chaos Tone UI will emerge from playing with prototypes, not from arguing on paper — but the better we frame the arguments now, the faster the prototypes converge.
