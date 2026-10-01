<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Badge from './Badge.svelte';
	import SurfaceCard from './SurfaceCard.svelte';

	const { Story } = defineMeta({
		title: 'UI/SurfaceCard',
		component: SurfaceCard,
		tags: ['autodocs'],
		args: { title: 'Member Workload', subtitle: 'Points earned this week' },
	});
</script>

{#snippet badge()}
	<Badge tone="this-week" />
{/snippet}

<Story name="Default">
	{#snippet template(args)}
		<SurfaceCard {...args}>
			<p class="text-[14px] text-text-secondary">Card body content goes here.</p>
		</SurfaceCard>
	{/snippet}
</Story>

<Story name="With badge" args={{ badge }}>
	{#snippet template(args)}
		<SurfaceCard {...args}>
			<p class="text-[14px] text-text-secondary">Card body content goes here.</p>
		</SurfaceCard>
	{/snippet}
</Story>

<Story name="Header only" args={{ subtitle: undefined }} />
