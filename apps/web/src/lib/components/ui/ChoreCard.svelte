<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import Badge, { type BadgeTone } from './Badge.svelte';
	import PointsPill from './PointsPill.svelte';

	/**
	 * - `personal`: orange-tinted icon tile.
	 * - `shared`: blue-tinted icon tile on a plain card.
	 * - `highlighted`: shared chore that is the viewer's turn (blue border, filled arrow).
	 * - `completed`: dimmed, green icon tile.
	 */
	type Variant = 'personal' | 'shared' | 'highlighted' | 'completed';

	interface Props extends Omit<HTMLAnchorAttributes, 'title' | 'href'> {
		href: string;
		title: string;
		subtitle?: string;
		variant?: Variant;
		/** Omit to hide the points pill (e.g. completed chores). */
		points?: number;
		/** Status badge tone, e.g. `in-progress`, `todo`, `my-turn`, `completed`. */
		status?: BadgeTone;
		/** Icon rendered inside the leading tile (18px). */
		icon?: Snippet;
	}

	let {
		href,
		title,
		subtitle,
		variant = 'personal',
		points,
		status,
		icon,
		class: className,
		...rest
	}: Props = $props();

	const variants: Record<
		Variant,
		{ card: string; tile: string; arrow: string; icon: string }
	> = {
		personal: {
			card: 'border border-border-subtle bg-surface-default',
			tile: 'bg-surface-accent-orange-subtle',
			arrow: 'bg-surface-accent-orange-subtle',
			icon: 'text-text-orange',
		},
		shared: {
			card: 'border border-border-subtle bg-surface-default',
			tile: 'bg-surface-accent-blue-subtle',
			arrow: 'bg-surface-accent-blue-subtle',
			icon: 'text-text-blue',
		},
		highlighted: {
			card: 'border-2 border-border-blue bg-surface-accent-blue-subtle',
			tile: 'bg-surface-default',
			arrow: 'bg-accent-blue',
			icon: 'text-text-blue',
		},
		completed: {
			card: 'border border-border-subtle bg-surface-default opacity-60',
			tile: 'bg-surface-accent-green-subtle',
			arrow: 'bg-surface-accent-base',
			icon: 'text-text-green',
		},
	};
	const v = $derived(variants[variant]);
	const filledArrow = $derived(variant === 'highlighted');
</script>

<a
	{...rest}
	{href}
	data-variant={variant}
	class={[
		'flex w-full items-center gap-12 rounded-[16px] p-16 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange',
		v.card,
		className,
	]}
>
	<span
		class={['flex shrink-0 items-center justify-center rounded-[12px] p-10', v.tile, v.icon]}
		data-slot="icon-tile"
		aria-hidden="true"
	>
		<span class="flex size-[18px] items-center justify-center">
			{#if icon}{@render icon()}{/if}
		</span>
	</span>
	<span class="flex min-w-0 flex-1 flex-col gap-4">
		<span class="font-display text-[15px] font-semibold text-text-primary">{title}</span>
		{#if subtitle}
			<span class="text-[13px] text-text-secondary">{subtitle}</span>
		{/if}
		{#if points !== undefined || status}
			<span class="flex items-center gap-8">
				{#if points !== undefined}<PointsPill {points} />{/if}
				{#if status}<Badge tone={status} />{/if}
			</span>
		{/if}
	</span>
	<span
		class={[
			'flex size-[28px] shrink-0 items-center justify-center rounded-[14px]',
			v.arrow,
			filledArrow ? 'text-text-default' : 'text-text-secondary',
		]}
		data-slot="arrow"
		data-filled={filledArrow}
		aria-hidden="true"
	>
		<!-- biome-ignore lint/a11y/noSvgWithoutTitle: decorative, parent is aria-hidden -->
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M5 12h14M12 5l7 7-7 7" />
		</svg>
	</span>
</a>
