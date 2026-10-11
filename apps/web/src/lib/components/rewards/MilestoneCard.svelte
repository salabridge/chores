<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import ProgressBar from '#lib/components/ui/ProgressBar.svelte';

	interface Props extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
		title: string;
		description?: string | null;
		/** Household points this week, capped at `needed`. */
		current: number;
		/** Weekly household points that unlock it. */
		needed: number;
		/** The closest milestone not yet reached: blue card and a "Next up" pill. */
		nextUp?: boolean;
		reached?: boolean;
		/** Line under the bar, e.g. "10 more points or 1 shared loop away." */
		note?: string;
	}

	let {
		title,
		description,
		current,
		needed,
		nextUp = false,
		reached = false,
		note,
		class: className,
		...rest
	}: Props = $props();

	const headingId = $props.id();
</script>

<article
	{...rest}
	aria-labelledby={headingId}
	data-state={reached ? 'reached' : nextUp ? 'next-up' : 'upcoming'}
	class={[
		'flex flex-col gap-12 rounded-[16px] border p-16',
		nextUp
			? 'border-border-blue bg-surface-accent-blue-subtle'
			: 'border-border-subtle bg-surface-default',
		className,
	]}
>
	<div class="flex items-center justify-between gap-12">
		<div class="flex min-w-0 flex-1 flex-col gap-4">
			<h3
				id={headingId}
				class="font-display text-[15px] font-semibold text-text-primary"
			>
				{title}
			</h3>
			{#if description}
				<p class="text-[13px] text-text-secondary">{description}</p>
			{/if}
		</div>
		{#if reached}
			<span
				class="shrink-0 rounded-[8px] bg-surface-accent-green-subtle px-10 py-6 text-[11px] font-bold text-text-green"
				>Unlocked</span
			>
		{:else if nextUp}
			<span
				class="shrink-0 rounded-[8px] bg-accent-blue px-10 py-6 text-[11px] font-bold text-text-default"
				>Next up</span
			>
		{/if}
	</div>
	<div class="flex flex-col gap-6">
		<ProgressBar
			value={current}
			max={needed}
			variant={reached ? 'green' : 'blue'}
			aria-label="{title} progress"
		/>
		<div class="flex justify-between text-[12px]">
			<span class="text-text-secondary">{current} pts earned</span>
			<span class="font-semibold text-text-primary">{needed} pts needed</span>
		</div>
	</div>
	{#if note}
		<p class="flex items-center gap-8 text-[12px] text-text-secondary">
			<svg
				class="size-[12px] shrink-0 text-accent-blue"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path
					d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
				/>
			</svg>
			{note}
		</p>
	{/if}
</article>
