<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './MilestoneCard.stories.svelte';
	import MilestoneCard from './MilestoneCard.svelte';

	const { Story } = defineMeta({
		title: 'Rewards/MilestoneCard',
		component: MilestoneCard,
		tags: ['autodocs'],
		args: {
			title: 'Sundaes on Sunday',
			description:
				'Double scoop ice cream sundae night is the next family milestone you can realistically unlock.',
			current: 140,
			needed: 150,
			nextUp: true,
			note: '10 more points or 1 shared loop away.',
		},
	});
</script>

<Story name="Next up" />

<Story
	name="Upcoming"
	args={{
		title: 'Day trip',
		description: undefined,
		current: 40,
		needed: 400,
		nextUp: false,
		note: '360 more points or 9 shared loops away.',
	}}
/>

<Story
	name="Reached"
	args={{ current: 150, nextUp: false, reached: true, note: 'Unlocked this week.' }}
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
