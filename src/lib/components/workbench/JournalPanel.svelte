<script lang="ts">
	import Panel from '$lib/components/ui/Panel.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';

	let query = $state('');
</script>

<Panel title="Journal" ariaLabel="Journal" class="border-ink-800 border-r">
	<div class="flex h-full flex-col">
		<div class="border-ink-800 border-b p-3">
			<Input bind:value={query} type="search" placeholder="Search sketches…" disabled />
		</div>
		<div class="text-ink-400 flex-1 overflow-y-auto p-3 text-sm">
			<p>No sketches yet.</p>
		</div>
		<div class="border-ink-800 border-t p-3">
			<Button disabled size="sm" class="w-full">+ New sketch</Button>
		</div>
	</div>
</Panel>
