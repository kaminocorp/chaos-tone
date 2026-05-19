<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	/*
	 * Square button for a single icon child. `label` is required and
	 * becomes the accessible name — IconButtons without labels are
	 * unannounced by screen readers and we want zero of those in the app.
	 */
	type Variant = 'secondary' | 'ghost';
	type Size = 'sm' | 'md' | 'lg';

	type Props = Omit<HTMLButtonAttributes, 'aria-label'> & {
		variant?: Variant;
		size?: Size;
		label: string;
		children: Snippet;
	};

	let {
		variant = 'ghost',
		size = 'md',
		label,
		children,
		type = 'button',
		class: extraClass = '',
		...rest
	}: Props = $props();

	const variantClass: Record<Variant, string> = {
		secondary: 'border border-ink-700 text-ink-300 hover:border-accent-500 hover:text-ink-100',
		ghost: 'border border-transparent text-ink-400 hover:bg-ink-800 hover:text-ink-100'
	};

	const sizeClass: Record<Size, string> = {
		sm: 'h-6 w-6',
		md: 'h-8 w-8',
		lg: 'h-10 w-10'
	};
</script>

<button
	{type}
	aria-label={label}
	{...rest}
	class="disabled:text-ink-500 inline-flex items-center justify-center rounded-sm transition-colors duration-[var(--duration-quick)] disabled:cursor-not-allowed disabled:hover:bg-transparent {variantClass[
		variant
	]} {sizeClass[size]} {extraClass}"
>
	{@render children()}
</button>
