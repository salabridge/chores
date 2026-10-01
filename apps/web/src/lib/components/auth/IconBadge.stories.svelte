<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import key from '#lib/assets/icons/key.svg';
	import shield from '#lib/assets/icons/shield.svg';
	import IconBadge from './IconBadge.svelte';

	const { Story } = defineMeta({
		title: 'Auth/IconBadge',
		component: IconBadge,
		tags: ['autodocs'],
		args: { src: shield },
	});
</script>

<Story name="Shield" />

<Story name="Key" args={{ src: key }} />
