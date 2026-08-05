<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import { Circle, Play, Square } from '@lucide/svelte';
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
		<span class="text-ink-400 font-mono text-xs">— BPM · —</span>
	</div>
	<div class="flex items-center gap-1">
		<Button size="sm" disabled>Keep</Button>
		<Button size="sm" disabled>Mutate</Button>
		<Button size="sm" disabled>Discard</Button>
	</div>
</footer>
