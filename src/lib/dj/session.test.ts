import { describe, it, expect, beforeEach } from 'vitest';
import {
	resetSessionStoreForTests,
	getSession,
	sessionStart,
	sessionStop,
	sessionPause,
	setEnergy,
	setBpm,
	setKey,
	setPhase,
	swapRole,
	muteRole,
	soloRole,
	setRoleGain,
	setRoleFilter,
	transition,
	drop,
	breakDown,
	emergencyStop,
	advanceBar,
	applyEnergyToRoles
} from './session';

beforeEach(() => {
	resetSessionStoreForTests();
});

describe('dj session store', () => {
	it('starts idle with seven roles and revision 0', () => {
		const s = getSession();
		expect(s.phase).toBe('idle');
		expect(s.revision).toBe(0);
		expect(s.energy).toBe(0.5);
		expect(Object.keys(s.roles).sort()).toEqual(
			['bass', 'chords', 'fx', 'hats', 'kick', 'perc', 'vox'].sort()
		);
	});

	it('session_start bumps revision and sets playing', () => {
		const r = sessionStart({ client_op_id: 'start-1' });
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.session.phase).toBe('playing');
		expect(r.session.revision).toBe(1);
		expect(r.replayed).toBe(false);
	});

	it('CAS: stale if_revision returns 409 without mutating', () => {
		sessionStart();
		const before = getSession();
		const r = setEnergy(0.2, { if_revision: 0 });
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(r.status).toBe(409);
		expect(getSession().revision).toBe(before.revision);
		expect(getSession().energy).toBe(before.energy);
	});

	it('CAS: matching if_revision succeeds', () => {
		sessionStart();
		const rev = getSession().revision;
		const r = setEnergy(0.25, { if_revision: rev });
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.session.energy).toBe(0.25);
		expect(r.session.revision).toBe(rev + 1);
	});

	it('idempotency: same client_op_id replays without double-apply', () => {
		sessionStart();
		const a = setEnergy(0.1, { client_op_id: 'darker-1', if_revision: 1 });
		expect(a.ok).toBe(true);
		const revAfter = getSession().revision;
		const b = setEnergy(0.1, { client_op_id: 'darker-1', if_revision: 999 });
		expect(b.ok).toBe(true);
		if (!b.ok || !a.ok) return;
		expect(b.replayed).toBe(true);
		expect(b.session.revision).toBe(a.session.revision);
		expect(getSession().revision).toBe(revAfter);
	});

	it('mute_role and swap_role mutate role state', () => {
		sessionStart();
		const m = muteRole('hats', true, { if_revision: 1 });
		expect(m.ok).toBe(true);
		if (!m.ok) return;
		expect(m.session.roles.hats.mute).toBe(true);

		const s = swapRole('kick', 'placeholder-kick-a', { if_revision: m.session.revision });
		expect(s.ok).toBe(true);
		if (!s.ok) return;
		expect(s.session.roles.kick.stemId).toBe('placeholder-kick-a');
	});

	it('transition schedules apply_at_bar bars ahead', () => {
		sessionStart();
		const bar = getSession().bar;
		const t = transition(8, { if_revision: 1 });
		expect(t.ok).toBe(true);
		if (!t.ok) return;
		expect(t.session.apply_at_bar).toBe(bar + 8);
		expect(t.session.phase).toBe('transition');
	});

	it('rejects invalid energy and unknown roles', () => {
		expect(setEnergy(1.5).ok).toBe(false);
		expect(muteRole('snare', true).ok).toBe(false);
		expect(swapRole('lead', null).ok).toBe(false);
		expect(transition(0).ok).toBe(false);
	});

	it('advanceBar moves bar forward', () => {
		sessionStart();
		const after = advanceBar(4);
		expect(after.bar).toBe(getSession().bar);
		expect(after.bar).toBeGreaterThanOrEqual(5);
	});

	it('set_energy maps dark vs bright with wide filter and role-gain gap', () => {
		sessionStart();
		const dark = setEnergy(0.15, { if_revision: 1 });
		expect(dark.ok).toBe(true);
		if (!dark.ok) return;
		expect(dark.session.energy).toBe(0.15);
		expect(dark.session.roles.hats.filter).toBeLessThan(0.25);
		expect(dark.session.roles.hats.gain).toBeLessThan(0.4);
		expect(dark.session.roles.fx.gain).toBeLessThan(0.3);

		const bright = setEnergy(0.85, { if_revision: dark.session.revision });
		expect(bright.ok).toBe(true);
		if (!bright.ok) return;
		expect(bright.session.energy).toBe(0.85);
		expect(bright.session.roles.hats.filter).toBeGreaterThan(0.65);
		expect(bright.session.roles.hats.gain).toBeGreaterThan(0.7);
		expect(bright.session.roles.hats.gain - dark.session.roles.hats.gain).toBeGreaterThan(0.4);
		expect(bright.session.roles.chords.filter - dark.session.roles.chords.filter).toBeGreaterThan(
			0.4
		);
	});

	it('transition audibly dips energy and ducks bright roles', () => {
		sessionStart();
		setEnergy(0.8, { if_revision: 1 });
		const before = getSession();
		const t = transition(8, { if_revision: before.revision });
		expect(t.ok).toBe(true);
		if (!t.ok) return;
		expect(t.session.phase).toBe('transition');
		expect(t.session.energy).toBeLessThan(before.energy * 0.5);
		expect(t.session.energy).toBeLessThanOrEqual(0.35);
		expect(t.session.roles.hats.gain).toBeLessThanOrEqual(0.2);
		expect(t.session.apply_at_bar).toBe(before.bar + 8);
	});

	it('applyEnergyToRoles is monotonic across the energy range', () => {
		const low = getSession();
		applyEnergyToRoles(low, 0.1);
		const high = getSession();
		applyEnergyToRoles(high, 0.9);
		expect(high.roles.hats.gain).toBeGreaterThan(low.roles.hats.gain);
		expect(high.roles.fx.filter).toBeGreaterThan(low.roles.fx.filter);
		expect(high.roles.bass.filter).toBeGreaterThan(low.roles.bass.filter);
	});
});

describe('dj session verbs (morning set)', () => {
	it('set_bpm and set_key mutate with CAS', () => {
		sessionStart();
		const b = setBpm(128, { if_revision: 1 });
		expect(b.ok).toBe(true);
		if (!b.ok) return;
		expect(b.session.bpm).toBe(128);

		const k = setKey('Dm', { if_revision: b.session.revision });
		expect(k.ok).toBe(true);
		if (!k.ok) return;
		expect(k.session.key).toBe('Dm');
	});

	it('rejects out-of-range bpm', () => {
		expect(setBpm(40).ok).toBe(false);
		expect(setBpm(240).ok).toBe(false);
	});

	it('solo_role, set_role_gain, set_role_filter', () => {
		sessionStart();
		const s = soloRole('bass', true, { if_revision: 1 });
		expect(s.ok).toBe(true);
		if (!s.ok) return;
		expect(s.session.roles.bass.solo).toBe(true);

		const g = setRoleGain('kick', 0.5, { if_revision: s.session.revision });
		expect(g.ok).toBe(true);
		if (!g.ok) return;
		expect(g.session.roles.kick.gain).toBe(0.5);

		const f = setRoleFilter('hats', 0.2, { if_revision: g.session.revision });
		expect(f.ok).toBe(true);
		if (!f.ok) return;
		expect(f.session.roles.hats.filter).toBe(0.2);
	});

	it('session_stop, session_pause, set_phase', () => {
		sessionStart();
		const p = sessionPause({ if_revision: 1 });
		expect(p.ok).toBe(true);
		if (!p.ok) return;
		expect(p.session.phase).toBe('paused');

		const st = sessionStop({ if_revision: p.session.revision });
		expect(st.ok).toBe(true);
		if (!st.ok) return;
		expect(st.session.phase).toBe('idle');

		const ph = setPhase('playing', { if_revision: st.session.revision });
		expect(ph.ok).toBe(true);
		if (!ph.ok) return;
		expect(ph.session.phase).toBe('playing');
	});

	it('drop lifts energy; break dips and ducks', () => {
		sessionStart();
		setEnergy(0.5, { if_revision: 1 });
		const d = drop({ if_revision: getSession().revision });
		expect(d.ok).toBe(true);
		if (!d.ok) return;
		expect(d.session.energy).toBeGreaterThanOrEqual(0.85);
		expect(d.session.phase).toBe('playing');

		const br = breakDown({ if_revision: d.session.revision });
		expect(br.ok).toBe(true);
		if (!br.ok) return;
		expect(br.session.energy).toBeLessThan(0.4);
		expect(br.session.phase).toBe('transition');
		expect(br.session.roles.hats.gain).toBeLessThanOrEqual(0.12);
	});

	it('emergency_stop mutes all and zeros energy', () => {
		sessionStart();
		const e = emergencyStop({ if_revision: 1, client_op_id: 'panic-1' });
		expect(e.ok).toBe(true);
		if (!e.ok) return;
		expect(e.session.phase).toBe('idle');
		expect(e.session.energy).toBe(0);
		for (const id of Object.keys(e.session.roles) as Array<keyof typeof e.session.roles>) {
			expect(e.session.roles[id].mute).toBe(true);
			expect(e.session.roles[id].gain).toBe(0);
		}
		const replay = emergencyStop({ client_op_id: 'panic-1' });
		expect(replay.ok).toBe(true);
		if (!replay.ok) return;
		expect(replay.replayed).toBe(true);
	});
});
