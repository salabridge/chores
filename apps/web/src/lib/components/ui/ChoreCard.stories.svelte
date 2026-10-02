<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ChoreCard from './ChoreCard.svelte';

	const { Story } = defineMeta({
		title: 'UI/ChoreCard',
		component: ChoreCard,
		tags: ['autodocs'],
		argTypes: {
			variant: {
				control: 'inline-radio',
				options: ['personal', 'shared', 'highlighted', 'completed'],
			},
			status: {
				control: 'select',
				options: ['in-progress', 'todo', 'my-turn', 'completed', 'active-turn'],
			},
		},
		args: {
			href: '#',
			title: 'Make the bed',
			subtitle: 'Every morning',
			variant: 'personal',
			points: 10,
			status: 'todo',
		},
	});
</script>

{#snippet icon()}
	<span aria-hidden="true">★</span>
{/snippet}

<Story name="Personal" args={{ icon }} />

<Story
	name="Shared"
	args={{
		variant: 'shared',
		title: 'Take out the trash',
		subtitle: 'Rotates weekly',
		status: 'in-progress',
		icon,
	}}
/>

<Story
	name="Highlighted (my turn)"
	args={{
		variant: 'highlighted',
		title: 'Feed the dog',
		subtitle: 'Your turn today',
		points: 15,
		status: 'my-turn',
		icon,
	}}
/>

<Story
	name="Completed"
	args={{
		variant: 'completed',
		title: 'Water the plants',
		subtitle: 'Done this morning',
		points: undefined,
		status: 'completed',
		icon,
	}}
/>

<Story name="Title only" args={{ subtitle: undefined, points: undefined, status: undefined }} />

<Story name="All variants" asChild>
	<div class="flex max-w-[360px] flex-col gap-12">
		<ChoreCard href="#" title="Make the bed" subtitle="Every morning" points={10} status="todo" {icon} />
		<ChoreCard
			href="#"
			variant="shared"
			title="Take out the trash"
			subtitle="Rotates weekly"
			points={10}
			status="in-progress"
			{icon}
		/>
		<ChoreCard
			href="#"
			variant="highlighted"
			title="Feed the dog"
			subtitle="Your turn today"
			points={15}
			status="my-turn"
			{icon}
		/>
		<ChoreCard
			href="#"
			variant="completed"
			title="Water the plants"
			subtitle="Done this morning"
			status="completed"
			{icon}
		/>
	</div>
</Story>
