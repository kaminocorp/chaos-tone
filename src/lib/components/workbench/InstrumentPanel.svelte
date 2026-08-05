<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Knob from '$lib/components/ui/Knob.svelte';
	import { isAudioSupported } from '$lib/audio/context';
	import { startVoice, stopVoice } from '$lib/audio/voice';
	import { frequencyStore } from '$stores/instrument-params';

	const macros = ['Brightness', 'Movement', 'Body', 'Air'];

	let playing = $state(false);
	let audioError = $state<string | null>(null);

	async function toggleVoice() {
		audioError = null;
		if (playing) {
			stopVoice();
			playing = false;
			return;
		}
		if (!isAudioSupported()) {
			audioError = 'Web Audio is not supported in this browser.';
			return;
		}
		try {
			await startVoice();
			playing = true;
		} catch (err) {
			audioError = 'Could not start audio. Check the console.';
			console.error('[audio] voice start failed:', err);
		}
	}
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
	<div class="border-ink-800 flex items-center gap-3 border-l pl-6">
		<div class="flex flex-col items-center gap-1">
			<Knob param={frequencyStore} />
			<div class="text-ink-500 font-mono text-[10px] tracking-wider uppercase">Freq</div>
		</div>
		<Button variant="secondary" size="sm" aria-pressed={playing} onclick={toggleVoice}>
			{playing ? 'Stop tone' : 'Play tone'}
		</Button>
		{#if audioError}
			<span class="text-xs text-red-400" role="alert">{audioError}</span>
		{/if}
	</div>
	<div class="flex flex-1 items-center justify-around">
		{#each macros as macro (macro)}
			<div class="flex flex-col items-center gap-1">
				<!-- Macro knob placeholder — wired to stores when real voices land (v0.2). -->
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
