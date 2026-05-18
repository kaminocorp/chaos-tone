**Chaos Tone**  
*Trainable offline music sketchbook + creative companion*

### Vision
**Chaos Tone** is a personal music idea incubator. It combines a always-available **Journal**, a playable **Synth/Recorder**, and a smart **Box of Randomness** that learns your unique creative habits and offers structured, high-quality chaos instead of generic noise.

It is deliberately **not** a full DAW. It is built for the earliest, most fragile stages of music making — when you’re walking, commuting, or half-awake — and for playful studio sketching. You capture raw ideas, manipulate them with physical-style controls, and let the system gradually learn your taste so it can surprise and inspire you productively.

Key philosophy:  
- Start as an empty slate and grow into *your* co-creator.  
- Full offline mode is sacred.  
- Structured randomness you can steer (timbre, rhythm, harmony, structure, micro-details, etc.).  
- Browser-first for rapid development and sharing, with native/hardware paths later.

### Core Pillars
1. **Journal** — Quick capture of voice notes, hummed melodies, text concepts, short recordings. Automatic transcription and melody detection.
2. **Recorder + Synth** — Tactile jamming interface with knobs, buttons, sliders, and grids.
3. **Box of Randomness** — Hierarchical, controllable generative engine. Learns from your keep/mutate/discard decisions and parameter habits.
4. **Memory & Evolution** — Remembers your “move grammar” and can remix old sketches intelligently.

### Technical Decisions (Already Made)

- **Platform**: Browser-based web app (progressive web app / installable) for MVP.  
- **Primary Audio Library**: Tone.js (Web Audio API foundation) + custom extensions.  
- **AI Strategy**: Hybrid & configurable  
  - Start with OpenRouter API calls (flexible model routing).  
  - Later add on-device inference (Transformers.js / ONNX / WebNN / tiny fine-tuned models).  
- **Transcription**: API-first (Whisper-based or equivalent) with Web Speech API fallback. On-device pitch detection for immediate feedback.  
- **Storage**: IndexedDB / localForage for all sketches, training data, and user models (fully offline capable).  
- **Randomness Engine**: User-weighted axes (Chaos, Structure, Timbre Surprise, Rhythmic Glue, Emotional Temperature, etc.) + learning from user actions.  
- **Development Priorities**: Speed of iteration > perfection. Keep it fun and playable from day one.  
- **Name & Repo**: `Chaos Tone`

### Open Decisions & Lay of the Land

#### 1. Core Audio Engine
- **Synthesis mix** — Which combination to prioritize first?  
  - Subtractive + FM + Wavetable (Tone.js defaults)  
  - Granular as first-class citizen  
  - Heavy sample mangling / concatenative  
  - Modular node-graph patching (like a tiny VCV Rack)
- **Effects chain** — Global vs per-voice, preset vs fully randomisable.
- **Polyphony & performance** — Target max voices / CPU budget in browser.
- **MIDI / external control** — Web MIDI support from day one?
- **Export** — Render stems, MIDI, or full WAV easily.

#### 2. User Interface & Controls
- **Control surface philosophy** — How much “knob per parameter” vs high-level macro controls?  
- **Layout ideas** —  
  - Journal feed (timeline of sketches)  
  - Main play/jam view with visual feedback  
  - Randomness dashboard (sliders for different axes)  
  - Training / memory browser
- **Input methods** — Mouse + keyboard first, touch-optimised, then hardware MIDI mapping.
- **Visual style** — Minimal/retro, modern glassmorphic, or “musical instrument” aesthetic?
- **Mobile responsiveness** — Target phone/tablet use for true “on the move” journaling?

#### 3. AI & Learning System
- **What to learn exactly** — Parameter preferences, transition habits, favourite scales/modes, structural patterns, timbre taste, etc.
- **Learning technique** — Simple statistical models + LLM prompt chaining first, later small fine-tuned models.
- **Call-and-response / live mode** — When to introduce real-time listening and generation.
- **Privacy & data** — All training data stays 100% local (except when user explicitly chooses API).

#### 4. Journal & Capture
- **Automatic processing pipeline** — Hum → pitch detection → rhythm analysis → chord suggestion → clean MIDI.
- **Multi-modal input** — Voice, text, drawing (waveform sketches?), photo of handwritten notation.
- **Search & recall** — Semantic search across all old ideas (“find sketches with descending minor melody and breakbeat”).

#### 5. Technical Architecture
- **Frontend framework** — React + Vite? Solid.js? Svelte? Pure vanilla for max lightness?
- **State management** — Zustand, Jotai, or Redux?
- **Audio scheduling** — Tone.js Transport vs custom scheduler.
- **Build & distribution** — PWA, Tauri desktop wrapper, later Electron or native iOS.
- **Testing strategy** — How to test audio reliably in CI?

#### 6. Non-Functional
- **Performance targets** — Load time < 2s, latency < 12ms for playing.
- **Accessibility** — Keyboard navigation, screen reader support for journal.
- **Internationalisation** — None at first, or basic from start?
- **Licensing** — Open source (MIT/AGPL?) or eventual commercial path?

### Suggested Initial Tech Stack (MVP)
- **Core**: Vite + React + TypeScript + Tone.js
- **UI**: Tailwind + shadcn/ui or custom component library
- **State & Storage**: Zustand + localForage / IndexedDB
- **AI Bridge**: Simple fetch wrapper for OpenRouter with local fallback stubs
- **Visualization**: Canvas/WebGL for waveform, oscilloscope, or generative visuals

### Future Roadmap (High Level)
1. Browser MVP with journal + basic synth + controllable randomness
2. Training/memory layer + style learning
3. On-device models + full offline
4. Native iOS / Android apps
5. Hardware companion device (physical knobs, speaker, battery)
6. Live performance mode (call-and-response)

---

**This document is meant to evolve.** Feel free to add sections, cross out decisions, or turn any open point into a dedicated brainstorming page.

Let’s build something musicians actually fall in love with.