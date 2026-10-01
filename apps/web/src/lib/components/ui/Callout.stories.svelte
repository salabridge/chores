<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Callout from './Callout.svelte';

	const { Story } = defineMeta({
		title: 'UI/Callout',
		component: Callout,
		tags: ['autodocs'],
		argTypes: {
			tone: {
				control: 'select',
				options: ['info', 'success', 'warning', 'action'],
			},
		},
		args: { tone: 'info', title: 'Rotation starts Monday' },
	});
</script>

<Story name="Info">
	{#snippet template(args)}
		<Callout {...args}>Each member takes one week before it passes on.</Callout>
	{/snippet}
</Story>

<Story name="Success" args={{ tone: 'success', title: 'All stages done' }}>
	{#snippet template(args)}
		<Callout {...args}>Points have been added to your total.</Callout>
	{/snippet}
</Story>

<Story name="Warning" args={{ tone: 'warning', title: 'Due soon' }}>
	{#snippet template(args)}
		<Callout {...args}>This chore is due in 30 minutes.</Callout>
	{/snippet}
</Story>

<Story name="Action" args={{ tone: 'action', title: 'Your turn' }}>
	{#snippet template(args)}
		<Callout {...args}>Take out the recycling before Thursday.</Callout>
	{/snippet}
</Story>

<Story name="Body only" args={{ title: undefined }}>
	{#snippet template(args)}
		<Callout {...args}>A callout without a heading.</Callout>
	{/snippet}
</Story>
