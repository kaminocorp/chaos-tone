<script lang="ts">
	import Panel from '$lib/components/ui/Panel.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Slider from '$lib/components/ui/Slider.svelte';

	const axes = ['Chaos', 'Structure', 'Timbre', 'Glue', 'Temp', 'Density'] as const;
	type Axis = (typeof axes)[number];

	// Local $state for now — Phase 7+ binds these to the real randomness
	// session store. The 0.5 default places each thumb at the middle.
	const weights: Record<Axis, number> = $state({
		Chaos: 0.5,
		Structure: 0.5,
		Timbre: 0.5,
		Glue: 0.5,
		Temp: 0.5,
		Density: 0.5
	});
</script>

<Panel title="Chaos" ariaLabel="Chaos" class="border-ink-800 border-l">
	<div class="flex h-full flex-col">
		<div class="flex flex-1 items-end justify-around gap-2 p-3">
			{#each axes as axis (axis)}
				<div class="flex h-full flex-col items-center gap-2">
					<div class="h-32">
						<Slider
							bind:value={weights[axis]}
							orientation="vertical"
							label="{axis} weight"
							min={0}
							max={1}
							step={0.01}
						/>
					</div>
					<div class="text-ink-500 font-mono text-[10px] tracking-wider uppercase">{axis}</div>
				</div>
			{/each}
		</div>
		<div class="border-ink-800 border-t p-3">
			<Button disabled size="sm" class="w-full">Mutate ▸</Button>
		</div>
	</div>
</Panel>
