<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import {
		responsiveVisualTestParameters,
		VisualTestGrid,
	} from '#lib/visual-test/index.js';
	import { weeklyDueToday } from './fixtures.js';
	import * as thisFile from './LaterThisWeek.stories.svelte';
	import LaterThisWeek from './LaterThisWeek.svelte';

	const { Story } = defineMeta({
		title: 'Today/LaterThisWeek',
		component: LaterThisWeek,
		tags: ['autodocs'],
		parameters: { layout: 'padded' },
		args: { items: weeklyDueToday.later, open: false },
	});
</script>

<Story name="Collapsed" />

<Story name="Expanded" args={{ open: true }} />

<Story name="One chore" args={{ items: weeklyDueToday.later.slice(0, 1), open: true }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={responsiveVisualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
