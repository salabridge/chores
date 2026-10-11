<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './RotationLoopVisual.stories.svelte';
	import RotationLoopVisual from './RotationLoopVisual.svelte';

	const { Story } = defineMeta({
		title: 'UI/RotationLoopVisual',
		component: RotationLoopVisual,
		tags: ['autodocs'],
		args: { doneLast: 'Leo', active: 'Mia', nextUp: 'Sam' },
	});
</script>

<Story name="Default" />

<Story name="Two members" args={{ doneLast: 'Leo', active: 'Mia', nextUp: 'Leo' }} />

<Story
	name="Long names"
	args={{
		doneLast: 'Maximilian',
		active: 'Anastasia',
		nextUp: 'Bartholomew',
	}}
>
	{#snippet template(args)}
		<div class="max-w-[320px]">
			<RotationLoopVisual {...args} />
		</div>
	{/snippet}
</Story>

<Story name="Nobody done yet" args={{ doneLast: null, active: 'Leo', nextUp: 'Mia' }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
