<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './ChoresList.stories.svelte';
	import ChoresList from './ChoresList.svelte';
	import { allChores, listMembers } from './choresListFixtures.ts';

	const { Story } = defineMeta({
		title: 'Chores/ChoresList',
		component: ChoresList,
		tags: ['autodocs'],
		parameters: { layout: 'padded' },
		argTypes: {
			grouping: { control: 'inline-radio', options: ['rotation', 'individual'] },
		},
		args: {
			chores: allChores,
			members: listMembers,
			grouping: 'rotation',
			showArchived: false,
			createHref: '#create',
			onarchive: fn(),
			onrestore: fn(),
			ondelete: fn(),
		},
	});
</script>

<Story name="Grouped by rotation" />

<Story name="Grouped by individual" args={{ grouping: 'individual' }} />

<Story name="Archived" args={{ showArchived: true }} />

<Story
	name="Delete refused"
	args={{
		showArchived: true,
		error: 'This chore has been completed, so it can’t be deleted. Archive it instead.',
	}}
/>

<Story name="Empty" args={{ chores: [] }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
