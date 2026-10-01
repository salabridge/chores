<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import BackLink from './BackLink.svelte';

	const { Story } = defineMeta({
		title: 'Auth/BackLink',
		component: BackLink,
		tags: ['autodocs'],
		args: { href: '#login', label: 'Back to sign in' },
	});
</script>

<Story name="Default" />
