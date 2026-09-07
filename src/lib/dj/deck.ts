// src/lib/dj/deck.ts
//
// Browser-only Virtual DJ placeholder deck. Lazy Tone import via ensureAudioStarted
// (user gesture required). Transport-scheduled deep-house patterns per role;
// energy → master gain + master filter darkness + role gains. WAV stems later
// drop behind the same role API.

import { ensureAudioStarted } from '$lib/audio/context';
import { ROLE_IDS, type DjSession, type RoleId } from './session';
import type * as ToneModule from 'tone';

type Disposable = { dispose: () => void };

interface RoleChain {
	gain: ToneModule.Gain;
	filter: ToneModule.Filter;
}

/** Rough root note from session.key (e.g. "Am" → A2). */
function rootNote(key: string): string {
	const m = /^([A-G][#b]?)/i.exec(key.trim());
	const raw = m?.[1];
	if (!raw) return 'A2';
	const letter = raw.charAt(0).toUpperCase() + raw.slice(1);
	return `${letter}2`;
}

function chordNotes(key: string): string[] {
	const root = rootNote(key).replace('2', '3');
	const minor = /m/i.test(key);
	// Simple triad spellings in octave 3/4 — placeholders, not theory-perfect.
	const map: Record<string, [string, string, string]> = {
		A: minor ? ['A3', 'C4', 'E4'] : ['A3', 'C#4', 'E4'],
		B: minor ? ['B3', 'D4', 'F#4'] : ['B3', 'D#4', 'F#4'],
		C: minor ? ['C3', 'Eb4', 'G4'] : ['C3', 'E4', 'G4'],
		D: minor ? ['D3', 'F4', 'A4'] : ['D3', 'F#4', 'A4'],
		E: minor ? ['E3', 'G4', 'B4'] : ['E3', 'G#4', 'B4'],
		F: minor ? ['F3', 'Ab4', 'C4'] : ['F3', 'A4', 'C4'],
		G: minor ? ['G3', 'Bb4', 'D4'] : ['G3', 'B4', 'D4']
	};
	const letter = root.charAt(0).toUpperCase();
	return map[letter] ?? ['A3', 'C4', 'E4'];
}

let Tone: typeof ToneModule | null = null;
let chains: Partial<Record<RoleId, RoleChain>> = {};
let master: ToneModule.Gain | null = null;
let masterFilter: ToneModule.Filter | null = null;
let kickSynth: ToneModule.MembraneSynth | null = null;
let bassSynth: ToneModule.MonoSynth | null = null;
let hatsSynth: ToneModule.NoiseSynth | null = null;
let percSynth: ToneModule.MetalSynth | null = null;
let chordSynth: ToneModule.PolySynth | null = null;
let voxSynth: ToneModule.Synth | null = null;
let fxSynth: ToneModule.NoiseSynth | null = null;
let loops: ToneModule.Loop[] = [];
let disposables: Disposable[] = [];
let running = false;
let barLoopId: number | null = null;
let localBar = 0;
let lastAppliedRevision = -1;
let pendingSession: DjSession | null = null;
let currentSession: DjSession | null = null;
let onBar: ((bar: number) => void) | null = null;
let patternsArmed = false;

function disposeGraph(): void {
	for (const loop of loops) {
		try {
			loop.stop();
			loop.dispose();
		} catch {
			/* ignore */
		}
	}
	loops = [];
	patternsArmed = false;

	for (const d of disposables) {
		try {
			d.dispose();
		} catch {
			/* ignore */
		}
	}
	disposables = [];

	kickSynth = bassSynth = hatsSynth = percSynth = chordSynth = voxSynth = fxSynth = null;
	chains = {};
	masterFilter = null;
	master = null;
}

function makeChain(id: RoleId): RoleChain {
	const gain = new Tone!.Gain(0);
	const filter = new Tone!.Filter(4000, 'lowpass');
	filter.connect(gain);
	gain.connect(masterFilter!);
	const chain = { gain, filter };
	chains[id] = chain;
	disposables.push(gain, filter);
	return chain;
}

async function ensureGraph(): Promise<void> {
	Tone = await ensureAudioStarted();
	if (master) return;

	masterFilter = new Tone.Filter(5000, 'lowpass').toDestination();
	master = new Tone.Gain(0.55);
	master.connect(masterFilter);
	disposables.push(master, masterFilter);

	const kick = makeChain('kick');
	kickSynth = new Tone.MembraneSynth({
		pitchDecay: 0.04,
		octaves: 5,
		oscillator: { type: 'sine' },
		envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.15 }
	});
	kickSynth.connect(kick.filter);
	kickSynth.volume.value = -6;
	disposables.push(kickSynth);

	const bass = makeChain('bass');
	bassSynth = new Tone.MonoSynth({
		oscillator: { type: 'sawtooth' },
		envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.15 },
		filterEnvelope: { attack: 0.01, decay: 0.15, sustain: 0.2, release: 0.2, baseFrequency: 80, octaves: 2.5 }
	});
	bassSynth.connect(bass.filter);
	bassSynth.volume.value = -10;
	disposables.push(bassSynth);

	const hats = makeChain('hats');
	hatsSynth = new Tone.NoiseSynth({
		noise: { type: 'white' },
		envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 }
	});
	hatsSynth.connect(hats.filter);
	hatsSynth.volume.value = -18;
	disposables.push(hatsSynth);

	const perc = makeChain('perc');
	percSynth = new Tone.MetalSynth({
		envelope: { attack: 0.001, decay: 0.12, release: 0.05 },
		harmonicity: 8.5,
		modulationIndex: 20,
		resonance: 2000,
		octaves: 0.5
	});
	percSynth.connect(perc.filter);
	percSynth.volume.value = -22;
	disposables.push(percSynth);

	const chords = makeChain('chords');
	chordSynth = new Tone.PolySynth(Tone.Synth, {
		oscillator: { type: 'triangle' },
		envelope: { attack: 0.08, decay: 0.3, sustain: 0.35, release: 0.6 }
	});
	chordSynth.maxPolyphony = 4;
	chordSynth.connect(chords.filter);
	chordSynth.volume.value = -16;
	disposables.push(chordSynth);

	const vox = makeChain('vox');
	voxSynth = new Tone.Synth({
		oscillator: { type: 'sine' },
		envelope: { attack: 0.05, decay: 0.2, sustain: 0.2, release: 0.4 }
	});
	voxSynth.connect(vox.filter);
	voxSynth.volume.value = -20;
	disposables.push(voxSynth);

	const fx = makeChain('fx');
	fxSynth = new Tone.NoiseSynth({
		noise: { type: 'pink' },
		envelope: { attack: 0.2, decay: 0.4, sustain: 0.1, release: 0.5 }
	});
	fxSynth.connect(fx.filter);
	fxSynth.volume.value = -28;
	disposables.push(fxSynth);
}

function clearPatterns(): void {
	for (const loop of loops) {
		try {
			loop.stop();
			loop.dispose();
		} catch {
			/* ignore */
		}
	}
	loops = [];
	patternsArmed = false;
}

function armPatterns(session: DjSession): void {
	if (!Tone || patternsArmed) return;
	const t = Tone.getTransport();
	const root = rootNote(session.key);
	const triad = chordNotes(session.key);

	const kickLoop = new Tone.Loop((time) => {
		kickSynth?.triggerAttackRelease('C1', '8n', time);
	}, '4n');
	kickLoop.start(0);
	loops.push(kickLoop);

	// Offbeat 8ths + light 16th chatter
	const hatsLoop = new Tone.Loop((time) => {
		const pos = t.position;
		const parts = String(pos).split(':');
		const sixteenth = Number(parts[2] ?? 0);
		const strength = sixteenth % 2 === 0 ? '16n' : '32n';
		hatsSynth?.triggerAttackRelease(strength, time, sixteenth % 2 === 0 ? 0.55 : 0.25);
	}, '8n');
	hatsLoop.start('0:0:2'); // offbeat
	loops.push(hatsLoop);

	const bassLoop = new Tone.Loop((time) => {
		bassSynth?.triggerAttackRelease(root, '8n', time, 0.7);
	}, '2n');
	bassLoop.start(0);
	loops.push(bassLoop);

	const chordLoop = new Tone.Loop((time) => {
		chordSynth?.triggerAttackRelease(triad, '2n', time, 0.35);
	}, '1m');
	chordLoop.start(0);
	loops.push(chordLoop);

	const percLoop = new Tone.Loop((time) => {
		// Sparse: fire on bar beats 2 and 4-ish via probability from transport ticks
		const beats = t.seconds * (t.bpm.value / 60);
		if (Math.floor(beats) % 4 === 2) {
			percSynth?.triggerAttackRelease('16n', time, 0.4);
		}
	}, '4n');
	percLoop.start(0);
	loops.push(percLoop);

	const voxLoop = new Tone.Loop((time) => {
		const beats = t.seconds * (t.bpm.value / 60);
		if (Math.floor(beats) % 8 === 4) {
			voxSynth?.triggerAttackRelease(triad[1] ?? 'C4', '4n', time, 0.3);
		}
	}, '2n');
	voxLoop.start(0);
	loops.push(voxLoop);

	const fxLoop = new Tone.Loop((time) => {
		const beats = t.seconds * (t.bpm.value / 60);
		if (Math.floor(beats) % 16 === 0) {
			fxSynth?.triggerAttackRelease('2n', time, 0.2);
		}
	}, '1m');
	fxLoop.start(0);
	loops.push(fxLoop);

	patternsArmed = true;
}

function effectiveMute(session: DjSession, id: RoleId): boolean {
	const anySolo = ROLE_IDS.some((r) => session.roles[r].solo);
	const role = session.roles[id];
	if (role.mute) return true;
	if (anySolo && !role.solo) return true;
	return false;
}

/**
 * Map energy → audible darkness. Wide ranges so 0.15 vs 0.85 is unmistakable.
 * Master LPF + gain + per-role gain/filter from session.roles.
 */
function applyNow(session: DjSession): void {
	if (!Tone || !master || !masterFilter) return;

	currentSession = session;
	Tone.getTransport().bpm.value = session.bpm;

	// Master: dark = quiet + closed filter; bright = loud + open
	const masterGain = 0.22 + session.energy * 0.55;
	const masterCutoff = 280 + session.energy * 6200;
	master.gain.rampTo(masterGain, 0.12);
	masterFilter.frequency.rampTo(masterCutoff, 0.18);
	masterFilter.Q.rampTo(0.7 + (1 - session.energy) * 1.2, 0.18);

	for (const id of ROLE_IDS) {
		const chain = chains[id];
		if (!chain) continue;
		const role = session.roles[id];
		const muted = effectiveMute(session, id);
		// Wider dynamic range than v0 continuous drones
		const target = muted ? 0 : role.gain * (0.25 + session.energy * 0.9);
		chain.gain.gain.rampTo(target, 0.1);

		const cutoff = 140 + role.filter * 7200;
		chain.filter.frequency.rampTo(cutoff, 0.15);
	}

	if (!patternsArmed) armPatterns(session);

	lastAppliedRevision = session.revision;
	pendingSession = null;
}

function scheduleApply(session: DjSession): void {
	if (session.revision === lastAppliedRevision) {
		// Still refresh bpm/key-driven patterns if only bar advanced — no-op for v0.2
		return;
	}
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
		Tone.getTransport().bpm.value = currentSession?.bpm ?? 122;
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
	clearPatterns();
	disposeGraph();
	lastAppliedRevision = -1;
	pendingSession = null;
	currentSession = null;
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
