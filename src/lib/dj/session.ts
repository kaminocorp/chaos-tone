// src/lib/dj/session.ts
//
// Virtual DJ weekend v0 — in-memory session store (server-safe plain TS).
// Agent HTTP tools mutate this module; the browser polls and drives Tone.js.
// No persistence, auth, or Ableton. Revision CAS + client_op_id idempotency.

export const ROLE_IDS = ['kick', 'bass', 'hats', 'perc', 'chords', 'vox', 'fx'] as const;
export type RoleId = (typeof ROLE_IDS)[number];

export type SessionPhase = 'idle' | 'playing' | 'paused' | 'transition';

export interface RoleState {
	gain: number;
	mute: boolean;
	solo: boolean;
	filter: number;
	stemId: string | null;
}

export interface DjSession {
	bpm: number;
	key: string;
	energy: number;
	bar: number;
	phase: SessionPhase;
	revision: number;
	roles: Record<RoleId, RoleState>;
	/** Bar at which the latest mutation should become audible (deck-side). */
	apply_at_bar: number;
	/** Last natural-language intent text (panel readout). */
	last_intent: string | null;
}

export interface MutateMeta {
	if_revision?: number;
	client_op_id?: string;
	/** Bars until audible apply; default 1 (next bar). */
	bars?: number;
}

export type MutateOk = { ok: true; session: DjSession; replayed: boolean };
export type MutateConflict = {
	ok: false;
	status: 409;
	error: string;
	session: DjSession;
};
export type MutateBadRequest = { ok: false; status: 400; error: string };
export type MutateResult = MutateOk | MutateConflict | MutateBadRequest;

function defaultRole(): RoleState {
	return { gain: 0.8, mute: false, solo: false, filter: 0.5, stemId: null };
}

function freshRoles(): Record<RoleId, RoleState> {
	const roles = {} as Record<RoleId, RoleState>;
	for (const id of ROLE_IDS) {
		roles[id] = defaultRole();
	}
	return roles;
}

function freshSession(): DjSession {
	return {
		bpm: 122,
		key: 'Am',
		energy: 0.5,
		bar: 0,
		phase: 'idle',
		revision: 0,
		roles: freshRoles(),
		apply_at_bar: 0,
		last_intent: null
	};
}

/** Snapshot for idempotent replays (deep enough for v0 role tree). */
function cloneSession(s: DjSession): DjSession {
	return {
		...s,
		roles: Object.fromEntries(
			ROLE_IDS.map((id) => [id, { ...s.roles[id] }])
		) as Record<RoleId, RoleState>
	};
}

let session: DjSession = freshSession();

/** client_op_id → last successful result session snapshot */
const idempotency = new Map<string, DjSession>();

export function resetSessionStoreForTests(): void {
	session = freshSession();
	idempotency.clear();
}

export function getSession(): DjSession {
	return cloneSession(session);
}

function checkCas(meta: MutateMeta): MutateConflict | null {
	if (meta.if_revision !== undefined && meta.if_revision !== session.revision) {
		return {
			ok: false,
			status: 409,
			error: `revision conflict: expected ${meta.if_revision}, have ${session.revision}`,
			session: cloneSession(session)
		};
	}
	return null;
}

function checkIdempotent(meta: MutateMeta): MutateOk | null {
	if (meta.client_op_id) {
		const prev = idempotency.get(meta.client_op_id);
		if (prev) {
			return { ok: true, session: cloneSession(prev), replayed: true };
		}
	}
	return null;
}

function commit(meta: MutateMeta, barsDefault = 1): MutateOk {
	const bars = meta.bars ?? barsDefault;
	session.revision += 1;
	session.apply_at_bar = session.bar + Math.max(1, bars);
	const snap = cloneSession(session);
	if (meta.client_op_id) {
		idempotency.set(meta.client_op_id, snap);
	}
	return { ok: true, session: snap, replayed: false };
}

export function sessionStart(meta: MutateMeta = {}): MutateResult {
	const replay = checkIdempotent(meta);
	if (replay) return replay;
	const conflict = checkCas(meta);
	if (conflict) return conflict;

	session.phase = 'playing';
	if (session.bar < 1) session.bar = 1;
	return commit(meta, 1);
}

/**
 * Apply energy → role balance + filter darkness so 0.15 vs 0.85 is obvious.
 * Pure mapping used by setEnergy (and tests).
 */
export function applyEnergyToRoles(s: DjSession, energy: number): void {
	s.energy = energy;
	// Closed filters when dark; open when bright (melodic / high roles).
	for (const id of ['bass', 'chords', 'hats', 'vox', 'fx'] as RoleId[]) {
		s.roles[id].filter = 0.06 + energy * 0.82;
	}
	s.roles.kick.filter = 0.35 + energy * 0.35;
	s.roles.perc.filter = 0.1 + energy * 0.75;

	// Role balance: dark = kick+bass+soft pad; bright = hats/perc/fx/vox up.
	s.roles.kick.gain = 0.88;
	s.roles.bass.gain = 0.72 + energy * 0.2;
	s.roles.chords.gain = 0.45 + energy * 0.4;
	s.roles.hats.gain = 0.18 + energy * 0.78;
	s.roles.perc.gain = 0.12 + energy * 0.75;
	s.roles.vox.gain = 0.15 + energy * 0.6;
	s.roles.fx.gain = 0.08 + energy * 0.72;
}

export function setEnergy(energy: number, meta: MutateMeta = {}): MutateResult {
	if (!Number.isFinite(energy) || energy < 0 || energy > 1) {
		return { ok: false, status: 400, error: 'energy must be 0..1' };
	}
	const replay = checkIdempotent(meta);
	if (replay) return replay;
	const conflict = checkCas(meta);
	if (conflict) return conflict;

	applyEnergyToRoles(session, energy);
	return commit(meta, 1);
}

export function swapRole(
	role: string,
	stemId: string | null,
	meta: MutateMeta = {}
): MutateResult {
	if (!ROLE_IDS.includes(role as RoleId)) {
		return { ok: false, status: 400, error: `unknown role: ${role}` };
	}
	const replay = checkIdempotent(meta);
	if (replay) return replay;
	const conflict = checkCas(meta);
	if (conflict) return conflict;

	const id = role as RoleId;
	session.roles[id].stemId = stemId;
	// Placeholder: bump gain slightly so swap is audible even without WAVs.
	session.roles[id].gain = Math.min(1, Math.max(0.4, session.roles[id].gain + 0.05));
	return commit(meta, 1);
}

export function muteRole(role: string, mute: boolean, meta: MutateMeta = {}): MutateResult {
	if (!ROLE_IDS.includes(role as RoleId)) {
		return { ok: false, status: 400, error: `unknown role: ${role}` };
	}
	const replay = checkIdempotent(meta);
	if (replay) return replay;
	const conflict = checkCas(meta);
	if (conflict) return conflict;

	session.roles[role as RoleId].mute = mute;
	return commit(meta, 1);
}

export function transition(bars: number, meta: MutateMeta = {}): MutateResult {
	if (!Number.isFinite(bars) || bars < 1 || bars > 64) {
		return { ok: false, status: 400, error: 'bars must be 1..64' };
	}
	const replay = checkIdempotent(meta);
	if (replay) return replay;
	const conflict = checkCas(meta);
	if (conflict) return conflict;

	session.phase = 'transition';
	// Audible break: strong energy dip + duck bright roles (hats/perc/fx).
	const dipped = Math.max(0.05, session.energy * 0.4);
	applyEnergyToRoles(session, dipped);
	session.roles.hats.gain = Math.min(session.roles.hats.gain, 0.2);
	session.roles.perc.gain = Math.min(session.roles.perc.gain, 0.15);
	session.roles.fx.gain = Math.min(session.roles.fx.gain, 0.1);
	return commit({ ...meta, bars }, bars);
}

/** Advance the session bar (called by deck heartbeat / smoke). */
export function advanceBar(by = 1): DjSession {
	session.bar += by;
	if (session.phase === 'transition' && session.bar >= session.apply_at_bar) {
		session.phase = 'playing';
	}
	return cloneSession(session);
}


export function setBpm(bpm: number, meta: MutateMeta = {}): MutateResult {
	if (!Number.isFinite(bpm) || bpm < 60 || bpm > 200) {
		return { ok: false, status: 400, error: 'bpm must be 60..200' };
	}
	const replay = checkIdempotent(meta);
	if (replay) return replay;
	const conflict = checkCas(meta);
	if (conflict) return conflict;

	session.bpm = Math.round(bpm * 10) / 10;
	return commit(meta, 1);
}

export function setKey(key: string, meta: MutateMeta = {}): MutateResult {
	if (typeof key !== 'string' || key.trim().length === 0 || key.length > 16) {
		return { ok: false, status: 400, error: 'key must be a short string (e.g. Am, F#m)' };
	}
	const replay = checkIdempotent(meta);
	if (replay) return replay;
	const conflict = checkCas(meta);
	if (conflict) return conflict;

	session.key = key.trim();
	return commit(meta, 1);
}

export function setPhase(phase: string, meta: MutateMeta = {}): MutateResult {
	const allowed: SessionPhase[] = ['idle', 'playing', 'paused', 'transition'];
	if (!allowed.includes(phase as SessionPhase)) {
		return { ok: false, status: 400, error: `phase must be one of ${allowed.join('|')}` };
	}
	const replay = checkIdempotent(meta);
	if (replay) return replay;
	const conflict = checkCas(meta);
	if (conflict) return conflict;

	session.phase = phase as SessionPhase;
	return commit(meta, 1);
}

export function soloRole(role: string, solo: boolean, meta: MutateMeta = {}): MutateResult {
	if (!ROLE_IDS.includes(role as RoleId)) {
		return { ok: false, status: 400, error: `unknown role: ${role}` };
	}
	const replay = checkIdempotent(meta);
	if (replay) return replay;
	const conflict = checkCas(meta);
	if (conflict) return conflict;

	session.roles[role as RoleId].solo = solo;
	return commit(meta, 1);
}

export function setRoleGain(role: string, gain: number, meta: MutateMeta = {}): MutateResult {
	if (!ROLE_IDS.includes(role as RoleId)) {
		return { ok: false, status: 400, error: `unknown role: ${role}` };
	}
	if (!Number.isFinite(gain) || gain < 0 || gain > 1) {
		return { ok: false, status: 400, error: 'gain must be 0..1' };
	}
	const replay = checkIdempotent(meta);
	if (replay) return replay;
	const conflict = checkCas(meta);
	if (conflict) return conflict;

	session.roles[role as RoleId].gain = gain;
	return commit(meta, 1);
}

export function setRoleFilter(role: string, filter: number, meta: MutateMeta = {}): MutateResult {
	if (!ROLE_IDS.includes(role as RoleId)) {
		return { ok: false, status: 400, error: `unknown role: ${role}` };
	}
	if (!Number.isFinite(filter) || filter < 0 || filter > 1) {
		return { ok: false, status: 400, error: 'filter must be 0..1' };
	}
	const replay = checkIdempotent(meta);
	if (replay) return replay;
	const conflict = checkCas(meta);
	if (conflict) return conflict;

	session.roles[role as RoleId].filter = filter;
	return commit(meta, 1);
}

export function sessionStop(meta: MutateMeta = {}): MutateResult {
	const replay = checkIdempotent(meta);
	if (replay) return replay;
	const conflict = checkCas(meta);
	if (conflict) return conflict;

	session.phase = 'idle';
	return commit(meta, 1);
}

export function sessionPause(meta: MutateMeta = {}): MutateResult {
	const replay = checkIdempotent(meta);
	if (replay) return replay;
	const conflict = checkCas(meta);
	if (conflict) return conflict;

	session.phase = 'paused';
	return commit(meta, 1);
}

/** Kill switch: mute all roles, idle, energy floor. */
export function emergencyStop(meta: MutateMeta = {}): MutateResult {
	const replay = checkIdempotent(meta);
	if (replay) return replay;
	const conflict = checkCas(meta);
	if (conflict) return conflict;

	session.phase = 'idle';
	session.energy = 0;
	for (const id of ROLE_IDS) {
		session.roles[id].mute = true;
		session.roles[id].gain = 0;
		session.roles[id].solo = false;
	}
	return commit(meta, 1);
}

/** Peak: bright energy lift + open filters (audible drop). */
export function drop(meta: MutateMeta = {}): MutateResult {
	const replay = checkIdempotent(meta);
	if (replay) return replay;
	const conflict = checkCas(meta);
	if (conflict) return conflict;

	const target = Math.min(1, Math.max(0.85, session.energy + 0.35));
	applyEnergyToRoles(session, target);
	session.roles.hats.mute = false;
	session.roles.perc.mute = false;
	session.roles.fx.mute = false;
	session.roles.kick.mute = false;
	session.roles.bass.mute = false;
	session.phase = 'playing';
	return commit(meta, 1);
}

/** Break: duck bright roles, dip energy (like a short transition). */
export function breakDown(meta: MutateMeta = {}): MutateResult {
	const replay = checkIdempotent(meta);
	if (replay) return replay;
	const conflict = checkCas(meta);
	if (conflict) return conflict;

	session.phase = 'transition';
	const dipped = Math.max(0.05, session.energy * 0.35);
	applyEnergyToRoles(session, dipped);
	session.roles.hats.gain = Math.min(session.roles.hats.gain, 0.12);
	session.roles.perc.gain = Math.min(session.roles.perc.gain, 0.1);
	session.roles.fx.gain = Math.min(session.roles.fx.gain, 0.08);
	session.roles.kick.gain = Math.min(session.roles.kick.gain, 0.35);
	return commit(meta, 1);
}

/** Record last intent text without bumping revision (panel only). */
export function recordLastIntent(text: string): void {
	session.last_intent = text.slice(0, 200);
}

export function isRoleId(value: string): value is RoleId {
	return ROLE_IDS.includes(value as RoleId);
}
