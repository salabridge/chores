<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Badge from './Badge.svelte';
	import StatCard from './StatCard.svelte';

	const { Story } = defineMeta({
		title: 'UI/StatCard',
		component: StatCard,
		tags: ['autodocs'],
		args: {
			label: 'This week',
			value: '12 Chores',
			caption: '3 more than last week',
		},
	});
</script>

{#snippet badge()}
	<Badge tone="this-week">12 active</Badge>
{/snippet}

<Story name="Default" />

<Story name="With badge" args={{ badge }} />

<Story name="Value only" args={{ caption: undefined }} />
