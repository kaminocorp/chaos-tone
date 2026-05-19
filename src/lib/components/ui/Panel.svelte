<script lang="ts">
	import type { Snippet } from 'svelte';

	/*
	 * Region/section container with an optional header and collapsible
	 * body. Two snippet "slots":
	 *   - `children` — the panel body
	 *   - `actions`  — trailing header content (icons, toggles, counters)
	 *
	 * The collapsed state is bindable: callers can drive it from outside
	 * (`<Panel bind:collapsed={journalCollapsed} />`) or let it manage
	 * itself.
	 */
	type Props = {
		title?: string;
		collapsible?: boolean;
		collapsed?: boolean;
		ariaLabel?: string;
		children: Snippet;
		actions?: Snippet;
		class?: string;
	};

	let {
		title,
		collapsible = false,
		collapsed = $bindable(false),
		ariaLabel,
		children,
		actions,
		class: extraClass = ''
	}: Props = $props();

	function toggle() {
		collapsed = !collapsed;
	}
</script>

<section
	aria-label={ariaLabel ?? title}
	class="bg-ink-850 text-ink-200 flex h-full w-full flex-col {extraClass}"
>
	{#if title || actions}
		<header
			class="border-ink-800 flex items-center justify-between border-b px-3 py-2 text-xs tracking-wide uppercase"
		>
			{#if collapsible}
				<button
					type="button"
					onclick={toggle}
					class="text-ink-400 hover:text-ink-100 -mx-1 flex items-center gap-1 rounded-sm px-1"
					aria-expanded={!collapsed}
				>
					<span aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
					<span>{title}</span>
				</button>
			{:else if title}
				<span class="text-ink-400">{title}</span>
			{:else}
				<span></span>
			{/if}
			{#if actions}
				<div class="flex items-center gap-1">{@render actions()}</div>
			{/if}
		</header>
	{/if}
	{#if !collapsed}
		<div class="min-h-0 flex-1">{@render children()}</div>
	{/if}
</section>
