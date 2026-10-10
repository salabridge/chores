<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
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
