<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import {
		responsiveVisualTestParameters,
		VisualTestGrid,
	} from '#lib/visual-test/index.js';
	import { emptyToday, helpOutToday, todayData, weeklyDueToday } from './fixtures.js';
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

<Story name="Weekly chores with a due day" args={{ data: weeklyDueToday }} />

<Story name="Others' chores to help out with" args={{ data: helpOutToday }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={responsiveVisualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
