<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { loopExample } from '#lib/rotation-loops.js';
	import { dishwasherLoop, toiletLoop } from './fixtures.ts';
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
