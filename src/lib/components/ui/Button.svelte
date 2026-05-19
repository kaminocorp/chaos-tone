<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	/*
	 * Base text button. Three visual variants, three sizes, and standard
	 * disabled semantics. Spread props pass through to the underlying
	 * <button>, so `aria-*`, `onclick`, `type`, etc. all work without
	 * being enumerated here.
	 */
	type Variant = 'primary' | 'secondary' | 'ghost';
	type Size = 'sm' | 'md' | 'lg';

	type Props = HTMLButtonAttributes & {
		variant?: Variant;
		size?: Size;
		children: Snippet;
	};

	let {
		variant = 'secondary',
		size = 'md',
		children,
		type = 'button',
		class: extraClass = '',
		...rest
	}: Props = $props();

	const variantClass: Record<Variant, string> = {
		primary:
			'border-accent-500 text-ink-100 hover:bg-accent-500/10 disabled:border-ink-700 disabled:text-ink-500',
		secondary:
			'border-ink-700 text-ink-300 hover:border-accent-500 hover:text-ink-100 disabled:text-ink-500 disabled:hover:border-ink-700 disabled:hover:text-ink-500',
		ghost:
			'border-transparent text-ink-300 hover:bg-ink-800 hover:text-ink-100 disabled:text-ink-500 disabled:hover:bg-transparent'
	};

	const sizeClass: Record<Size, string> = {
		sm: 'px-2 py-1 text-xs',
		md: 'px-3 py-1.5 text-sm',
		lg: 'px-4 py-2 text-base'
	};
</script>

<button
	{type}
	{...rest}
	class="rounded-sm border font-mono tracking-wider uppercase transition-colors duration-[var(--duration-quick)] disabled:cursor-not-allowed {variantClass[
		variant
	]} {sizeClass[size]} {extraClass}"
>
	{@render children()}
</button>
