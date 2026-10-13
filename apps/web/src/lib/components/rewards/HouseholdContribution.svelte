<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import Badge from '#lib/components/ui/Badge.svelte';
	import SummaryTile from '#lib/components/ui/SummaryTile.svelte';
	import SurfaceCard from '#lib/components/ui/SurfaceCard.svelte';

	interface Props extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
		/** Rotation loops the household completed this week. */
		loops: number;
		/** The member's personal streak in days. */
		streakDays: number;
		/** Points the household earned this week. */
		points: number;
		/** Line by the points chip, e.g. "2 more loops unlock the next family reward." */
		summary: string;
	}

	let { loops, streakDays, points, summary, ...rest }: Props = $props();
</script>

<SurfaceCard
	{...rest}
	title="Household contribution"
	subtitle="Everyone's loop progress is shown here so the family can see what's already been earned."
	class="p-16"
>
	{#snippet badge()}
		<Badge tone="this-week">This Week</Badge>
	{/snippet}
	<div class="flex gap-12">
		<SummaryTile
			tone="blue"
			label="Household"
			value={`${loops} ${loops === 1 ? 'loop' : 'loops'}`}
			caption="completed together"
			class="flex-1"
		/>
		<SummaryTile
			tone="orange"
			label="Momentum"
			value={`${streakDays}-day streak`}
			caption="personal loops completed"
			class="flex-1"
		/>
	</div>
	<div class="flex items-center justify-between gap-12">
		<p class="text-[12px] text-text-secondary">{summary}</p>
		<span
			class="inline-flex shrink-0 items-center rounded-full bg-surface-accent-green-subtle px-10 py-6 text-[11px] font-bold text-text-green"
			>{points} pts earned</span
		>
	</div>
</SurfaceCard>
