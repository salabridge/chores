<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './KidsStep.stories.svelte';
	import KidsStep from './KidsStep.svelte';

	// The setup remote forms are mocked in .storybook/mocks, so submitting does nothing.
	const { Story } = defineMeta({
		title: 'Setup/KidsStep',
		component: KidsStep,
		tags: ['autodocs'],
		args: { onchanged: fn(), oncontinue: fn(), onback: fn(), kids: [] },
	});
</script>

<Story name="No kids yet">
	{#snippet template(args)}
		<div class="max-w-[360px]"><KidsStep {...args} /></div>
	{/snippet}
</Story>

<Story name="Two kids" args={{ kids: [{ id: 'k1', displayName: 'Mia', birthYear: 2017, weeklyGoalPoints: 200, avatarColor: 'blue' }, { id: 'k2', displayName: 'Leo', birthYear: null, weeklyGoalPoints: 150, avatarColor: 'green' }] }}>
	{#snippet template(args)}
		<div class="max-w-[360px]"><KidsStep {...args} /></div>
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
