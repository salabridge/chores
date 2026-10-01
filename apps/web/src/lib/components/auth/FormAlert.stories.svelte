<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import FormAlert from './FormAlert.svelte';

	const { Story } = defineMeta({
		title: 'Auth/FormAlert',
		component: FormAlert,
		tags: ['autodocs'],
		argTypes: {
			tone: { control: 'inline-radio', options: ['error', 'status'] },
		},
		args: {
			issues: [{ message: 'Incorrect email or password.' }],
			tone: 'error',
		},
	});
</script>

<Story name="Error" />

<Story
	name="Multiple issues"
	args={{
		issues: [
			{ message: 'Incorrect email or password.' },
			{ message: 'Too many attempts. Try again in 5 minutes.' },
		],
	}}
/>

<Story
	name="Status"
	args={{
		tone: 'status',
		issues: [{ message: 'We sent a new code to your email.' }],
	}}
/>
