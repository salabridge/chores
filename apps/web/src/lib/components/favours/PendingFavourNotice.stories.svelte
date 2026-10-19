<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import { pendingByMia } from './fixtures.ts';
	import * as thisFile from './PendingFavourNotice.stories.svelte';
	import PendingFavourNotice from './PendingFavourNotice.svelte';

	const { Story } = defineMeta({
		title: 'Favours/PendingFavourNotice',
		component: PendingFavourNotice,
		tags: ['autodocs'],
		args: {
			favour: pendingByMia,
			title: 'Take Out Trash',
			points: 10,
			ownerName: 'Leo',
			viewer: { id: 'leo', isOwner: true, isParent: false },
			actions: {
				approve: fn(async () => {}),
				decline: fn(async () => {}),
				askParent: fn(async () => {}),
			},
		},
	});
</script>

<Story name="Owner decides" />

<Story
	name="Doer waits for the owner"
	args={{ viewer: { id: 'mia', isOwner: false, isParent: false } }}
/>

<Story
	name="Doer waits for a parent"
	args={{
		favour: { ...pendingByMia, escalated: true },
		viewer: { id: 'mia', isOwner: false, isParent: false },
	}}
/>

<Story
	name="Owner after it went to a parent"
	args={{ favour: { ...pendingByMia, escalated: true } }}
/>

<Story
	name="Parent decides"
	args={{
		favour: { ...pendingByMia, escalated: true },
		viewer: { id: 'dad', isOwner: false, isParent: true },
	}}
/>

<Story
	name="Someone else follows along"
	args={{ viewer: { id: 'sam', isOwner: false, isParent: false } }}
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
