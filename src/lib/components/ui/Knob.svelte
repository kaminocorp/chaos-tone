<script lang="ts">
	import type { ParamStore } from '$stores/create-param-store.svelte';

	/*
	 * Audio-grade rotary knob (the one scaffolding-plan §Phase 7 promised).
	 *
	 * Unlike the other primitives, Knob takes a `ParamStore` directly instead
	 * of value/min/max props — the store IS the contract ("stores are the
	 * contract", frontend-overview.md), and duplicating its range at the call
	 * site would let the two drift apart. Callers write:
	 *
	 *   <Knob param={frequencyStore} />
	 *
	 * Interactions (all curve-aware via the store's normalized 0..1 space):
	 *   - drag vertically   — full range over ~200 px; Shift = 10× finer
	 *   - scroll wheel      — 1% per notch; Shift = 0.25%
	 *   - arrows / PgUp/PgDn / Home / End — 1% / 10% / min / max
	 *   - double-click      — reset to default
	 *
	 * The wheel listener is attached manually because Svelte 5 registers
	 * `onwheel` handlers as passive, and we need preventDefault() so turning
	 * the knob never scrolls the page.
	 */
	type Props = {
		param: ParamStore;
		class?: string;
	};

	let { param, class: extraClass = '' }: Props = $props();

	// 270° sweep, from 7 o'clock (-135°) to 5 o'clock (+135°), 0° = up.
	const SWEEP_START = -135;
	const SWEEP_RANGE = 270;
	const DRAG_RANGE_PX = 200;

	function point(r: number, deg: number) {
		const rad = (deg * Math.PI) / 180;
		return { x: 24 + r * Math.sin(rad), y: 24 - r * Math.cos(rad) };
	}

	function arcPath(r: number, fromDeg: number, toDeg: number) {
		const a = point(r, fromDeg);
		const b = point(r, toDeg);
		const large = toDeg - fromDeg > 180 ? 1 : 0;
		return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
	}

	const trackPath = arcPath(19, SWEEP_START, SWEEP_START + SWEEP_RANGE);
	const angle = $derived(SWEEP_START + SWEEP_RANGE * param.normalized);
	const valuePath = $derived(arcPath(19, SWEEP_START, angle));
	const indicator = $derived.by(() => {
		const a = point(5, angle);
		const b = point(11, angle);
		return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
	});

	let el = $state<HTMLDivElement | null>(null);
	let dragging = $state(false);
	let lastY = 0;

	function handlePointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		e.preventDefault(); // no text selection; focus is set manually below
		el?.focus();
		el?.setPointerCapture(e.pointerId);
		dragging = true;
		lastY = e.clientY;
	}

	function handlePointerMove(e: PointerEvent) {
		if (!dragging) return;
		const dy = lastY - e.clientY; // up = increase
		lastY = e.clientY;
		param.setNormalized(param.normalized + (dy / DRAG_RANGE_PX) * (e.shiftKey ? 0.1 : 1));
	}

	function handlePointerEnd(e: PointerEvent) {
		if (!dragging) return;
		dragging = false;
		if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
	}

	function handleKeydown(e: KeyboardEvent) {
		const step = e.shiftKey ? 0.0025 : 0.01;
		let handled = true;
		switch (e.key) {
			case 'ArrowUp':
			case 'ArrowRight':
				param.setNormalized(param.normalized + step);
				break;
			case 'ArrowDown':
			case 'ArrowLeft':
				param.setNormalized(param.normalized - step);
				break;
			case 'PageUp':
				param.setNormalized(param.normalized + 0.1);
				break;
			case 'PageDown':
				param.setNormalized(param.normalized - 0.1);
				break;
			case 'Home':
				param.value = param.min;
				break;
			case 'End':
				param.value = param.max;
				break;
			default:
				handled = false;
		}
		if (handled) e.preventDefault();
	}

	$effect(() => {
		const node = el;
		if (!node) return;
		const handleWheel = (e: WheelEvent) => {
			if (e.deltaY === 0) return;
			e.preventDefault();
			const dir = e.deltaY < 0 ? 1 : -1;
			param.setNormalized(param.normalized + dir * (e.shiftKey ? 0.0025 : 0.01));
		};
		node.addEventListener('wheel', handleWheel, { passive: false });
		return () => node.removeEventListener('wheel', handleWheel);
	});
</script>

<div
	bind:this={el}
	role="slider"
	tabindex="0"
	aria-label={param.label}
	aria-orientation="vertical"
	aria-valuemin={param.min}
	aria-valuemax={param.max}
	aria-valuenow={Math.round(param.value)}
	aria-valuetext={param.format()}
	class="group focus-visible:outline-accent-500 cursor-ns-resize touch-none rounded-full select-none focus-visible:outline-2 focus-visible:outline-offset-2 {extraClass}"
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={handlePointerEnd}
	onpointercancel={handlePointerEnd}
	ondblclick={() => param.reset()}
	onkeydown={handleKeydown}
>
	<svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true" class="block">
		<path
			d={trackPath}
			class="stroke-ink-700"
			stroke-width="2.5"
			fill="none"
			stroke-linecap="round"
		/>
		{#if param.normalized > 0.004}
			<path
				d={valuePath}
				class="stroke-accent-500"
				stroke-width="2.5"
				fill="none"
				stroke-linecap="round"
			/>
		{/if}
		<circle
			cx="24"
			cy="24"
			r="13"
			stroke-width="1"
			class="fill-ink-800 stroke-ink-700 group-hover:stroke-ink-600"
		/>
		<line
			x1={indicator.x1}
			y1={indicator.y1}
			x2={indicator.x2}
			y2={indicator.y2}
			stroke-width="2"
			stroke-linecap="round"
			class={dragging ? 'stroke-accent-400' : 'stroke-ink-100 group-hover:stroke-accent-400'}
		/>
	</svg>
</div>
