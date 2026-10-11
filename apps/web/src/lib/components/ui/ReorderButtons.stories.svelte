<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './ReorderButtons.stories.svelte';
	import ReorderButtons from './ReorderButtons.svelte';

	const { Story } = defineMeta({
		title: 'UI/ReorderButtons',
		component: ReorderButtons,
		tags: ['autodocs'],
		args: { name: 'Leo', canMoveUp: true, canMoveDown: true, onmove: fn() },
	});
</script>

<Story name="Default" />

<Story name="First in order" args={{ canMoveUp: false }} />

<Story name="Last in order" args={{ canMoveDown: false }} />

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
