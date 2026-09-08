// src/lib/dj/intent.ts
//
// Natural-language → session verb mapper for morning agent loop.
 // No LLM — phrase patterns only. Returns the mutate result + mapped verb.

import {
	breakDown,
	drop,
	emergencyStop,
	getSession,
	muteRole,
	recordLastIntent,
	sessionPause,
	sessionStart,
	sessionStop,
	setBpm,
	setEnergy,
	setKey,
	transition,
	type MutateMeta,
	type MutateResult
} from './session';

export type IntentVerb =
	| 'set_energy'
	| 'drop'
	| 'break'
	| 'transition'
	| 'session_start'
	| 'session_stop'
	| 'session_pause'
	| 'emergency_stop'
	| 'set_bpm'
	| 'set_key'
	| 'mute_role'
	| 'noop';

export interface IntentResult {
	ok: boolean;
	verb: IntentVerb;
	text: string;
	detail?: string;
	result?: MutateResult;
	error?: string;
}

function clamp01(n: number): number {
	return Math.min(1, Math.max(0, n));
}

/**
 * Map free text to a session mutation. Side-effect: records last_intent on session.
 * Always bar-quantized via the underlying verb's commit().
 */
export function mapIntent(text: string, meta: MutateMeta = {}): IntentResult {
	const raw = (text ?? '').trim();
	recordLastIntent(raw || '(empty)');
	if (!raw) {
		return { ok: false, verb: 'noop', text: raw, error: 'text is required' };
	}

	const t = raw.toLowerCase();

	// Emergency / stop / pause / start
	if (/\b(emergency\s*stop|kill|panic|silence\s*all)\b/.test(t)) {
		const result = emergencyStop(meta);
		return { ok: result.ok, verb: 'emergency_stop', text: raw, result };
	}
	if (/\b(stop(\s+session)?|end\s+set)\b/.test(t) && !/emergency/.test(t)) {
		const result = sessionStop(meta);
		return { ok: result.ok, verb: 'session_stop', text: raw, result };
	}
	if (/\bpause\b/.test(t)) {
		const result = sessionPause(meta);
		return { ok: result.ok, verb: 'session_pause', text: raw, result };
	}
	// Narrow start: avoid matching "play some jazz…"
	if (
		(/\bstart(\s+(the\s+)?(session|set|deck))?\b/.test(t) ||
			/\bsession\s*start\b/.test(t) ||
			/^(play|go)$/.test(t)) &&
		!/drop|break|darker|brighter/.test(t)
	) {
		const result = sessionStart(meta);
		return { ok: result.ok, verb: 'session_start', text: raw, result };
	}

	// Drop / break / transition
	if (/\bdrop\b/.test(t) || /\bpeak\b/.test(t) || /\bfull\s+send\b/.test(t)) {
		const result = drop(meta);
		return { ok: result.ok, verb: 'drop', text: raw, detail: 'energy lift', result };
	}
	if (/\bbreak\b/.test(t) || /\bbreakdown\b/.test(t) || /\bpull\s+back\b/.test(t)) {
		const result = breakDown(meta);
		return { ok: result.ok, verb: 'break', text: raw, detail: 'energy dip + duck', result };
	}
	if (/\btransition\b/.test(t) || /\bblend\b/.test(t)) {
		const barsMatch = t.match(/(\d+)\s*bars?/);
		const bars = barsMatch ? Number(barsMatch[1]) : 8;
		const result = transition(bars, meta);
		return { ok: result.ok, verb: 'transition', text: raw, detail: `${bars} bars`, result };
	}

	// BPM
	const bpmMatch = t.match(/\b(?:bpm|tempo)\s*[:=]?\s*(\d{2,3})\b/) || t.match(/\b(\d{2,3})\s*bpm\b/);
	if (bpmMatch) {
		const bpm = Number(bpmMatch[1]);
		const result = setBpm(bpm, meta);
		return { ok: result.ok, verb: 'set_bpm', text: raw, detail: String(bpm), result };
	}

	// Key
	const keyMatch = t.match(/\b(?:key|in)\s+([a-g][#b]?m?)\b/i);
	if (keyMatch && /\b(key|in\s+[a-g])/i.test(t)) {
		const key = keyMatch[1]!;
		const result = setKey(key, meta);
		return { ok: result.ok, verb: 'set_key', text: raw, detail: key, result };
	}

	// Mute role
	const muteMatch = t.match(/\bmute\s+(kick|bass|hats|perc|chords|vox|fx)\b/);
	if (muteMatch) {
		const result = muteRole(muteMatch[1]!, true, meta);
		return { ok: result.ok, verb: 'mute_role', text: raw, detail: muteMatch[1], result };
	}
	const unmuteMatch = t.match(/\bunmute\s+(kick|bass|hats|perc|chords|vox|fx)\b/);
	if (unmuteMatch) {
		const result = muteRole(unmuteMatch[1]!, false, meta);
		return { ok: result.ok, verb: 'mute_role', text: raw, detail: unmuteMatch[1], result };
	}

	// Energy phrases — explicit number wins
	const energyNum = t.match(/\benergy\s*[:=]?\s*(0?\.\d+|1(?:\.0)?|0)\b/);
	if (energyNum) {
		const energy = clamp01(Number(energyNum[1]));
		const result = setEnergy(energy, meta);
		return { ok: result.ok, verb: 'set_energy', text: raw, detail: String(energy), result };
	}

	const darker =
		/\b(darker|dark|deeper|moodier|closed|warm(?:er)?|take\s+it\s+down|bring\s+it\s+down|lower\s+energy|chill)\b/.test(
			t
		);
	const brighter =
		/\b(brighter|bright|open(?:er)?|lift|higher\s+energy|more\s+energy|hype|take\s+it\s+up)\b/.test(t);

	if (darker && !brighter) {
		const cur = getSession().energy;
		let target = 0.15;
		if (/\b(a\s+bit|slightly|little)\b/.test(t)) target = clamp01(cur - 0.15);
		else if (/\b(much|way|really|super)\b/.test(t)) target = 0.08;
		else target = clamp01(Math.min(0.2, cur - 0.25));
		const result = setEnergy(target, meta);
		return { ok: result.ok, verb: 'set_energy', text: raw, detail: String(target), result };
	}

	if (brighter && !darker) {
		const cur = getSession().energy;
		let target = 0.85;
		if (/\b(a\s+bit|slightly|little)\b/.test(t)) target = clamp01(cur + 0.15);
		else if (/\b(much|way|really|super)\b/.test(t)) target = 0.95;
		else target = clamp01(Math.max(0.8, cur + 0.25));
		const result = setEnergy(target, meta);
		return { ok: result.ok, verb: 'set_energy', text: raw, detail: String(target), result };
	}

	return {
		ok: false,
		verb: 'noop',
		text: raw,
		error:
			'unrecognized intent — try: take it darker, brighter, drop, break, energy 0.2, 128 bpm, mute hats'
	};
}
