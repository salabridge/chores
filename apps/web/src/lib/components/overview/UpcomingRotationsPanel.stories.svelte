<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import { upcomingRotations } from './fixtures.ts';
	import * as thisFile from './UpcomingRotationsPanel.stories.svelte';
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

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
