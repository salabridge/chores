<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import {
		responsiveVisualTestParameters,
		VisualTestGrid,
	} from '#lib/visual-test/index.js';
	import { helpOutToday } from './fixtures.js';
	import * as thisFile from './HelpOut.stories.svelte';
	import HelpOut from './HelpOut.svelte';

	const { Story } = defineMeta({
		title: 'Today/HelpOut',
		component: HelpOut,
		tags: ['autodocs'],
		parameters: { layout: 'padded' },
		args: { items: helpOutToday.helpOut, open: false },
	});
</script>

<Story name="Collapsed" />

<Story name="Expanded" args={{ open: true }} />

<Story name="One chore" args={{ items: helpOutToday.helpOut.slice(0, 1), open: true }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={responsiveVisualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
