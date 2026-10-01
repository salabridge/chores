<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PriorityCallout from './PriorityCallout.svelte';

	const { Story } = defineMeta({
		title: 'UI/PriorityCallout',
		component: PriorityCallout,
		tags: ['autodocs'],
		args: { title: 'Priority loop first' },
	});
</script>

<Story name="Default">
	{#snippet template(args)}
		<PriorityCallout {...args}>
			Finish the active rotation before starting personal chores.
		</PriorityCallout>
	{/snippet}
</Story>

<Story name="Title only" />
