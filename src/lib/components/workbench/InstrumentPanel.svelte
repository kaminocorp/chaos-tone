<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';

	const macros = ['Brightness', 'Movement', 'Body', 'Air'];
</script>

<section
	class="border-ink-800 bg-ink-900 text-ink-200 flex h-full w-full items-center gap-6 border-t px-4"
	aria-label="Instrument"
>
	<div class="flex flex-col gap-1">
		<div class="text-ink-500 font-mono text-[10px] tracking-widest uppercase">Voice</div>
		<div class="border-ink-700 text-ink-300 rounded-sm border px-2 py-1 font-mono text-xs">
			subtractive
		</div>
	</div>
	<div class="flex flex-1 items-center justify-around">
		{#each macros as macro (macro)}
			<div class="flex flex-col items-center gap-1">
				<!-- Macro knob placeholder — real audio-grade knob is Phase 7. -->
				<div class="border-ink-700 bg-ink-800 h-12 w-12 rounded-full border"></div>
				<div class="text-ink-500 font-mono text-[10px] tracking-wider uppercase">{macro}</div>
			</div>
		{/each}
	</div>
	<div class="flex items-center gap-1">
		<Button variant="ghost" size="sm" disabled>FX 1</Button>
		<Button variant="ghost" size="sm" disabled>FX 2</Button>
		<Button variant="ghost" size="sm" disabled>FX 3</Button>
	</div>
</section>
