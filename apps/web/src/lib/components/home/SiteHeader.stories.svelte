<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import {
		responsiveVisualTestParameters,
		VisualTestGrid,
	} from '#lib/visual-test/index.js';
	import * as thisFile from './SiteHeader.stories.svelte';
	import SiteHeader from './SiteHeader.svelte';

	const { Story } = defineMeta({
		title: 'Home/SiteHeader',
		component: SiteHeader,
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
