<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './ChoiceChips.stories.svelte';
	import ChoiceChips from './ChoiceChips.svelte';

	const { Story } = defineMeta({
		title: 'UI/ChoiceChips',
		component: ChoiceChips,
		tags: ['autodocs'],
		args: {
			label: 'Frequency',
			options: [
				{ value: 'daily', label: 'Daily' },
				{ value: 'weekly', label: 'Weekly' },
				{ value: 'monthly', label: 'Monthly' },
			],
			value: 'weekly',
		},
	});
</script>

<Story name="Default" />

<Story
	name="Numeric options"
	args={{
		label: 'Points',
		options: [{ value: 5 }, { value: 10 }, { value: 15 }, { value: 20 }],
		value: 10,
	}}
/>

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
