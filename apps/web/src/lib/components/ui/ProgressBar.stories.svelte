<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './ProgressBar.stories.svelte';
	import ProgressBar from './ProgressBar.svelte';

	const { Story } = defineMeta({
		title: 'UI/ProgressBar',
		component: ProgressBar,
		tags: ['autodocs'],
		argTypes: {
			variant: { control: 'inline-radio', options: ['green', 'orange', 'blue'] },
			size: { control: 'inline-radio', options: ['default', 'thin'] },
		},
		args: {
			value: 3,
			max: 5,
			label: 'Weekly goal',
			valueLabel: '3 / 5',
			variant: 'green',
		},
	});
</script>

<Story name="Weekly goal" />

<Story
	name="Streak"
	args={{
		variant: 'orange',
		label: 'Streak',
		value: 5,
		max: 7,
		valueLabel: '5 days',
	}}
/>

<Story
	name="Milestone"
	args={{
		variant: 'blue',
		label: 'Next reward',
		value: 180,
		max: 250,
		valueLabel: '180 / 250',
	}}
/>

<Story
	name="Thin"
	args={{ size: 'thin', label: 'Mia', valueLabel: '60%', value: 60, max: 100 }}
/>

<Story
	name="No labels"
	args={{ label: undefined, valueLabel: undefined, 'aria-label': 'Progress' }}
/>

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
