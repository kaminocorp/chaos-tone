// src/lib/dj/instrument-view.ts
//
// Display mapping for the Virtual DJ instrument shell. Session + deck
// remain the source of truth; this module only derives chrome for the
// four signed-off mockup states (IDLE / LIVE / break / STOPPED).

import type { DjSession, RoleId } from './session';

export type RunStatus = 'IDLE' | 'LIVE' | 'STOPPED';

export type RoleBayStatus = 'live' | 'hold' | 'muted' | 'alert' | 'sys';

export type InstrumentStem = {
	id: string;
	role: RoleId;
	label: string;
	hue: string;
};

export type IntentPad = {
	id: 'darker' | 'softer' | 'drop' | 'break' | 'build' | 'stop';
	label: string;
	text: string;
};

/** Six mockup bays. `perc` stays on the session/API and is not shown. */
export const INSTRUMENT_STEMS: readonly InstrumentStem[] = [
	{ id: 'kick', role: 'kick', label: 'KICK', hue: '#3dba6e' },
	{ id: 'bass', role: 'bass', label: 'BASS', hue: '#8b5cf6' },
	{ id: 'hats', role: 'hats', label: 'HATS', hue: '#67e8f9' },
	{ id: 'chords', role: 'chords', label: 'CHORDS', hue: '#f59e3b' },
	{ id: 'fx', role: 'fx', label: 'FX', hue: '#eab308' },
	{ id: 'vocals', role: 'vox', label: 'VOCALS', hue: '#3b6ea5' }
];

/** Pads POST the same `/api/dj/intent` text the MCP mapper already understands. */
export const INTENT_PADS: readonly IntentPad[] = [
	{ id: 'darker', label: 'Darker', text: 'take it darker' },
	{ id: 'softer', label: 'Softer', text: 'take it softer' },
	{ id: 'drop', label: 'Drop', text: 'drop' },
	{ id: 'break', label: 'Break', text: 'break' },
	{ id: 'build', label: 'Build', text: 'build' },
	{ id: 'stop', label: 'Stop', text: 'emergency stop' }
];

const EM_DASH = '—';
const NEG_INF = '−∞';

export function toSentenceCase(text: string): string {
	const trimmed = text.trim();
	if (!trimmed) return '';
	const lower = trimmed.toLowerCase();
	return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function lastIntentLabel(text: string | null | undefined): string {
	const trimmed = (text ?? '').trim();
	if (!trimmed) return EM_DASH;
	return toSentenceCase(trimmed);
}

export function isEmergencyIntent(text: string | null | undefined): boolean {
	return /\bemergency\s*stop\b/i.test(text ?? '');
}

function isHalted(session: DjSession): boolean {
	if (session.phase !== 'idle') return false;
	if (session.energy > 0) return false;
	if (isEmergencyIntent(session.last_intent)) return true;
	return Object.values(session.roles).every((role) => role.mute);
}

export function runStatus(input: { deckStarted: boolean; session: DjSession | null }): RunStatus {
	if (!input.deckStarted || !input.session) return 'IDLE';
	if (isHalted(input.session)) return 'STOPPED';
	return 'LIVE';
}

function isBreakLike(session: DjSession | null): boolean {
	if (!session) return false;
	if (session.phase === 'transition') return true;
	if (/\b(darker|dark|break|soft(?:er)?)\b/i.test(session.last_intent ?? '')) return true;
	return session.energy < 0.45;
}

export function headerPhase(run: RunStatus, session: DjSession | null): string {
	if (run === 'IDLE') return 'standby';
	if (run === 'STOPPED') return 'halt';
	return isBreakLike(session) ? 'break' : 'groove';
}

export function plaquePhase(run: RunStatus, session: DjSession | null): string {
	if (run === 'IDLE') return 'intro';
	if (run === 'STOPPED') return 'halt';
	return isBreakLike(session) ? 'break' : 'groove';
}

export function headerBpm(run: RunStatus, session: DjSession | null): string {
	if (run === 'IDLE' || !session) return EM_DASH;
	return String(Math.round(session.bpm));
}

export function plaqueBpm(run: RunStatus, session: DjSession | null): string {
	if (run === 'IDLE' || !session) return EM_DASH;
	return session.bpm.toFixed(1);
}

export function headerKey(run: RunStatus, session: DjSession | null): string {
	if (run === 'IDLE' || !session) return EM_DASH;
	return session.key;
}

export function plaqueKey(run: RunStatus, session: DjSession | null): string {
	if (run === 'IDLE' || !session) return EM_DASH;
	return expandKey(session.key);
}

export function energyPercent(energy: number): number {
	if (!Number.isFinite(energy)) return 0;
	return Math.round(Math.min(1, Math.max(0, energy)) * 100);
}

export function displayEnergy(run: RunStatus, session: DjSession | null): number {
	if (run === 'IDLE' || !session) return 0;
	return energyPercent(session.energy);
}

export function conductorHint(deckStarted: boolean): string | null {
	return deckStarted ? null : 'Start the deck to send intent.';
}

export function expandKey(key: string): string {
	const trimmed = key.trim();
	const m = /^([A-G][#b]?)(m)?$/i.exec(trimmed);
	if (!m) return trimmed;
	const letter = m[1]!.charAt(0).toUpperCase() + m[1]!.slice(1);
	return m[2] ? `${letter} minor` : `${letter} major`;
}

export function formatClock(date: Date): string {
	const hh = String(date.getHours()).padStart(2, '0');
	const mm = String(date.getMinutes()).padStart(2, '0');
	const ss = String(date.getSeconds()).padStart(2, '0');
	return `${hh}:${mm}:${ss}`;
}

export function formatModDb(opts: {
	idle: boolean;
	muted: boolean;
	gain: number;
	run: RunStatus;
}): string {
	if (opts.idle || opts.muted || opts.gain <= 0) return NEG_INF;
	const db = 20 * Math.log10(opts.gain);
	return db.toFixed(1);
}

export function roleBayStatus(opts: {
	run: RunStatus;
	muted: boolean;
	gain: number;
	filter: number;
	role: RoleId;
}): RoleBayStatus {
	if (opts.run === 'STOPPED') return opts.role === 'vox' ? 'muted' : 'alert';
	if (opts.run === 'IDLE' || opts.muted) return 'muted';
	if (opts.filter < 0.2 && opts.gain >= 0.25) return 'sys';
	if (opts.gain < 0.25) return 'hold';
	return 'live';
}

export function activePadIds(input: { run: RunStatus; session: DjSession | null }): string[] {
	if (input.run === 'STOPPED') return ['stop'];
	if (input.run !== 'LIVE' || !input.session) return [];
	const text = (input.session.last_intent ?? '').toLowerCase();
	const ids: string[] = [];
	if (/\b(darker|dark)\b/.test(text)) ids.push('darker');
	if (/\bsoft/.test(text)) ids.push('softer');
	if (/\bdrop\b/.test(text)) ids.push('drop');
	if (isBreakLike(input.session) || /\bbreak\b/.test(text)) ids.push('break');
	if (/\bbuild\b/.test(text) || /\bbright/.test(text)) ids.push('build');
	if (isEmergencyIntent(text)) ids.push('stop');
	return ids;
}

export function formatConflictError(error: string): string {
	return `Revision conflict — session refreshed. ${error}`;
}

export function padDisabled(run: RunStatus, padId: IntentPad['id']): boolean {
	if (run === 'IDLE') return true;
	if (run === 'STOPPED') return padId !== 'stop';
	return false;
}
