<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './HouseholdContribution.stories.svelte';
	import HouseholdContribution from './HouseholdContribution.svelte';

	const { Story } = defineMeta({
		title: 'Rewards/HouseholdContribution',
		component: HouseholdContribution,
		tags: ['autodocs'],
		args: {
			loops: 6,
			streakDays: 3,
			points: 160,
			summary: '2 more loops unlock the next family reward.',
		},
	});
</script>

<Story name="Default" />

<Story
	name="Quiet week"
	args={{
		loops: 0,
		streakDays: 0,
		points: 0,
		summary: 'No family rewards are set up yet.',
	}}
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
