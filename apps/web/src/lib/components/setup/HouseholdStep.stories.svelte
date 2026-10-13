<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './HouseholdStep.stories.svelte';
	import HouseholdStep from './HouseholdStep.svelte';

	// The setup remote forms are mocked in .storybook/mocks, so submitting does nothing.
	const { Story } = defineMeta({
		title: 'Setup/HouseholdStep',
		component: HouseholdStep,
		tags: ['autodocs'],
		args: { onsaved: fn(), timezone: 'America/Chicago' },
	});
</script>

<Story name="New household">
	{#snippet template(args)}
		<div class="max-w-[360px]"><HouseholdStep {...args} /></div>
	{/snippet}
</Story>

<Story name="Resumed" args={{ name: 'The Smiths', timezone: 'America/New_York' }}>
	{#snippet template(args)}
		<div class="max-w-[360px]"><HouseholdStep {...args} /></div>
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
