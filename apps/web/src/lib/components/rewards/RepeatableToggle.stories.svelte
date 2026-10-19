<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './RepeatableToggle.stories.svelte';
	import RepeatableToggle from './RepeatableToggle.svelte';

	const { Story } = defineMeta({
		title: 'Rewards/RepeatableToggle',
		component: RepeatableToggle,
		tags: ['autodocs'],
		args: { checked: false, disabled: false },
	});
</script>

<Story name="Once per kid" />

<Story name="Unlimited claims" args={{ checked: true }} />

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
