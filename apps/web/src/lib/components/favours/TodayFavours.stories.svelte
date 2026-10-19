<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import {
		responsiveVisualTestParameters,
		VisualTestGrid,
	} from '#lib/visual-test/index.js';
	import { leoFavours, miaFavours } from './fixtures.ts';
	import * as thisFile from './TodayFavours.stories.svelte';
	import TodayFavours from './TodayFavours.svelte';

	const { Story } = defineMeta({
		title: 'Favours/TodayFavours',
		component: TodayFavours,
		tags: ['autodocs'],
		args: {
			favours: leoFavours,
			actions: {
				approve: fn(async () => {}),
				decline: fn(async () => {}),
				askParent: fn(async () => {}),
			},
		},
	});
</script>

<Story name="Needs your OK" />

<Story name="Your favours" args={{ favours: miaFavours }} />

<Story
	name="Both"
	args={{
		favours: { toApprove: leoFavours.toApprove, mine: miaFavours.mine.slice(0, 2) },
	}}
/>

<Story name="Nothing" args={{ favours: { toApprove: [], mine: [] } }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={responsiveVisualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
