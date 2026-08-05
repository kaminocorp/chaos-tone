import { describe, it, expect, vi } from 'vitest';
import { createParamStore } from './create-param-store.svelte';

function makeStore(overrides: Partial<Parameters<typeof createParamStore>[0]> = {}) {
	return createParamStore({
		label: 'Frequency',
		unit: 'Hz',
		min: 110,
		max: 880,
		defaultValue: 440,
		curve: 'log',
		...overrides
	});
}

function makeParam() {
	return { value: 0 as number | string, rampTo: vi.fn() };
}

describe('createParamStore', () => {
	it('starts at the default and clamps writes to [min, max]', () => {
		const store = makeStore();
		expect(store.value).toBe(440);
		store.value = 10_000;
		expect(store.value).toBe(880);
		store.value = -5;
		expect(store.value).toBe(110);
	});

	it('resets to the default', () => {
		const store = makeStore();
		store.value = 220;
		store.reset();
		expect(store.value).toBe(440);
	});

	it('maps value <-> normalized on a log curve (octaves evenly spaced)', () => {
		const store = makeStore(); // 110..880 = 3 octaves
		store.value = 220; // one octave up from min
		expect(store.normalized).toBeCloseTo(1 / 3);
		store.setNormalized(2 / 3);
		expect(store.value).toBeCloseTo(440);
		store.setNormalized(2); // out of range → clamps to max
		expect(store.value).toBe(880);
	});

	it('maps linearly when no curve is given', () => {
		const store = makeStore({ curve: undefined, min: 0, max: 100, defaultValue: 25 });
		expect(store.normalized).toBeCloseTo(0.25);
		store.setNormalized(0.5);
		expect(store.value).toBe(50);
	});

	it('rejects a log curve with a non-positive min', () => {
		expect(() => makeStore({ curve: 'log', min: 0 })).toThrow(/requires min > 0/);
	});

	it('formats with the unit', () => {
		const store = makeStore();
		store.setNormalized(0.123);
		expect(store.format()).toMatch(/^\d+ Hz$/);
	});

	it('bindTo pushes the current value immediately, then ramps every write', () => {
		const store = makeStore();
		const param = makeParam();
		store.bindTo(param);
		expect(param.value).toBe(440); // initial sync is a direct set, not a ramp
		expect(param.rampTo).not.toHaveBeenCalled();
		store.value = 550;
		expect(param.rampTo).toHaveBeenCalledExactlyOnceWith(550, 0.02);
	});

	it('bindTo with ramp: 0 sets the value directly', () => {
		const store = makeStore();
		const param = makeParam();
		store.bindTo(param, { ramp: 0 });
		store.value = 550;
		expect(param.rampTo).not.toHaveBeenCalled();
		expect(param.value).toBe(550);
	});

	it('does not notify when a clamped write lands on the current value', () => {
		const store = makeStore();
		const param = makeParam();
		store.bindTo(param);
		store.value = 880;
		store.value = 99_999; // clamps to 880 — no change, no push
		expect(param.rampTo).toHaveBeenCalledTimes(1);
	});

	it('unbinding stops the pushes', () => {
		const store = makeStore();
		const param = makeParam();
		const unbind = store.bindTo(param);
		unbind();
		store.value = 550;
		expect(param.rampTo).not.toHaveBeenCalled();
	});
});
