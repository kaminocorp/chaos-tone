// src/lib/stores/create-param-store.svelte.ts
//
// The param store — the single source of truth for one parameter, and the
// canonical implementation of the "stores are the contract" pattern
// (docs/executing/frontend-overview.md §Architecture). The same store is:
//   - written by 2D controls (Knob, Slider),
//   - read by any visual readout (Stage, later Threlte objects),
//   - pushed into Tone.js via `bindTo()` — declaratively, no "sync UI to
//     audio" code path anywhere else.
//
// ── HOW TO ADD A NEW PARAM (the 15-minute recipe) ────────────────────────────
//
//   1. Declare the store next to its feature (see `instrument-params.ts`):
//
//        export const cutoffStore = createParamStore({
//        	label: 'Cutoff',
//        	unit: 'Hz',
//        	min: 80,
//        	max: 12_000,
//        	defaultValue: 2_000,
//        	curve: 'log' // perceptual params (freq, gain) want log; else omit
//        });
//
//   2. Drop a control anywhere in the Workbench:  <Knob param={cutoffStore} />
//      (or bind a Slider: <Slider bind:value={cutoffStore.value} … />).
//
//   3. Read it anywhere else: `{cutoffStore.format()}` in any template is
//      live — the value is rune-backed, so Svelte tracks it for free.
//
//   4. Bind it to audio ONCE, where the Tone node is created:
//
//        cutoffStore.bindTo(filter.frequency);
//
//      From then on every store write ramps the Tone param (default 20 ms —
//      long enough to kill zipper noise, short enough to feel immediate).
//      `bindTo` returns an unbind function for nodes you dispose.
//
// That's the whole pattern. No step 5.
// (Phase 10 lifts this recipe into ARCHITECTURE.md.)
//
// ── Implementation notes ─────────────────────────────────────────────────────
//
// UI reactivity comes from a `$state` rune (hence the `.svelte.ts` extension).
// Audio pushes deliberately do NOT go through `$effect`: a plain listener set
// notifies bound Tone params synchronously inside the setter, so a knob turn
// reaches the audio thread without waiting on Svelte's effect flush — and the
// store stays fully testable in a plain Node environment, where server-compiled
// effects never run.

/**
 * Structural subset of `Tone.Param` / `Tone.Signal` that `bindTo()` needs.
 * Type-only on purpose — keeps `tone` out of this module's runtime graph
 * (same lazy discipline as `src/lib/audio/context.ts`).
 */
export interface BindableToneParam {
	value: number | string;
	rampTo(value: number, rampTime: number): unknown;
}

export interface ParamStoreOptions {
	/** Human name, used for a11y labels and readouts (e.g. "Frequency"). */
	label: string;
	/** Display unit, e.g. "Hz". Omit for unitless params. */
	unit?: string;
	min: number;
	max: number;
	defaultValue: number;
	/**
	 * How the 0..1 `normalized` position maps to the value range.
	 * 'log' spaces equal ratios equally (octaves on a frequency knob) and
	 * requires min > 0. Defaults to 'linear'.
	 */
	curve?: 'linear' | 'log';
	/** Default ramp time in seconds for `bindTo` pushes. Defaults to 0.02. */
	ramp?: number;
}

export interface ParamStore {
	readonly label: string;
	readonly unit: string;
	readonly min: number;
	readonly max: number;
	readonly defaultValue: number;
	/** Current value. Reactive; writes are clamped to [min, max]. */
	value: number;
	/** Current position in 0..1 knob space (curve-aware). Reactive. */
	readonly normalized: number;
	/** Set from 0..1 knob space (curve-aware, clamped). */
	setNormalized(next: number): void;
	reset(): void;
	/** Display string, e.g. "440 Hz". */
	format(): string;
	/**
	 * Push the store value into a Tone param — now (a direct set, since
	 * nothing is sounding yet at bind time) and on every future write (a
	 * `rampTo` over `ramp` seconds; pass `ramp: 0` for direct sets).
	 * Returns an unbind function.
	 */
	bindTo(param: BindableToneParam, opts?: { ramp?: number }): () => void;
}

export function createParamStore(options: ParamStoreOptions): ParamStore {
	const { label, unit = '', min, max, defaultValue, curve = 'linear', ramp = 0.02 } = options;

	if (max <= min) {
		throw new Error(`[param:${label}] max (${max}) must be greater than min (${min})`);
	}
	if (curve === 'log' && min <= 0) {
		throw new Error(`[param:${label}] curve 'log' requires min > 0, got ${min}`);
	}

	const clamp = (v: number) => Math.min(max, Math.max(min, v));

	const toNormalized = (v: number) =>
		curve === 'log' ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min);
	const fromNormalized = (n: number) =>
		curve === 'log' ? min * Math.pow(max / min, n) : min + n * (max - min);

	let value = $state(clamp(defaultValue));
	// Intentionally a plain Set: this is an internal registry of audio-push
	// callbacks, not UI state — nothing should re-render when it mutates.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const listeners = new Set<(v: number) => void>();

	function setValue(next: number) {
		const clamped = clamp(next);
		if (clamped === value) return;
		value = clamped;
		for (const listener of listeners) listener(clamped);
	}

	return {
		label,
		unit,
		min,
		max,
		defaultValue,
		get value() {
			return value;
		},
		set value(next: number) {
			setValue(next);
		},
		get normalized() {
			return toNormalized(value);
		},
		setNormalized(next: number) {
			setValue(fromNormalized(Math.min(1, Math.max(0, next))));
		},
		reset() {
			setValue(defaultValue);
		},
		format() {
			return `${Math.round(value)}${unit ? ` ${unit}` : ''}`;
		},
		bindTo(param, opts = {}) {
			const rampTime = opts.ramp ?? ramp;
			param.value = value;
			const push = (v: number) => {
				if (rampTime > 0) param.rampTo(v, rampTime);
				else param.value = v;
			};
			listeners.add(push);
			return () => listeners.delete(push);
		}
	};
}
