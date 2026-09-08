import { describe, it, expect, beforeEach } from 'vitest';
import { mapIntent } from './intent';
import { getSession, resetSessionStoreForTests, sessionStart } from './session';

beforeEach(() => {
	resetSessionStoreForTests();
	sessionStart();
});

describe('mapIntent', () => {
	it('maps take it darker to low energy', () => {
		const r = mapIntent('take it darker', { if_revision: 1 });
		expect(r.ok).toBe(true);
		expect(r.verb).toBe('set_energy');
		expect(r.result?.ok).toBe(true);
		if (!r.result || !r.result.ok) return;
		expect(r.result.session.energy).toBeLessThanOrEqual(0.2);
		expect(getSession().last_intent).toBe('take it darker');
	});

	it('maps brighter / drop / break', () => {
		const b = mapIntent('make it brighter', { if_revision: getSession().revision });
		expect(b.ok).toBe(true);
		expect(b.verb).toBe('set_energy');
		if (!b.result || !b.result.ok) return;
		expect(b.result.session.energy).toBeGreaterThanOrEqual(0.8);

		const d = mapIntent('drop', { if_revision: getSession().revision });
		expect(d.ok).toBe(true);
		expect(d.verb).toBe('drop');
		if (!d.result || !d.result.ok) return;
		expect(d.result.session.energy).toBeGreaterThanOrEqual(0.85);

		const br = mapIntent('break', { if_revision: getSession().revision });
		expect(br.ok).toBe(true);
		expect(br.verb).toBe('break');
		if (!br.result || !br.result.ok) return;
		expect(br.result.session.energy).toBeLessThan(0.4);
	});

	it('maps energy number, bpm, mute', () => {
		const e = mapIntent('energy 0.3', { if_revision: getSession().revision });
		expect(e.ok).toBe(true);
		expect(e.verb).toBe('set_energy');
		if (!e.result || !e.result.ok) return;
		expect(e.result.session.energy).toBe(0.3);

		const bpm = mapIntent('128 bpm', { if_revision: getSession().revision });
		expect(bpm.ok).toBe(true);
		expect(bpm.verb).toBe('set_bpm');
		if (!bpm.result || !bpm.result.ok) return;
		expect(bpm.result.session.bpm).toBe(128);

		const m = mapIntent('mute hats', { if_revision: getSession().revision });
		expect(m.ok).toBe(true);
		expect(m.verb).toBe('mute_role');
		if (!m.result || !m.result.ok) return;
		expect(m.result.session.roles.hats.mute).toBe(true);
	});

	it('maps emergency stop and rejects unknown', () => {
		const e = mapIntent('emergency stop', { if_revision: getSession().revision });
		expect(e.ok).toBe(true);
		expect(e.verb).toBe('emergency_stop');

		const u = mapIntent('play some jazz fusion please');
		expect(u.ok).toBe(false);
		expect(u.verb).toBe('noop');
	});

	it('honors CAS on intent', () => {
		const r = mapIntent('take it darker', { if_revision: 0 });
		expect(r.ok).toBe(false);
		expect(r.result && !r.result.ok && r.result.status).toBe(409);
	});
});
