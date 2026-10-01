<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
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
