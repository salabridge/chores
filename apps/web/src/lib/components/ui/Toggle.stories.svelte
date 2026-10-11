<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './Toggle.stories.svelte';
	import Toggle from './Toggle.svelte';

	const { Story } = defineMeta({
		title: 'UI/Toggle',
		component: Toggle,
		tags: ['autodocs'],
		args: { 'aria-label': 'Include in rotation', onclick: fn() },
	});
</script>

<Story name="Off" />

<Story name="On" args={{ checked: true }} />

<Story name="Disabled" args={{ disabled: true }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
