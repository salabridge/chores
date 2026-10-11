<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './RewardCard.stories.svelte';
	import RewardCard from './RewardCard.svelte';

	const { Story } = defineMeta({
		title: 'UI/RewardCard',
		component: RewardCard,
		tags: ['autodocs'],
		argTypes: {
			status: {
				control: 'inline-radio',
				options: ['claimable', 'claimed', 'locked'],
			},
		},
		args: {
			title: 'Movie night pick',
			description: 'Choose the film for Friday',
			cost: 100,
			status: 'claimable',
			onclaim: fn(),
		},
	});
</script>

<Story name="Claimable" />

<Story name="Claimed" args={{ status: 'claimed' }} />

<Story name="Locked" args={{ status: 'locked', cost: 500, title: 'Day trip' }} />

<Story name="No description" args={{ description: undefined }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
