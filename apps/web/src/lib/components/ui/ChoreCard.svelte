<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import Badge, { type BadgeTone } from './Badge.svelte';

	/**
	 * - `personal`: orange-tinted icon tile.
	 * - `shared`: blue-tinted icon tile on a plain card.
	 * - `highlighted`: shared chore that is the viewer's turn (blue border, filled arrow).
	 * - `completed`: green icon tile and a check instead of the arrow. The text
	 *   stays at secondary contrast; the tile and check already say "done".
	 *
	 * Grows from lg to the Today · Desktop mock's card (SB-68).
	 */
	type Variant = 'personal' | 'shared' | 'highlighted' | 'completed';

	interface Props extends Omit<HTMLAnchorAttributes, 'title' | 'href'> {
		href: string;
		title: string;
		subtitle?: string;
		variant?: Variant;
		/** Omit to hide the points (e.g. completed chores). */
		points?: number;
		/** Status badge tone, e.g. `in-progress`, `todo`, `my-turn`, `completed`. */
		status?: BadgeTone;
		/** Icon rendered inside the leading tile (22px). */
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
		{ card: string; tile: string; action: string; points: string; text: string }
	> = {
		personal: {
			card: 'border-border-subtle bg-surface-default',
			tile: 'bg-surface-accent-orange-subtle text-text-orange',
			action: 'bg-surface-accent-orange-subtle text-text-orange',
			points: 'text-text-orange',
			text: 'text-text-primary',
		},
		shared: {
			card: 'border-border-subtle bg-surface-default',
			tile: 'bg-surface-accent-blue-subtle text-text-blue',
			action: 'bg-surface-accent-blue-subtle text-text-blue',
			points: 'text-text-blue',
			text: 'text-text-primary',
		},
		highlighted: {
			card: 'border-border-blue bg-surface-accent-blue-subtle',
			tile: 'bg-background-base text-text-blue',
			action: 'bg-accent-blue text-text-default',
			points: 'text-text-blue',
			text: 'text-text-primary',
		},
		completed: {
			card: 'border-border-subtle bg-surface-default',
			tile: 'bg-surface-accent-green-subtle text-text-green',
			action: 'bg-background-base text-text-muted',
			points: 'text-text-secondary',
			text: 'text-text-secondary',
		},
	};
	const v = $derived(variants[variant]);
	const filledArrow = $derived(variant === 'highlighted');
	const done = $derived(variant === 'completed');
</script>

<a
	{...rest}
	{href}
	data-variant={variant}
	class={[
		'flex min-h-[116px] w-full items-center gap-12 rounded-[16px] border p-16 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange lg:min-h-[138px]',
		v.card,
		className,
	]}
>
	<span
		class={['flex size-[36px] shrink-0 items-center justify-center rounded-[8px]', v.tile]}
		data-slot="icon-tile"
		aria-hidden="true"
	>
		<span class="flex size-[22px] items-center justify-center">
			{#if icon}{@render icon()}{/if}
		</span>
	</span>
	<span class="flex min-w-0 flex-1 flex-col gap-6">
		<span class={['font-display text-[15px] font-semibold lg:text-[18px]', v.text]}
			>{title}</span
		>
		{#if subtitle}
			<span
				class="text-[13px] leading-[1.4] text-text-secondary"
				>{subtitle}</span
			>
		{/if}
		{#if points !== undefined || status}
			<span class="flex items-center gap-8">
				{#if points !== undefined}
					<span class={['text-[11px] font-bold', v.points]}>{points} pts</span>
				{/if}
				{#if points !== undefined && status}
					<span class="size-[2px] shrink-0 rounded-full bg-border-muted" aria-hidden="true"
					></span>
				{/if}
				{#if status}<Badge tone={status} />{/if}
			</span>
		{/if}
	</span>
	<span
		class={['flex size-[28px] shrink-0 items-center justify-center rounded-full', v.action]}
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
			{#if done}
				<path d="M20 6 9 17l-5-5" />
			{:else}
				<path d="M5 12h14M12 5l7 7-7 7" />
			{/if}
		</svg>
	</span>
</a>
