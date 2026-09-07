<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { isAudioSupported } from '$lib/audio/context';
	import { applySession, isDeckRunning, startDeck, stopDeck } from '$lib/dj/deck';
	import type { DjSession } from '$lib/dj/session';
	import { onDestroy, onMount } from 'svelte';

	let session = $state<DjSession | null>(null);
	let deckOn = $state(false);
	let localBar = $state(0);
	let error = $state<string | null>(null);
	let pollTimer: ReturnType<typeof setInterval> | null = null;

	async function fetchSession(): Promise<DjSession | null> {
		try {
			const res = await fetch('/api/dj/session');
			if (!res.ok) throw new Error(`session_get ${res.status}`);
			const data = (await res.json()) as { session: DjSession };
			session = data.session;
			if (deckOn) applySession(data.session);
			return data.session;
		} catch (err) {
			console.error('[vdj] poll failed', err);
			return null;
		}
	}

	async function syncBar(bar: number) {
		localBar = bar;
		try {
			await fetch('/api/dj/bar', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ by: 1 })
			});
		} catch {
			/* non-fatal */
		}
	}

	async function handleStart() {
		error = null;
		if (deckOn) {
			stopDeck();
			deckOn = false;
			return;
		}
		if (!isAudioSupported()) {
			error = 'Web Audio is not supported in this browser.';
			return;
		}
		try {
			await startDeck({ onBar: syncBar });
			deckOn = true;
			const s = await fetchSession();
			if (s) applySession(s);
		} catch (err) {
			error = 'Could not start DJ deck. Check the console.';
			console.error('[vdj] start failed:', err);
		}
	}

	onMount(() => {
		void fetchSession();
		pollTimer = setInterval(() => {
			void fetchSession();
		}, 500);
	});

	onDestroy(() => {
		if (pollTimer) clearInterval(pollTimer);
		if (isDeckRunning()) stopDeck();
	});
</script>

<section
	class="border-ink-800 bg-ink-900/90 text-ink-200 absolute right-2 bottom-2 left-2 rounded-sm border px-3 py-2"
	aria-label="Virtual DJ"
>
	<div class="flex flex-wrap items-center justify-between gap-2">
		<div class="flex min-w-0 flex-col gap-0.5">
			<div class="text-ink-500 font-mono text-[10px] tracking-widest uppercase">Virtual DJ v0.2</div>
			<div class="font-mono text-xs tabular-nums">
				{#if session}
					E {session.energy.toFixed(2)} · rev {session.revision} · {session.bpm} BPM · {session.key} ·
					bar {session.bar}/{localBar} · {session.phase}
				{:else}
					polling session…
				{/if}
			</div>
			{#if session?.last_intent}
				<div class="text-ink-400 truncate font-mono text-[10px]" title={session.last_intent}>
					intent: {session.last_intent}
				</div>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			<Button variant="primary" size="sm" onclick={handleStart} aria-pressed={deckOn}>
				{deckOn ? 'Stop deck' : 'Start deck'}
			</Button>
			{#if error}
				<span class="text-xs text-red-400" role="alert">{error}</span>
			{/if}
		</div>
	</div>
	{#if session}
		<div class="text-ink-500 mt-1 flex flex-wrap gap-2 font-mono text-[10px] tracking-wider uppercase">
			{#each Object.entries(session.roles) as [role, state] (role)}
				<span
					class="border-ink-700 rounded border px-1.5 py-0.5 {state.mute
						? 'opacity-40'
						: ''} {state.solo ? 'border-accent-500 text-accent-400' : ''}"
				>
					{role}{state.mute ? ' mute' : ''}{state.solo ? ' solo' : ''}
				</span>
			{/each}
		</div>
	{/if}
</section>
