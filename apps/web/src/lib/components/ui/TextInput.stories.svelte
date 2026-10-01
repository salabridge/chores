<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import TextInput from './TextInput.svelte';

	const { Story } = defineMeta({
		title: 'UI/TextInput',
		component: TextInput,
		tags: ['autodocs'],
		args: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
	});
</script>

<Story name="Default" />

<Story name="With hint" args={{ hint: "We'll send a sign-in code here." }} />

<Story
	name="With issues"
	args={{
		value: 'not-an-email',
		issues: [{ message: 'Enter a valid email address.' }],
	}}
/>

<Story
	name="Password"
	args={{ label: 'Password', type: 'password', placeholder: undefined }}
/>

<Story name="Disabled" args={{ disabled: true, value: 'mia@example.com' }} />
