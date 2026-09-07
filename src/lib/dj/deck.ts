// src/lib/dj/deck.ts
//
// Browser-only Virtual DJ placeholder deck. Lazy Tone import via ensureAudioStarted
// (user gesture required). Applies polled session energy/mute/gain/filter to
// cheap per-role oscillators — WAV stems later drop behind the same role API.

import { ensureAudioStarted } from '$lib/audio/context';
import { ROLE_IDS, type DjSession, type RoleId } from './session';
import type * as ToneModule from 'tone';

type ToneSrc = ToneModule.Oscillator | ToneModule.Noise;

interface RoleVoice {
	gain: ToneModule.Gain;
	filter: ToneModule.Filter;
	src: ToneSrc;
	started: boolean;
}

const ROLE_OSC: Record<
	RoleId,
	{ type: 'sine' | 'triangle' | 'square' | 'sawtooth' | 'noise'; freq?: number }
> = {
	kick: { type: 'sine', freq: 55 },
	bass: { type: 'sawtooth', freq: 82 },
	hats: { type: 'square', freq: 880 },
	perc: { type: 'triangle', freq: 220 },
	chords: { type: 'triangle', freq: 196 },
	vox: { type: 'sine', freq: 330 },
	fx: { type: 'noise' }
};

let Tone: typeof ToneModule | null = null;
let voices: Partial<Record<RoleId, RoleVoice>> = {};
let master: ToneModule.Gain | null = null;
let running = false;
let barLoopId: number | null = null;
let localBar = 0;
let lastAppliedRevision = -1;
let pendingSession: DjSession | null = null;
let onBar: ((bar: number) => void) | null = null;

function disposeVoices(): void {
	for (const id of ROLE_IDS) {
		const v = voices[id];
		if (!v) continue;
		try {
			v.src.stop();
			v.src.dispose();
			v.filter.dispose();
			v.gain.dispose();
		} catch {
			/* already disposed */
		}
	}
	voices = {};
	if (master) {
		try {
			master.dispose();
		} catch {
			/* ignore */
		}
		master = null;
	}
}

async function ensureGraph(): Promise<void> {
	Tone = await ensureAudioStarted();
	if (master) return;

	master = new Tone.Gain(0.6).toDestination();

	for (const id of ROLE_IDS) {
		const spec = ROLE_OSC[id];
		const gain = new Tone.Gain(0);
		const filter = new Tone.Filter(2000, 'lowpass');
		filter.connect(gain);
		gain.connect(master);

		let src: ToneSrc;
		if (spec.type === 'noise') {
			src = new Tone.Noise('pink');
			src.connect(filter);
		} else {
			src = new Tone.Oscillator(spec.freq ?? 220, spec.type);
			src.connect(filter);
		}

		voices[id] = { gain, filter, src, started: false };
	}
}

function effectiveMute(session: DjSession, id: RoleId): boolean {
	const anySolo = ROLE_IDS.some((r) => session.roles[r].solo);
	const role = session.roles[id];
	if (role.mute) return true;
	if (anySolo && !role.solo) return true;
	return false;
}

function applyNow(session: DjSession): void {
	if (!Tone || !master) return;

	Tone.getTransport().bpm.value = session.bpm;
	master.gain.rampTo(0.35 + session.energy * 0.4, 0.05);

	for (const id of ROLE_IDS) {
		const v = voices[id];
		if (!v) continue;
		const role = session.roles[id];
		const muted = effectiveMute(session, id);
		const target = muted ? 0 : role.gain * (0.3 + session.energy * 0.7) * 0.15;
		v.gain.gain.rampTo(target, 0.08);

		const cutoff = 200 + role.filter * 6000;
		v.filter.frequency.rampTo(cutoff, 0.1);

		if (!v.started) {
			v.src.start();
			v.started = true;
		}
	}

	lastAppliedRevision = session.revision;
	pendingSession = null;
}

function scheduleApply(session: DjSession): void {
	if (session.revision === lastAppliedRevision) return;
	if (!running) {
		pendingSession = session;
		return;
	}
	if (session.apply_at_bar <= localBar) {
		applyNow(session);
		return;
	}
	pendingSession = session;
}

/**
 * Start the placeholder deck. MUST be called from a user gesture (Start click).
 */
export async function startDeck(opts?: { onBar?: (bar: number) => void }): Promise<void> {
	onBar = opts?.onBar ?? null;
	await ensureGraph();
	if (!Tone) throw new Error('Tone failed to load');

	if (!running) {
		localBar = 1;
		Tone.getTransport().bpm.value = 122;
		Tone.getTransport().start();
		running = true;

		const secondsPerBar = () => (60 / Tone!.getTransport().bpm.value) * 4;
		const tick = () => {
			if (!running || !Tone) return;
			localBar += 1;
			onBar?.(localBar);
			if (pendingSession && pendingSession.apply_at_bar <= localBar) {
				applyNow(pendingSession);
			}
			barLoopId = window.setTimeout(tick, secondsPerBar() * 1000);
		};
		barLoopId = window.setTimeout(tick, secondsPerBar() * 1000);
	}

	if (pendingSession) scheduleApply(pendingSession);
}

export function stopDeck(): void {
	running = false;
	if (barLoopId !== null) {
		clearTimeout(barLoopId);
		barLoopId = null;
	}
	if (Tone) {
		try {
			Tone.getTransport().stop();
			Tone.getTransport().cancel();
		} catch {
			/* ignore */
		}
	}
	disposeVoices();
	lastAppliedRevision = -1;
	pendingSession = null;
}

/** Push the latest polled session into the deck (bar-quantized when possible). */
export function applySession(session: DjSession): void {
	scheduleApply(session);
}

export function isDeckRunning(): boolean {
	return running;
}

export function getLocalBar(): number {
	return localBar;
}
