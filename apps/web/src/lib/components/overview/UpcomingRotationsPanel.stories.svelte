<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { upcomingRotations } from './fixtures.ts';
	import UpcomingRotationsPanel from './UpcomingRotationsPanel.svelte';

	const { Story } = defineMeta({
		title: 'Overview/UpcomingRotationsPanel',
		component: UpcomingRotationsPanel,
		tags: ['autodocs'],
		args: { rotations: upcomingRotations, loopHref: '#' },
	});
</script>

<Story name="Default" />

<Story name="Nothing due today" args={{ rotations: upcomingRotations.slice(2) }} />

<Story name="No rotations" args={{ rotations: [] }} />
