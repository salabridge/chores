<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import SocialSignIn from './SocialSignIn.svelte';

	const { Story } = defineMeta({
		title: 'UI/SocialSignIn',
		component: SocialSignIn,
		tags: ['autodocs'],
		args: { onchoose: fn() },
	});
</script>

<Story name="Default" />

<Story name="Custom divider" args={{ dividerText: 'or sign up with' }} />
