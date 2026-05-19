<script lang="ts">
	import '../app.css';
	import SmallScreenBlocker from '$lib/components/SmallScreenBlocker.svelte';

	let { children } = $props();
</script>

<SmallScreenBlocker />
{@render children()}
