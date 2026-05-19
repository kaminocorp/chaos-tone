<script lang="ts">
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import { Command, User } from '@lucide/svelte';
</script>

<header
	class="border-ink-800 bg-ink-900 text-ink-200 flex h-full w-full items-center justify-between border-b px-4"
>
	<div class="flex items-baseline gap-3">
		<span class="text-ink-100 font-mono text-sm tracking-tight">Chaos Tone</span>
		<span class="text-ink-400 text-xs">untitled · —</span>
	</div>
	<div class="text-ink-400 flex items-center gap-2">
		<IconButton label="Open command palette" size="sm">
			<Command size={14} />
		</IconButton>
		<IconButton label="Account menu" size="sm" variant="secondary">
			<User size={14} />
		</IconButton>
	</div>
</header>
