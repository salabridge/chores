<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './PriorityCallout.stories.svelte';
	import PriorityCallout from './PriorityCallout.svelte';

	const { Story } = defineMeta({
		title: 'UI/PriorityCallout',
		component: PriorityCallout,
		tags: ['autodocs'],
		args: { title: 'Priority loop first' },
	});
</script>

<Story name="Default">
	{#snippet template(args)}
		<PriorityCallout {...args}>
			Finish the active rotation before starting personal chores.
		</PriorityCallout>
	{/snippet}
</Story>

<Story name="Title only" />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
