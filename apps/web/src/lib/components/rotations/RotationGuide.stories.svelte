<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './RotationGuide.stories.svelte';
	import RotationGuide from './RotationGuide.svelte';

	const { Story } = defineMeta({
		title: 'Rotations/RotationGuide',
		component: RotationGuide,
		tags: ['autodocs'],
		parameters: { layout: 'padded' },
	});
</script>

<Story name="Default">
	{#snippet template()}
		<div class="flex max-w-[340px] flex-col gap-24">
			<RotationGuide />
		</div>
	{/snippet}
</Story>

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
