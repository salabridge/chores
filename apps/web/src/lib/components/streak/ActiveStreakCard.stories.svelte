<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './ActiveStreakCard.stories.svelte';
	import ActiveStreakCard from './ActiveStreakCard.svelte';

	const { Story } = defineMeta({
		title: 'Streak/ActiveStreakCard',
		component: ActiveStreakCard,
		tags: ['autodocs'],
		args: { days: 5, goal: 7, note: 'Mia is catching up!' },
	});
</script>

<Story name="Default" />

<Story name="With exception" args={{ days: 12, goal: 14, exceptions: 1 }} />

<Story name="No note" args={{ note: null }} />

<Story name="No streak" args={{ days: 0, goal: 3, note: null }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
