<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import RotationOrderPreview from './RotationOrderPreview.svelte';

	const { Story } = defineMeta({
		title: 'UI/RotationOrderPreview',
		component: RotationOrderPreview,
		tags: ['autodocs'],
		args: {
			members: [
				{ name: 'Leo', tone: 'orange' },
				{ name: 'Mia', tone: 'blue' },
				{ name: 'Sam', tone: 'green' },
			],
			showSummary: false,
			resetLabel: 'Loop Reset',
		},
	});
</script>

<Story name="Default" />

<Story name="With summary" args={{ showSummary: true }} />

<Story
	name="Two members"
	args={{
		members: [
			{ name: 'Leo', tone: 'orange' },
			{ name: 'Mia', tone: 'blue' },
		],
		showSummary: true,
	}}
/>

<Story
	name="Wrapping"
	args={{
		members: [
			{ name: 'Leo', tone: 'orange' },
			{ name: 'Mia', tone: 'blue' },
			{ name: 'Sam', tone: 'green' },
			{ name: 'Ava', tone: 'amber' },
			{ name: 'Noah' },
			{ name: 'Olivia', tone: 'blue' },
		],
		showSummary: true,
	}}
>
	{#snippet template(args)}
		<div class="max-w-[280px]">
			<RotationOrderPreview {...args} />
		</div>
	{/snippet}
</Story>

<Story name="No members" args={{ members: [] }} />

<Story name="Custom reset label" args={{ resetLabel: 'Start over' }} />
