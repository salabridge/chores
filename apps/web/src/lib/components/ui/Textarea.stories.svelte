<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './Textarea.stories.svelte';
	import Textarea from './Textarea.svelte';

	const { Story } = defineMeta({
		title: 'UI/Textarea',
		component: Textarea,
		tags: ['autodocs'],
		args: {
			label: 'Notes',
			placeholder: 'Anything the next person should know?',
		},
	});
</script>

<Story name="Default" />

<Story name="With hint" args={{ hint: 'Visible to everyone in the household.' }} />

<Story
	name="With issues"
	args={{
		value: 'x',
		issues: [{ message: 'Notes must be at least 3 characters.' }],
	}}
/>

<Story name="Disabled" args={{ disabled: true, value: 'Locked notes' }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
