<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './GiftMoment.stories.svelte';
	import GiftMoment from './GiftMoment.svelte';

	// Fixed dates, so nothing changes between builds (the moment doesn't show
	// them anyway).
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
			fromName: 'Dad',
			createdAt: '2026-10-13T12:00:00.000Z',
		},
		{
			id: 'g3',
			points: 10,
			reason: 'Walked the dog in the rain',
			fromName: null,
			createdAt: '2026-10-12T12:00:00.000Z',
		},
	];

	// No autodocs: the docs page renders every story at once, and each one
	// calls showModal(), which would stack the dialogs.
	const { Story } = defineMeta({
		title: 'Rewards/GiftMoment',
		component: GiftMoment,
		parameters: { layout: 'fullscreen' },
		args: { gifts: gifts.slice(0, 1), ondismiss: fn(), pending: false },
	});
</script>

<Story name="One gift" />

<Story name="Several gifts" args={{ gifts }} />

<Story name="Giver has left" args={{ gifts: gifts.slice(2) }} />

<Story name="Dismissing" args={{ pending: true }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
