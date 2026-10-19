<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import {
		approvedByOwner,
		approvedByParent,
		declinedByOwner,
		declinedByParent,
		waitingForOwner,
		waitingForParent,
	} from './fixtures.ts';
	import * as thisFile from './MyFavourCard.stories.svelte';
	import MyFavourCard from './MyFavourCard.svelte';

	const { Story } = defineMeta({
		title: 'Favours/MyFavourCard',
		component: MyFavourCard,
		tags: ['autodocs'],
		args: {
			item: waitingForOwner,
			actions: { askParent: fn(async () => {}) },
		},
	});
</script>

<Story name="Waiting for the owner" />

<Story name="Waiting for a parent" args={{ item: waitingForParent }} />

<Story name="Approved by the owner" args={{ item: approvedByOwner }} />

<Story name="Approved by a parent" args={{ item: approvedByParent }} />

<Story name="Declined by the owner" args={{ item: declinedByOwner }} />

<Story name="Declined by a parent" args={{ item: declinedByParent }} />

<Story
	name="Asking fails"
	args={{
		actions: {
			askParent: async () => {
				throw new Error('A parent already decided this favour.');
			},
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
