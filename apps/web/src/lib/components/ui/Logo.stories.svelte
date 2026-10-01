<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Logo from './Logo.svelte';

	const { Story } = defineMeta({
		title: 'UI/Logo',
		component: Logo,
		tags: ['autodocs'],
	});
</script>

<Story name="Linked" />

<Story name="Unlinked" args={{ href: null }} />
