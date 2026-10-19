<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './DoneByLabel.stories.svelte';
	import DoneByLabel from './DoneByLabel.svelte';

	const { Story } = defineMeta({
		title: 'UI/DoneByLabel',
		component: DoneByLabel,
		tags: ['autodocs'],
		args: { name: 'Mia' },
	});
</script>

<Story name="Default" />

<Story name="Long name" args={{ name: 'Alexandria' }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
