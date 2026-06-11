// src/lib/audio/context.ts
//
// Audio lifecycle for Chaos Tone.
//
// RULES (see docs/executing/phase-6-implementation.md §1):
//   - Tone.js is loaded via dynamic import INSIDE ensureAudioStarted(), never at
//     module top level — this keeps Tone out of the initial bundle and out of SSR.
//   - Tone.start() / AudioContext resume must be triggered by a user gesture.
//
// Latency tunables (left at Tone defaults for now; revisit with the first real voice):
//   - Tone.getContext().lookAhead        default 0.1s  — scheduling safety margin
//   - new Tone.Context({ latencyHint })  'interactive' trades buffer size for latency

import type * as ToneModule from 'tone';

let tone: typeof ToneModule | null = null;
let started = false;

/** Synchronous feature check — safe to call during SSR (guards on `window`). */
export function isAudioSupported(): boolean {
	return (
		typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window)
	);
}

/**
 * Lazily load Tone and start the AudioContext. MUST be called from within a user
 * gesture (e.g. a click handler). Idempotent — the import and Tone.start() each
 * happen at most once. Returns the loaded Tone module so callers can build nodes.
 */
export async function ensureAudioStarted(): Promise<typeof ToneModule> {
	if (!tone) {
		tone = await import('tone');
	}
	if (!started) {
		await tone.start();
		started = true;
	}
	return tone;
}
