<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './ParentStep.stories.svelte';
	import ParentStep from './ParentStep.svelte';

	// The setup remote forms are mocked in .storybook/mocks, so submitting does nothing.
	const { Story } = defineMeta({
		title: 'Setup/ParentStep',
		component: ParentStep,
		tags: ['autodocs'],
		args: { onsaved: fn(), onback: fn(), displayName: 'Mom', avatarColor: 'orange' },
	});
</script>

<Story name="Default">
	{#snippet template(args)}
		<div class="max-w-[360px]"><ParentStep {...args} /></div>
	{/snippet}
</Story>

<Story name="Another colour" args={{ displayName: 'Dad', avatarColor: 'green', avatarInitial: 'D' }}>
	{#snippet template(args)}
		<div class="max-w-[360px]"><ParentStep {...args} /></div>
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
