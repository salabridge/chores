<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import {
		responsiveVisualTestParameters,
		VisualTestGrid,
	} from '#lib/visual-test/index.js';
	import * as thisFile from './HomeFooter.stories.svelte';
	import HomeFooter from './HomeFooter.svelte';

	const { Story } = defineMeta({
		title: 'Home/HomeFooter',
		component: HomeFooter,
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
