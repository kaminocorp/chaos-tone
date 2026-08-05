<script lang="ts">
	import { frequencyStore } from '$stores/instrument-params';
</script>

<section
	class="bg-ink-950 text-ink-400 relative flex h-full w-full items-center justify-center"
	aria-label="Stage"
>
	<div class="text-center">
		<div class="text-ink-500 font-mono text-xs tracking-widest uppercase">Stage</div>
		<!-- Live param readout — reads the same store the Knob writes. The real
		     audio-reactive visualization replaces this in a later phase. -->
		<div class="text-ink-200 mt-2 font-mono text-2xl tabular-nums">{frequencyStore.format()}</div>
		<div class="text-ink-500 mt-1 font-mono text-[10px] tracking-widest uppercase">
			{frequencyStore.label}
		</div>
	</div>
	<div
		class="text-ink-500 absolute top-2 right-2 flex gap-1 font-mono text-[10px] tracking-widest uppercase"
	>
		<span class="border-ink-700 rounded border px-1.5 py-0.5">2D</span>
		<span class="rounded border border-transparent px-1.5 py-0.5">3D</span>
	</div>
</section>
