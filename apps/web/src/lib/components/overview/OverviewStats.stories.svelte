<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { overviewStats } from './fixtures.ts';
	import OverviewStats from './OverviewStats.svelte';

	const { Story } = defineMeta({
		title: 'Overview/OverviewStats',
		component: OverviewStats,
		tags: ['autodocs'],
		parameters: { layout: 'fullscreen' },
		args: { stats: overviewStats },
	});

	const caughtUp = {
		...overviewStats,
		rotationsDueSoon: 0,
		dueSoonTitles: [],
		completedToday: 12,
		completedPercent: 100,
		exceptions: 0,
		firstException: null,
	};

	const empty = {
		...caughtUp,
		totalChores: 0,
		sharedLoops: 0,
		personalChores: 0,
		activeRotations: 0,
		completedToday: 0,
		dueToday: 0,
		completedPercent: 0,
		streakDays: 0,
	};
</script>

<Story name="Default" />

<Story name="Caught up" args={{ stats: caughtUp }} />

<Story name="Empty household" args={{ stats: empty }} />
