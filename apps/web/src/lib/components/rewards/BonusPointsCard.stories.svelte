<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './BonusPointsCard.stories.svelte';
	import BonusPointsCard from './BonusPointsCard.svelte';

	// Fixed noon-UTC dates, so the formatted day doesn't change between builds.
	const gifts = [
		{
			id: 'g1',
			points: 20,
			reason: 'Helped Grandma with groceries',
			fromName: 'Mom',
			createdAt: '2026-10-14T12:00:00.000Z',
		},
		{
			id: 'g2',
			points: 5,
			reason: 'Good report card',
			fromName: null,
			createdAt: '2026-10-12T12:00:00.000Z',
		},
	];

	const { Story } = defineMeta({
		title: 'Rewards/BonusPointsCard',
		component: BonusPointsCard,
		tags: ['autodocs'],
		args: { gifts },
	});
</script>

<Story name="Default" />

<Story name="One gift" args={{ gifts: gifts.slice(0, 1) }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
