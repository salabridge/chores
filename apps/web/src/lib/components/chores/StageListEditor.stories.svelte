<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import StageListEditor from './StageListEditor.svelte';

	const { Story } = defineMeta({
		title: 'Chores/StageListEditor',
		component: StageListEditor,
		tags: ['autodocs'],
		args: {
			stages: [
				{
					key: 'a',
					title: 'Clear counters and scrape plates',
					hint: 'Good for younger helpers before the machine starts.',
				},
				{
					key: 'b',
					title: 'Load the dishwasher and add detergent',
					hint: 'Keep fragile items out.',
				},
				{ key: 'c', title: 'Start the cycle', hint: '' },
			],
		},
	});
</script>

<Story name="Default" />

<Story name="Empty" args={{ stages: [] }} />

<Story
	name="With problems"
	args={{
		stages: [
			{ key: 'a', title: '', hint: '' },
			{ key: 'b', title: 'Start the cycle', hint: '' },
		],
		errors: { a: { title: 'Give this stage a title.' } },
	}}
/>

<Story
	name="Empty with list error"
	args={{ stages: [], listError: 'Add at least one stage, or switch to Single Step.' }}
/>

<Story name="Disabled" args={{ disabled: true }} />
