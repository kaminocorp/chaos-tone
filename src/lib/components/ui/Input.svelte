<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	/*
	 * Text-like input wrapper. Value is bindable, so consumers can use
	 * `<Input bind:value={query} />`. The HTML <input> defaults to
	 * `type="text"`, but we accept `type` overrides for email/search/etc.
	 *
	 * Number, range, file, checkbox, and radio go through dedicated
	 * primitives — this is the "single-line text-y" primitive.
	 */
	type Props = Omit<HTMLInputAttributes, 'value'> & {
		value?: string;
	};

	let { value = $bindable(''), type = 'text', class: extraClass = '', ...rest }: Props = $props();
</script>

<input
	{type}
	bind:value
	{...rest}
	class="border-ink-700 bg-ink-900 text-ink-100 placeholder:text-ink-500 focus:border-accent-500 disabled:text-ink-400 disabled:placeholder:text-ink-600 w-full rounded-sm border px-3 py-1.5 text-sm focus:outline-none disabled:cursor-not-allowed {extraClass}"
/>
