// src/lib/audio/test-tone.ts
//
// Temporary proof-of-life tone. Phase 7 replaces the hardcoded 440 Hz with a value
// read from a param store. This whole file is expected to shrink/move then.

import { ensureAudioStarted } from './context';
import type * as ToneModule from 'tone';

let synth: ToneModule.Synth | null = null;

/** Play a 200 ms sine at 440 Hz. Starts the audio context on first call. */
export async function playTestTone(): Promise<void> {
	const Tone = await ensureAudioStarted();
	if (!synth) {
		synth = new Tone.Synth({ oscillator: { type: 'sine' } }).toDestination();
	}
	synth.triggerAttackRelease(440, 0.2); // 440 Hz, 200 ms — envelope avoids clicks
}
