<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import { NOW, panelFavours } from '../favours/fixtures.ts';
	import * as thisFile from './FavoursToApprovePanel.stories.svelte';
	import FavoursToApprovePanel from './FavoursToApprovePanel.svelte';

	const { Story } = defineMeta({
		title: 'Overview/FavoursToApprovePanel',
		component: FavoursToApprovePanel,
		tags: ['autodocs'],
		args: {
			favours: panelFavours,
			now: NOW,
			actions: { approve: fn(async () => {}), decline: fn(async () => {}) },
		},
	});
</script>

<Story name="Escalated first" />

<Story name="One favour" args={{ favours: panelFavours.slice(2) }} />

<Story
	name="Failing"
	args={{
		actions: {
			approve: async () => {
				throw new Error('Someone already decided this favour.');
			},
			decline: async () => {},
		},
	}}
/>

<Story name="Empty (renders nothing)" args={{ favours: [] }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
