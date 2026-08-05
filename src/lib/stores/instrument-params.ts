// src/lib/stores/instrument-params.ts
//
// Param stores for the proof-of-life instrument voice (src/lib/audio/voice.ts).
// One store per parameter — the store IS the contract between the Knob in
// InstrumentPanel, the readout in Stage, and the Tone.js signal in voice.ts.
// v0.2's real voices add their stores here (or split per-voice when it grows).

import { createParamStore } from './create-param-store.svelte';

/**
 * Oscillator frequency. A2–A5 with A4 (440 Hz) as the resting default.
 * 'log' curve so the knob spaces octaves evenly — equal turns, equal
 * intervals — instead of cramming three octaves into the first half-turn.
 */
export const frequencyStore = createParamStore({
	label: 'Frequency',
	unit: 'Hz',
	min: 110,
	max: 880,
	defaultValue: 440,
	curve: 'log'
});
