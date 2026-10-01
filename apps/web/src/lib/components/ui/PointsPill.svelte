<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLSpanElement> {
		points: number;
		/** `inline` is the compact star chip used on chore cards; `header` uses the ribbon icon. */
		variant?: 'inline' | 'header';
	}

	let {
		points,
		variant = 'inline',
		class: className,
		...rest
	}: Props = $props();

	const header = $derived(variant === 'header');
</script>

<span
	{...rest}
	data-variant={variant}
	class={[
		'inline-flex w-fit items-center whitespace-nowrap bg-surface-accent-orange-subtle text-text-orange',
		header
			? 'gap-6 rounded-[20px] px-12 py-6 font-display text-[14px] font-bold'
			: 'gap-4 rounded-[8px] px-8 py-4 text-[11px] font-bold',
		className,
	]}
>
	{#if header}
		<svg
			class="size-[16px] shrink-0"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
			data-icon="ribbon"
		>
			<circle cx="12" cy="8" r="6" />
			<path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
		</svg>
	{:else}
		<svg
			class="size-[12px] shrink-0"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
			data-icon="star"
		>
			<path
				d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
			/>
		</svg>
	{/if}
	{points} pts
</span>
