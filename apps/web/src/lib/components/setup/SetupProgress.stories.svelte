<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './SetupProgress.stories.svelte';
	import SetupProgress from './SetupProgress.svelte';

	const { Story } = defineMeta({
		title: 'Setup/SetupProgress',
		component: SetupProgress,
		tags: ['autodocs'],
		argTypes: {
			current: {
				control: 'select',
				options: ['household', 'parent', 'kids', 'pin', 'chores'],
			},
		},
		args: { current: 'household' },
	});
</script>

<Story name="First step">
	{#snippet template(args)}
		<div class="max-w-[360px]"><SetupProgress {...args} /></div>
	{/snippet}
</Story>

<Story name="Kids" args={{ current: 'kids' }}>
	{#snippet template(args)}
		<div class="max-w-[360px]"><SetupProgress {...args} /></div>
	{/snippet}
</Story>

<Story name="Last step" args={{ current: 'chores' }}>
	{#snippet template(args)}
		<div class="max-w-[360px]"><SetupProgress {...args} /></div>
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
