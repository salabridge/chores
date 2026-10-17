<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import ProgressBar from '#lib/components/ui/ProgressBar.svelte';
	import { plural } from '#lib/overview.js';
	import type { StreakWeek } from '#lib/streak.js';
	import Badge from '../ui/Badge.svelte';

	interface Props extends HTMLAttributes<HTMLElement> {
		week: StreakWeek;
	}

	let { week, class: className, ...rest }: Props = $props();

	const headingId = $props.id();
	const weekday = new Intl.DateTimeFormat('en-US', {
		weekday: 'long',
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC',
	});
	const dayName = (date: string) => weekday.format(new Date(`${date}T00:00:00Z`));
</script>

<section
	{...rest}
	aria-labelledby={headingId}
	class={[
		'flex flex-col gap-16 rounded-[16px] border border-border-subtle bg-surface-default p-16',
		className,
	]}
>
	<div class="flex items-center gap-12">
		<div class="flex min-w-0 flex-1 flex-col gap-2">
			<h2
				id={headingId}
				class="font-display text-[16px] font-bold text-text-primary"
			>
				Weekly activity
			</h2>
			<p class="text-[12px] text-text-secondary">{week.label}</p>
		</div>
		<Badge tone="personal">Week {week.number}</Badge>
	</div>

	<ol class="flex justify-between">
		{#each week.days as day (day.date)}
			<li class="flex w-[36px] flex-col items-center gap-6">
				<span class="text-[11px] font-semibold text-text-secondary" aria-hidden="true"
					>{day.letter}</span
				>
				<span
					data-active={day.active}
					class={[
						'flex size-[32px] items-center justify-center rounded-full',
						day.active ? 'bg-surface-accent-orange-subtle' : 'bg-surface-accent-base',
					]}
				>
					{#if day.active}
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="size-[18px] text-text-orange"
							aria-hidden="true"
						>
							<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
						</svg>
					{:else}
						<span class="text-[12px] text-text-muted" aria-hidden="true">–</span>
					{/if}
				</span>
				<span class="text-[11px] text-text-secondary" aria-hidden="true"
					>{day.dayOfMonth}</span
				>
				<span class="sr-only"
					>{dayName(day.date)}: {day.active ? 'streak day' : 'no streak'}</span
				>
			</li>
		{/each}
	</ol>

	<hr class="border-border-subtle" />

	<div class="flex items-center gap-12">
		<div class="flex min-w-0 flex-1 flex-col gap-8">
			<p class="text-[11px] font-bold text-text-orange">
				{week.done} of {plural(week.due, 'chore')} completed
			</p>
			<ProgressBar
				value={week.done}
				max={Math.max(week.due, 1)}
				variant="orange"
				aria-label="Chores completed this week"
			/>
		</div>
		<div class="flex w-[100px] shrink-0 flex-col items-end gap-4">
			<p class="text-[11px] text-text-secondary">Earned this week</p>
			<p class="font-display text-[18px] font-bold text-text-orange">
				{week.points} pts
			</p>
		</div>
	</div>
</section>
