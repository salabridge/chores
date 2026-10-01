<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import SocialButton from './SocialButton.svelte';

	const { Story } = defineMeta({
		title: 'UI/SocialButton',
		component: SocialButton,
		tags: ['autodocs'],
		argTypes: {
			provider: { control: 'inline-radio', options: ['google', 'apple'] },
		},
		args: { provider: 'google', onclick: fn() },
	});
</script>

<Story name="Google" />

<Story name="Apple" args={{ provider: 'apple' }} />
