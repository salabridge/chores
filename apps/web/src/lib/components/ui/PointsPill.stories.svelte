<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './PointsPill.stories.svelte';
	import PointsPill from './PointsPill.svelte';

	const { Story } = defineMeta({
		title: 'UI/PointsPill',
		component: PointsPill,
		tags: ['autodocs'],
		argTypes: {
			variant: { control: 'inline-radio', options: ['inline', 'header'] },
		},
		args: { points: 15, variant: 'inline' },
	});
</script>

<Story name="Inline" />

<Story name="Header" args={{ variant: 'header', points: 240 }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
