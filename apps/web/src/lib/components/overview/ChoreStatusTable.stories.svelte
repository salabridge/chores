<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
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

<Story name="With actions" args={{ actions }} />

<Story name="Failing action" args={{ actions: failing }} />

<Story name="Empty" args={{ rows: [] }} />
