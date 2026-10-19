<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import { doerOptions } from '../chores/fixtures.ts';
	import {
		dishwasherDetail,
		toiletDetail,
		toiletDone,
		toiletDoneFavour,
		toiletFavour,
		toiletWaiting,
	} from './fixtures.ts';
	import * as thisFile from './RotationChoreDetail.stories.svelte';
	import RotationChoreDetail from './RotationChoreDetail.svelte';

	const { Story } = defineMeta({
		title: 'Rotations/RotationChoreDetail',
		component: RotationChoreDetail,
		tags: ['autodocs'],
		parameters: { layout: 'fullscreen' },
		args: {
			detail: toiletDetail,
			oncomplete: fn(async () => {}),
			oncompletestage: fn(async () => {}),
		},
	});
</script>

<Story name="My turn" />

<Story name="Someone else's turn" args={{ detail: toiletWaiting }} />

<Story name="Doing it for someone" args={{ detail: toiletFavour }} />

<Story
	name="Parent records who did it"
	args={{ detail: toiletFavour, doerOptions }}
/>

<Story name="Done for now" args={{ detail: toiletDone }} />

<Story name="Done by someone else" args={{ detail: toiletDoneFavour }} />

<Story
	name="First turn ever"
	args={{ detail: { ...toiletDetail, doneLast: null } }}
/>

<Story name="Staged rotation" args={{ detail: dishwasherDetail }} />

<Story
	name="Not due today"
	args={{
		detail: { ...toiletWaiting, availableToday: false, isMyTurn: true },
	}}
/>

<Story
	name="Failing"
	args={{
		oncomplete: async () => {
			throw new Error(
				'The turn has already moved on. Reload to see whose turn it is.',
			);
		},
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
