<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './ChoreStatusTable.stories.svelte';
	import ChoreStatusTable from './ChoreStatusTable.svelte';
	import { overviewRows } from './fixtures.ts';

	const { Story } = defineMeta({
		title: 'Overview/ChoreStatusTable',
		component: ChoreStatusTable,
		tags: ['autodocs'],
		args: { rows: overviewRows, loopHref: '#' },
	});

	const actions = { skip: fn(), remind: fn(), reopen: fn() };

	const failing = {
		skip: async () => {
			throw new Error('Could not skip this chore. Try again.');
		},
	};
</script>

<Story name="Actions not available yet" />

<Story
	name="Done as a favour"
	args={{ rows: overviewRows.filter((r) => r.doneBy), actions }}
/>

<Story name="With actions" args={{ actions }} />

<Story name="Failing action" args={{ actions: failing }} />

<Story name="Empty" args={{ rows: [] }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
