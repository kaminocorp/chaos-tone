<script lang="ts">
	// Stub — magic-link flow lands in Phase 5. The shape (single email input
	// + "send magic link" button) is documented in frontend-overview.md §6.3.
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';

	let email = $state('');
</script>

<main class="bg-ink-950 text-ink-200 grid min-h-screen place-items-center">
	<div class="w-full max-w-xs text-center">
		<h1 class="text-ink-300 font-mono text-sm tracking-widest uppercase">Chaos Tone</h1>
		<p class="text-ink-400 mt-6 text-sm">Magic-link login arrives in Phase 5.</p>
		<form class="mt-6 flex flex-col gap-3" onsubmit={(e) => e.preventDefault()}>
			<Input bind:value={email} type="email" placeholder="you@example.com" disabled />
			<Button type="submit" size="md" disabled>Send magic link</Button>
		</form>
	</div>
</main>
