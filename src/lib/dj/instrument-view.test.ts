import { describe, it, expect } from 'vitest';
import type { DjSession } from './session';
import {
	INTENT_PADS,
	INSTRUMENT_STEMS,
	activePadIds,
	conductorHint,
	displayEnergy,
	expandKey,
	formatClock,
	formatConflictError,
	formatModDb,
	headerBpm,
	headerKey,
	headerPhase,
	lastIntentLabel,
	plaqueBpm,
	plaqueKey,
	plaquePhase,
	roleBayStatus,
	runStatus
} from './instrument-view';

function session(partial: Partial<DjSession> = {}): DjSession {
	const base: DjSession = {
		bpm: 122,
		key: 'Am',
		energy: 0.5,
		bar: 0,
		phase: 'idle',
		revision: 0,
		roles: {
			kick: { gain: 0.88, mute: false, solo: false, filter: 0.5, stemId: null },
			bass: { gain: 0.82, mute: false, solo: false, filter: 0.5, stemId: null },
			hats: { gain: 0.57, mute: false, solo: false, filter: 0.5, stemId: null },
			perc: { gain: 0.5, mute: false, solo: false, filter: 0.5, stemId: null },
			chords: { gain: 0.65, mute: false, solo: false, filter: 0.5, stemId: null },
			vox: { gain: 0.45, mute: true, solo: false, filter: 0.5, stemId: null },
			fx: { gain: 0.44, mute: false, solo: false, filter: 0.5, stemId: null }
		},
		apply_at_bar: 0,
		last_intent: null
	};
	return {
		...base,
		...partial,
		roles: { ...base.roles, ...(partial.roles ?? {}) }
	};
}

describe('instrument view — last intent sentence case', () => {
	it('renders an em dash when empty', () => {
		expect(lastIntentLabel(null)).toBe('—');
		expect(lastIntentLabel('')).toBe('—');
		expect(lastIntentLabel('   ')).toBe('—');
	});

	it('sentence-cases last intent (never ALL CAPS)', () => {
		expect(lastIntentLabel('take it darker')).toBe('Take it darker');
		expect(lastIntentLabel('emergency stop')).toBe('Emergency stop');
		expect(lastIntentLabel('hold the groove')).toBe('Hold the groove');
		expect(lastIntentLabel('EMERGENCY STOP')).toBe('Emergency stop');
	});
});

describe('instrument view — four mockup run states', () => {
	it('IDLE when the deck has not started', () => {
		expect(runStatus({ deckStarted: false, session: session() })).toBe('IDLE');
		expect(headerPhase('IDLE', session())).toBe('standby');
		expect(plaquePhase('IDLE', session())).toBe('intro');
		expect(headerBpm('IDLE', session())).toBe('—');
		expect(headerKey('IDLE', session())).toBe('—');
		expect(plaqueBpm('IDLE', session())).toBe('—');
		expect(plaqueKey('IDLE', session())).toBe('—');
		expect(displayEnergy('IDLE', session())).toBe(0);
		expect(conductorHint(false)).toBe('Start the deck to send intent.');
	});

	it('LIVE mid-energy is groove with live pads', () => {
		const s = session({
			phase: 'playing',
			energy: 0.58,
			last_intent: 'hold the groove'
		});
		expect(runStatus({ deckStarted: true, session: s })).toBe('LIVE');
		expect(headerPhase('LIVE', s)).toBe('groove');
		expect(plaquePhase('LIVE', s)).toBe('groove');
		expect(headerBpm('LIVE', s)).toBe('122');
		expect(headerKey('LIVE', s)).toBe('Am');
		expect(plaqueBpm('LIVE', s)).toBe('122.0');
		expect(plaqueKey('LIVE', s)).toBe('A minor');
		expect(displayEnergy('LIVE', s)).toBe(58);
		expect(conductorHint(true)).toBeNull();
		expect(activePadIds({ run: 'LIVE', session: s })).toEqual([]);
	});

	it('after take it darker is LIVE break and highlights Darker + Break', () => {
		const s = session({
			phase: 'playing',
			bpm: 120,
			energy: 0.41,
			last_intent: 'take it darker'
		});
		expect(runStatus({ deckStarted: true, session: s })).toBe('LIVE');
		expect(headerPhase('LIVE', s)).toBe('break');
		expect(plaquePhase('LIVE', s)).toBe('break');
		expect(displayEnergy('LIVE', s)).toBe(41);
		expect(activePadIds({ run: 'LIVE', session: s })).toEqual(['darker', 'break']);
	});

	it('does not stay STOPPED after a playing resume while last intent is still emergency stop', () => {
		const s = session({
			phase: 'playing',
			energy: 0.5,
			last_intent: 'emergency stop'
		});
		expect(runStatus({ deckStarted: true, session: s })).toBe('LIVE');
		expect(headerPhase('LIVE', s)).toBe('groove');
	});

	it('emergency stop is STOPPED / halt with Stop pad active', () => {
		const s = session({
			phase: 'idle',
			energy: 0,
			last_intent: 'emergency stop',
			roles: {
				kick: { gain: 0, mute: true, solo: false, filter: 0, stemId: null },
				bass: { gain: 0, mute: true, solo: false, filter: 0, stemId: null },
				hats: { gain: 0, mute: true, solo: false, filter: 0, stemId: null },
				perc: { gain: 0, mute: true, solo: false, filter: 0, stemId: null },
				chords: { gain: 0, mute: true, solo: false, filter: 0, stemId: null },
				vox: { gain: 0, mute: true, solo: false, filter: 0, stemId: null },
				fx: { gain: 0, mute: true, solo: false, filter: 0, stemId: null }
			}
		});
		expect(runStatus({ deckStarted: true, session: s })).toBe('STOPPED');
		expect(headerPhase('STOPPED', s)).toBe('halt');
		expect(plaquePhase('STOPPED', s)).toBe('halt');
		expect(headerBpm('STOPPED', s)).toBe('122');
		expect(activePadIds({ run: 'STOPPED', session: s })).toEqual(['stop']);
	});
});

describe('instrument view — stems, pads, meters', () => {
	it('exposes six mockup stems mapping vox → VOCALS (perc stays API-only)', () => {
		expect(INSTRUMENT_STEMS.map((stem) => stem.label)).toEqual([
			'KICK',
			'BASS',
			'HATS',
			'CHORDS',
			'FX',
			'VOCALS'
		]);
		expect(INSTRUMENT_STEMS.find((stem) => stem.label === 'VOCALS')?.role).toBe('vox');
		expect(INSTRUMENT_STEMS.some((stem) => stem.role === 'perc')).toBe(false);
	});

	it('pads fire the same intent texts the HTTP mapper understands', () => {
		expect(INTENT_PADS.map((pad) => pad.label)).toEqual([
			'Darker',
			'Softer',
			'Drop',
			'Break',
			'Build',
			'Stop'
		]);
		expect(INTENT_PADS.find((pad) => pad.id === 'darker')?.text).toBe('take it darker');
		expect(INTENT_PADS.find((pad) => pad.id === 'stop')?.text).toBe('emergency stop');
	});

	it('formats idle/muted meters as −∞ and live gain as dB', () => {
		expect(formatModDb({ idle: true, muted: false, gain: 0.8, run: 'IDLE' })).toBe('−∞');
		expect(formatModDb({ idle: false, muted: true, gain: 0.8, run: 'LIVE' })).toBe('−∞');
		expect(formatModDb({ idle: false, muted: false, gain: 0.69, run: 'LIVE' })).toBe('-3.2');
	});

	it('marks role bays live / hold / muted / alert', () => {
		expect(roleBayStatus({ run: 'IDLE', muted: false, gain: 0.8, filter: 0.5, role: 'kick' })).toBe(
			'muted'
		);
		expect(roleBayStatus({ run: 'LIVE', muted: false, gain: 0.8, filter: 0.5, role: 'kick' })).toBe(
			'live'
		);
		expect(roleBayStatus({ run: 'LIVE', muted: false, gain: 0.18, filter: 0.5, role: 'fx' })).toBe(
			'hold'
		);
		expect(roleBayStatus({ run: 'LIVE', muted: true, gain: 0.4, filter: 0.5, role: 'vox' })).toBe(
			'muted'
		);
		expect(roleBayStatus({ run: 'STOPPED', muted: true, gain: 0, filter: 0, role: 'kick' })).toBe(
			'alert'
		);
		expect(roleBayStatus({ run: 'STOPPED', muted: true, gain: 0, filter: 0, role: 'vox' })).toBe(
			'muted'
		);
	});

	it('expands keys and formats a 24h clock', () => {
		expect(expandKey('Am')).toBe('A minor');
		expect(expandKey('F#m')).toBe('F# minor');
		expect(expandKey('C')).toBe('C major');
		expect(formatClock(new Date('2026-09-08T23:56:02'))).toBe('23:56:02');
	});

	it('surfaces 409 conflicts as a clear refresh error', () => {
		expect(formatConflictError('revision conflict: expected 1, have 4')).toBe(
			'Revision conflict — session refreshed. revision conflict: expected 1, have 4'
		);
	});
});
