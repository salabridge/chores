<script lang="ts">
	import { joinNames, type OverviewStats, plural } from '#lib/overview.js';
	import Badge from '../ui/Badge.svelte';
	import StatCard from '../ui/StatCard.svelte';

	let { stats }: { stats: OverviewStats } = $props();

	const dueSoonCaption = $derived(
		stats.rotationsDueSoon === 0
			? 'Every rotation is caught up for today.'
			: `${joinNames(stats.dueSoonTitles.slice(0, 2))} ${
					stats.rotationsDueSoon === 1 ? 'needs' : 'need'
				} attention next.`,
	);
	const openToday = $derived(stats.dueToday - stats.completedToday);
</script>

<div
	class="grid grid-cols-1 gap-16 sm:grid-cols-2 xl:grid-cols-4"
	data-testid="overview-stats"
>
	<StatCard
		label="Total Loop Chores"
		value={plural(stats.totalChores, 'Chore')}
		caption="{plural(stats.sharedLoops, 'shared loop')} and {plural(
			stats.personalChores,
			'personal chore',
		)} {stats.sharedLoops + stats.personalChores === 1 ? 'is' : 'are'} live."
	>
		{#snippet badge()}
			<Badge tone="optional">{stats.totalChores} active</Badge>
		{/snippet}
	</StatCard>
	<StatCard
		label="Active Rotations"
		value="{stats.activeRotations} Active"
		caption={dueSoonCaption}
	>
		{#snippet badge()}
			<Badge tone="reachable">{stats.rotationsDueSoon} due soon</Badge>
		{/snippet}
	</StatCard>
	<StatCard
		label="Completed Today"
		value="{stats.completedToday} / {stats.dueToday}"
		caption={openToday === 0
			? 'Everything due today is done.'
			: `${plural(openToday, 'chore')} ${openToday === 1 ? 'is' : 'are'} still open.`}
	>
		{#snippet badge()}
			<Badge tone="earned">{stats.completedPercent}% done</Badge>
		{/snippet}
	</StatCard>
	<StatCard
		label="Family Streak"
		value={plural(stats.streakDays, 'Day')}
		caption={stats.firstException ?? 'No exclusion rules are active.'}
	>
		{#snippet badge()}
			<Badge tone="this-week">{plural(stats.exceptions, 'exception')}</Badge>
		{/snippet}
	</StatCard>
</div>
