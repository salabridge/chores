<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
		title: string;
		description?: string;
		/** Point cost, rendered as "{cost} Points". */
		cost: number;
		/** claimable: orange border + Claim button; claimed: Claimed pill; locked: disabled Claim. */
		status?: 'claimable' | 'claimed' | 'locked';
		onclaim?: () => void;
		/** Overrides the default trailing action (Claimed pill / Claim button). */
		action?: Snippet;
	}

	let {
		title,
		description,
		cost,
		status = 'locked',
		onclaim,
		action,
		class: className,
		...rest
	}: Props = $props();
</script>

<article
	{...rest}
	data-status={status}
	class={[
		'flex items-center gap-16 rounded-[16px] border bg-surface-default p-16',
		status === 'claimable' ? 'border-border-orange' : 'border-border-subtle',
		className,
	]}
>
	<span
		class="flex shrink-0 rounded-[12px] bg-surface-accent-orange-subtle p-12 text-text-orange"
		aria-hidden="true"
	>
		<!-- biome-ignore lint/a11y/noSvgWithoutTitle: decorative, parent is aria-hidden -->
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<rect x="3" y="8" width="18" height="4" rx="1" />
			<path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
			<path
				d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"
			/>
		</svg>
	</span>
	<div class="flex min-w-0 flex-1 flex-col gap-4">
		<h3 class="font-display text-[15px] font-semibold text-text-primary">
			{title}
		</h3>
		{#if description}
			<p class="text-[12px] text-text-secondary">{description}</p>
		{/if}
		<p class="text-[11px] font-semibold text-text-orange">{cost} Points</p>
	</div>
	{#if action}
		<div class="shrink-0">{@render action()}</div>
	{:else if status === 'claimed'}
		<span
			class="shrink-0 rounded-[8px] bg-surface-accent-green-subtle px-10 py-6 text-[12px] font-semibold text-text-green"
			>Claimed</span
		>
	{:else}
		<button
			type="button"
			disabled={status === 'locked'}
			onclick={() => onclaim?.()}
			class="shrink-0 rounded-[8px] bg-accent-orange px-10 py-6 text-[12px] font-semibold text-text-default transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange disabled:opacity-60"
			>Claim</button
		>
	{/if}
</article>
