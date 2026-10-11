<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './ExceptionsNotesPanel.stories.svelte';
	import ExceptionsNotesPanel from './ExceptionsNotesPanel.svelte';
	import { overviewNotes } from './fixtures.ts';

	const { Story } = defineMeta({
		title: 'Overview/ExceptionsNotesPanel',
		component: ExceptionsNotesPanel,
		tags: ['autodocs'],
		args: { notes: overviewNotes },
	});
</script>

<Story name="Default" />

<Story name="No notes" args={{ notes: [] }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
