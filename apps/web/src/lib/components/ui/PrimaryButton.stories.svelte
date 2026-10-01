<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import PrimaryButton from './PrimaryButton.svelte';

	const { Story } = defineMeta({
		title: 'UI/PrimaryButton',
		component: PrimaryButton,
		tags: ['autodocs'],
		args: { onclick: fn() },
	});
</script>

<Story name="Default">Continue</Story>

<Story name="Pending" args={{ pending: true }}>Saving…</Story>

<Story name="Disabled" args={{ disabled: true }}>Continue</Story>

<Story name="As link" args={{ href: '#' }}>Get started</Story>
