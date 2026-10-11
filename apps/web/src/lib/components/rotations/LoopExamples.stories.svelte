<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { loopExample } from '#lib/rotation-loops.js';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import { dishwasherLoop, toiletLoop } from './fixtures.ts';
	import * as thisFile from './LoopExamples.stories.svelte';
	import LoopExamples from './LoopExamples.svelte';

	const { Story } = defineMeta({
		title: 'Rotations/LoopExamples',
		component: LoopExamples,
		tags: ['autodocs'],
		parameters: { layout: 'padded' },
		args: { examples: [toiletLoop, dishwasherLoop].map(loopExample) },
	});
</script>

<Story name="Two loops" />

<Story name="No loops yet" args={{ examples: [] }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
