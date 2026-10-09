<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import {
		dishwasherDetail,
		toiletDetail,
		toiletDone,
		toiletWaiting,
	} from './fixtures.ts';
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

<Story name="Done for now" args={{ detail: toiletDone }} />

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
