<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import { noStreak, streakWeek } from './fixtures.js';
	import * as thisFile from './WeeklyActivity.stories.svelte';
	import WeeklyActivity from './WeeklyActivity.svelte';

	const { Story } = defineMeta({
		title: 'Streak/WeeklyActivity',
		component: WeeklyActivity,
		tags: ['autodocs'],
		args: { week: streakWeek },
	});
</script>

<Story name="Default" />

<Story name="Empty week" args={{ week: noStreak.week }} />

<Story
	name="Across months"
	args={{ week: { ...streakWeek, label: 'Sep 28–Oct 4', number: 40 } }}
/>

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
