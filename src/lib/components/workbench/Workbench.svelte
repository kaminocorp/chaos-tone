<script lang="ts">
	import TopBar from './TopBar.svelte';
	import JournalPanel from './JournalPanel.svelte';
	import Stage from './Stage.svelte';
	import ChaosPanel from './ChaosPanel.svelte';
	import InstrumentPanel from './InstrumentPanel.svelte';
	import TransportBar from './TransportBar.svelte';
</script>

<!--
	Canonical Workbench grid — see docs/executing/frontend-overview.md §3.
	Rows: TopBar | (Journal | Stage | Chaos) | Instrument | Transport.
	Sizes are starting points and will be revisited once wireframes land.
-->
<div
	class="bg-ink-950 text-ink-100 grid h-screen w-screen overflow-hidden"
	style="grid-template-rows: 48px minmax(0, 1fr) 220px 64px; grid-template-columns: 280px minmax(0, 1fr) 320px;"
>
	<div class="col-span-3 row-start-1"><TopBar /></div>

	<div class="col-start-1 row-start-2 min-h-0"><JournalPanel /></div>
	<div class="col-start-2 row-start-2 min-h-0"><Stage /></div>
	<div class="col-start-3 row-start-2 min-h-0"><ChaosPanel /></div>

	<div class="col-span-3 row-start-3 min-h-0"><InstrumentPanel /></div>
	<div class="col-span-3 row-start-4 min-h-0"><TransportBar /></div>
</div>
