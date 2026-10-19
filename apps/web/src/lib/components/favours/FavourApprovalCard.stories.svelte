<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './FavourApprovalCard.stories.svelte';
	import FavourApprovalCard from './FavourApprovalCard.svelte';
	import { needsOk } from './fixtures.ts';

	const { Story } = defineMeta({
		title: 'Favours/FavourApprovalCard',
		component: FavourApprovalCard,
		tags: ['autodocs'],
		args: {
			item: needsOk,
			actions: { approve: fn(async () => {}), decline: fn(async () => {}) },
		},
	});

	const failing = {
		approve: async () => {
			throw new Error('Someone already decided this favour.');
		},
		decline: async () => {},
	};
</script>

<Story name="Mia says she did it" />

<Story
	name="One point"
	args={{ item: { ...needsOk, points: 1 } }}
/>

<Story name="Someone who has left" args={{ item: { ...needsOk, doneBy: null } }} />

<Story name="Failing" args={{ actions: failing }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
