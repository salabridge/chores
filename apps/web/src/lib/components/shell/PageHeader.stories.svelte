<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PageHeader from './PageHeader.svelte';

	const { Story } = defineMeta({
		title: 'Shell/PageHeader',
		component: PageHeader,
		tags: ['autodocs'],
		parameters: { layout: 'fullscreen' },
		args: { label: 'Personal Chore', backHref: '#today' },
	});
</script>

<Story name="Default" />

<Story name="Long label" args={{ label: 'Household Rotation Settings' }} />
