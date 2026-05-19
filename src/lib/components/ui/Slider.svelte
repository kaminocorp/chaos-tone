<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	/*
	 * Range slider — horizontal or vertical. Wraps <input type="range"> so
	 * keyboard accessibility (arrow keys, Home/End, PgUp/PgDn) comes free.
	 * Track + thumb styling lives in `src/app.css` (the `.ct-slider` class)
	 * because pseudo-elements ::*-slider-thumb / ::*-range-track can't be
	 * reached from Tailwind utility classes.
	 *
	 * The audio-grade knob promised in scaffolding-plan §Phase 7 is a
	 * separate component; this Slider is the v0.1 fallback and the surface
	 * Phase 7's `createParamStore.bindTo` will demonstrate against.
	 */
	type Orientation = 'horizontal' | 'vertical';

	type Props = Omit<HTMLInputAttributes, 'value' | 'type'> & {
		value?: number;
		min?: number;
		max?: number;
		step?: number;
		orientation?: Orientation;
		label: string; // a11y — required even when visually omitted
	};

	let {
		value = $bindable(0),
		min = 0,
		max = 1,
		step = 0.01,
		orientation = 'horizontal',
		label,
		class: extraClass = '',
		...rest
	}: Props = $props();
</script>

<input
	type="range"
	{min}
	{max}
	{step}
	bind:value
	aria-label={label}
	aria-orientation={orientation}
	data-orientation={orientation}
	{...rest}
	class="ct-slider {orientation === 'vertical' ? 'h-full' : 'w-full'} {extraClass}"
/>
