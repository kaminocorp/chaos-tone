<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import { Circle, Play, Square } from '@lucide/svelte';
	import { isAudioSupported } from '$lib/audio/context';
	import { playTestTone } from '$lib/audio/test-tone';

	let audioError = $state<string | null>(null);

	async function handleTestTone() {
		audioError = null;
		if (!isAudioSupported()) {
			audioError = 'Web Audio is not supported in this browser.';
			return;
		}
		try {
			await playTestTone();
		} catch (err) {
			audioError = 'Could not start audio. Check the console.';
			console.error('[audio] test tone failed:', err);
		}
	}
</script>

<footer
	class="border-ink-800 bg-ink-900 text-ink-200 flex h-full w-full items-center justify-between border-t px-4"
	aria-label="Transport"
>
	<div class="flex items-center gap-2">
		<Button variant="primary" size="sm" disabled>
			<span class="inline-flex items-center gap-1.5">
				<Circle size={10} fill="currentColor" />
				Rec
			</span>
		</Button>
		<IconButton label="Play" variant="secondary" size="sm" disabled>
			<Play size={14} />
		</IconButton>
		<IconButton label="Stop" variant="secondary" size="sm" disabled>
			<Square size={14} />
		</IconButton>
	</div>
	<div class="flex items-center gap-2">
		<Button size="sm" variant="secondary" onclick={handleTestTone}>
			Test tone (will be removed)
		</Button>
		{#if audioError}
			<span class="text-xs text-red-400" role="alert">{audioError}</span>
		{/if}
		<span class="text-ink-400 font-mono text-xs">— BPM · —</span>
	</div>
	<div class="flex items-center gap-1">
		<Button size="sm" disabled>Keep</Button>
		<Button size="sm" disabled>Mutate</Button>
		<Button size="sm" disabled>Discard</Button>
	</div>
</footer>
