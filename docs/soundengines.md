Here's a clear **lay of the land** for sound engines / synthesis methods. I’ve grouped them by relevance to a **Chaos Tone**-style tool (sketching, jamming, structured randomness, browser-friendly).

### 1. Classic Synthesis Methods (Great for Real-Time, Tactile Control & Randomness)

| Method              | How it Works                              | Strengths for Chaos Tone                          | Browser / Real-Time Fit | Examples / Libraries |
|---------------------|-------------------------------------------|----------------------------------------------------|-------------------------|----------------------|
| **Subtractive**    | Rich waveform (saw/square) → filters, envelopes | Intuitive, "analog" warmth, easy to mutate       | Excellent              | Tone.js Synth, Web Audio Oscillators |
| **FM Synthesis**   | One oscillator modulates another's frequency | Complex, metallic, evolving timbres; great for randomness | Very good              | Tone.FMSynth |
| **Wavetable**      | Scans through a table of waveforms        | Smooth morphing, modern electronic sounds         | Excellent              | Tone.WaveTable or custom buffers |
| **Granular**       | Breaks sound into tiny "grains" & rearranges | Textural chaos, time-stretching, mangling        | Good (with care)       | Tone.GrainPlayer, custom |
| **Additive**       | Stacks sine waves / partials              | Precise harmonic control, bell-like tones         | Good                   | Custom with many oscillators |
| **AM / Ring Mod**  | Amplitude modulation                      | Metallic, sideband-heavy textures                 | Excellent              | Tone.AMSynth |
| **Physical Modeling** | Simulates real instruments (strings, tubes) | Organic, responsive "alive" feel                  | Medium (CPU heavy)     | Less common in pure JS |
| **Sample-based / Wavetable + Samples** | Playback + manipulation of recorded audio | Realistic + manglable; perfect for journal import | Excellent              | Tone.Player + effects |

**Recommendation for MVP**: Start with **Tone.js** as the core engine — it already includes most of the above (Synth, FMSynth, AMSynth, PolySynth, granular-ish players, effects chain, sequencing). It's battle-tested for browser music apps.

### 2. Modern / Hybrid Approaches (Perfect for "Box of Randomness")

- **Modular / Node-based**: Patch together oscillators, filters, effects like a mini modular synth. Easy to randomise connections or parameters.
- **Vector / Phase Distortion / Waveshaping**: Extra flavour layers on top of the basics.
- **Concatenative / Corpus-based**: Stitch real audio snippets based on similarity (great for "in your style" generation).
- **Rule-based + Procedural**: Markov chains, L-systems, genetic algorithms for evolving patterns. Lightweight and fully offline.

### 3. AI / Generative Audio (For High-Level Creativity & Learning Your Style)

- **Local / On-device (emerging 2025–2026)**: Tiny models via Transformers.js, ONNX, or WebNN. Magenta.js (Google), Stable Audio Open Small, or distilled MusicGen variants. Good for offline randomness and style adaptation.
- **API-driven (your starting point)**: OpenRouter + models like MusicGen (Meta AudioCraft), Stable Audio, or newer local-first ones (YuE, DiffRhythm, Magenta RealTime). Use for melody continuation, variation generation, or "remix this sketch in my learned style."
- **Hybrid**: Use AI for macro decisions (structure, harmony suggestions) and classic synth for micro details and low-latency playability.

**Transcription layer** (hum → usable melody):
- Pitch detection: Web Audio + libraries like Pitchy or Meyda.
- Melody → MIDI/notes: Simple autocorrelation or API (Whisper + post-processing).
- Full audio-to-MIDI: Neural Note (open-source) or similar for polyphonic later.