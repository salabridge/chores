<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import {
		responsiveVisualTestParameters,
		VisualTestGrid,
	} from '#lib/visual-test/index.js';
	import * as thisFile from './HomeFeatures.stories.svelte';
	import HomeFeatures from './HomeFeatures.svelte';

	const { Story } = defineMeta({
		title: 'Home/HomeFeatures',
		component: HomeFeatures,
		tags: ['autodocs'],
		parameters: { layout: 'fullscreen' },

	});
</script>

<Story name="Default" />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={responsiveVisualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
