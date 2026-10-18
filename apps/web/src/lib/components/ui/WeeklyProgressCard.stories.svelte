<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './WeeklyProgressCard.stories.svelte';
	import WeeklyProgressCard from './WeeklyProgressCard.svelte';

	const { Story } = defineMeta({
		title: 'UI/WeeklyProgressCard',
		component: WeeklyProgressCard,
		tags: ['autodocs'],
		args: { label: 'Oct 5–11', number: 41, done: 6, due: 10, points: 85 },
	});
</script>

<Story name="Default" />

<Story name="All done" args={{ done: 10, due: 10, points: 140 }} />

<Story name="Start of the week" args={{ done: 0, due: 0, points: 0 }} />

<Story name="Across a month" args={{ label: 'Sep 28–Oct 4', number: 40 }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
