// src/lib/audio/voice.ts
//
// The proof-of-life voice: one holdable sine, its frequency bound to
// `frequencyStore`. This replaces Phase 6's throwaway test-tone.ts — the tone
// is now holdable (triggerAttack/triggerRelease instead of a 200 ms one-shot)
// precisely so you can turn the knob WHILE it sounds and hear the store →
// Tone.js binding work. v0.2's real voices (envelope, filter, presets) start
// from this file.
//
// Same lazy rules as context.ts: no top-level `tone` import; the synth is
// created on first use, after ensureAudioStarted() has run inside a gesture.

import { ensureAudioStarted } from './context';
import { frequencyStore } from '$stores/instrument-params';
import type * as ToneModule from 'tone';

let synth: ToneModule.Synth | null = null;
let holding = false;

async function ensureVoice(): Promise<ToneModule.Synth> {
	const Tone = await ensureAudioStarted();
	if (!synth) {
		synth = new Tone.Synth({ oscillator: { type: 'sine' } }).toDestination();
		// Bind once for the synth's lifetime — every store write from here on
		// ramps synth.frequency (20 ms default; kills zipper noise). The unbind
		// handle is deliberately unused: this voice is never disposed.
		frequencyStore.bindTo(synth.frequency);
	}
	return synth;
}

/**
 * Start holding the tone at the store's current frequency. Must be called
 * from a user gesture (it may be the first thing to start the AudioContext).
 * Idempotent while holding.
 */
export async function startVoice(): Promise<void> {
	const voice = await ensureVoice();
	if (holding) return;
	holding = true;
	voice.triggerAttack(frequencyStore.value);
}

/** Release the held tone. Safe to call when nothing is sounding. */
export function stopVoice(): void {
	if (!holding) return;
	holding = false;
	synth?.triggerRelease();
}
