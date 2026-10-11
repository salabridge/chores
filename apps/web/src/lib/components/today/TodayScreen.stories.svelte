<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import { emptyToday, todayData } from './fixtures.js';
	import * as thisFile from './TodayScreen.stories.svelte';
	import TodayScreen from './TodayScreen.svelte';

	const { Story } = defineMeta({
		title: 'Today/TodayScreen',
		component: TodayScreen,
		tags: ['autodocs'],
		parameters: { layout: 'fullscreen' },
		args: { data: todayData },
	});
</script>

<Story name="Default" />

<Story
	name="Streak with exception"
	args={{
		data: { ...todayData, streak: { days: 12, exceptions: 1 } },
	}}
/>

<Story name="No priority loop" args={{ data: { ...todayData, priority: null } }} />

<Story name="Empty" args={{ data: emptyToday }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
