<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import { noStreak, streakData } from './fixtures.js';
	import * as thisFile from './StreakScreen.stories.svelte';
	import StreakScreen from './StreakScreen.svelte';

	const { Story } = defineMeta({
		title: 'Streak/StreakScreen',
		component: StreakScreen,
		tags: ['autodocs'],
		parameters: { layout: 'fullscreen' },
		args: { data: streakData },
	});
</script>

<Story name="Default" />

<Story name="No streak" args={{ data: noStreak }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
