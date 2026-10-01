<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import AuthHeading from './AuthHeading.svelte';

	const { Story } = defineMeta({
		title: 'Auth/AuthHeading',
		component: AuthHeading,
		tags: ['autodocs'],
		args: { title: 'Welcome back' },
	});
</script>

<Story name="Default">Sign in to see today's chores.</Story>
