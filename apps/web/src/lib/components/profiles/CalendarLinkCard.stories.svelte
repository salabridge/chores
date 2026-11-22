<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './CalendarLinkCard.stories.svelte';
	import CalendarLinkCard from './CalendarLinkCard.svelte';

	// `regenerateCalendarLink` is mocked in .storybook/mocks, so making a new
	// link does nothing. The fixed link keeps the snapshot from changing.
	const { Story } = defineMeta({
		title: 'Profiles/CalendarLinkCard',
		component: CalendarLinkCard,
		tags: ['autodocs'],
		args: {
			url: 'https://chores.example.com/calendar/Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4Zm9vYmFyYmE.ics',
			confirm: fn(() => true),
			copyText: fn(async () => {}),
		},
	});
</script>

<Story name="Default">
	{#snippet template(args)}
		<div class="max-w-[360px]"><CalendarLinkCard {...args} /></div>
	{/snippet}
</Story>

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
