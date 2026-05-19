<script lang="ts">
	/*
	 * Full-screen blocker when the viewport is below the desktop threshold.
	 * Per docs/executing/frontend-overview.md §6.4: no degraded responsive
	 * Workbench in Alpha — just a calm, honest message.
	 *
	 * Threshold is `min-width: 1024px`. We listen to a `matchMedia` instead
	 * of polling resize: it fires once per crossing, not on every pixel.
	 */
	let supported = $state(true);

	$effect(() => {
		const mql = window.matchMedia('(min-width: 1024px)');
		supported = mql.matches;
		const onChange = (e: MediaQueryListEvent) => (supported = e.matches);
		mql.addEventListener('change', onChange);
		return () => mql.removeEventListener('change', onChange);
	});
</script>

{#if !supported}
	<div
		class="bg-ink-950 text-ink-100 fixed inset-0 z-50 flex items-center justify-center px-6 text-center"
		role="alertdialog"
		aria-labelledby="ssb-title"
	>
		<div class="max-w-sm">
			<h1 id="ssb-title" class="text-ink-300 font-mono text-sm tracking-widest uppercase">
				Chaos Tone
			</h1>
			<p class="text-ink-200 mt-4 text-base">Desktop only for now.</p>
			<p class="text-ink-400 mt-2 text-sm">
				The Workbench is a dense console — small screens get a real layout later, not a squished one
				now.
			</p>
		</div>
	</div>
{/if}
