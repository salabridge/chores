<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './MomentumCard.stories.svelte';
	import MomentumCard from './MomentumCard.svelte';

	const { Story } = defineMeta({
		title: 'Rewards/MomentumCard',
		component: MomentumCard,
		tags: ['autodocs'],
		args: {
			days: 3,
			goal: 4,
			loopsLeft: 1,
			percent: 75,
			message:
				"You're close to a 4-day personal streak and one more easy loop is enough to get there.",
			chores: [
				{ id: 'a', title: 'Recycling', href: '#' },
				{ id: 'b', title: 'Room reset', href: '#' },
				{ id: 'c', title: 'Bathroom loop', href: '#' },
			],
		},
	});
</script>

<Story name="Default" />

<Story
	name="No streak yet"
	args={{
		days: 0,
		goal: 3,
		loopsLeft: 3,
		percent: 0,
		message: 'Finish a loop today to start a streak.',
	}}
/>

<Story name="No chores left" args={{ chores: [] }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
