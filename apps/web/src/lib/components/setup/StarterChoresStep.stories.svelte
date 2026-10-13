<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './StarterChoresStep.stories.svelte';
	import StarterChoresStep from './StarterChoresStep.svelte';

	// The setup remote forms are mocked in .storybook/mocks, so submitting does nothing.
	const { Story } = defineMeta({
		title: 'Setup/StarterChoresStep',
		component: StarterChoresStep,
		tags: ['autodocs'],
		args: {
			onback: fn(),
			kids: [
				{ id: 'k1', displayName: 'Mia' },
				{ id: 'k2', displayName: 'Leo' },
			],
		},
	});
</script>

<Story name="Default">
	{#snippet template(args)}
		<div class="max-w-[360px]"><StarterChoresStep {...args} /></div>
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
