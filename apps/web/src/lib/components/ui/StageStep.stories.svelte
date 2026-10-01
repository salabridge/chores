<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import StageStep from './StageStep.svelte';

	// StageStep renders an <li>, so every story wraps it in a list.
	const { Story } = defineMeta({
		title: 'UI/StageStep',
		component: StageStep,
		tags: ['autodocs'],
		args: { title: 'Make the bed', state: 'current' },
	});
</script>

<Story name="Checklist">
	{#snippet template(args)}
		<ul class="flex flex-col gap-8">
			<StageStep {...args} />
		</ul>
	{/snippet}
</Story>

<Story name="Checklist states" asChild>
	<ul class="flex flex-col gap-8">
		<StageStep title="Pick up clothes" state="completed" />
		<StageStep title="Make the bed" state="current" />
		<StageStep title="Vacuum the floor" state="locked" />
		<StageStep
			title="Dust shelves"
			state="locked"
			status="Unlocks after vacuuming"
		/>
	</ul>
</Story>

<Story name="Editor" asChild>
	<ul class="flex flex-col gap-8">
		<StageStep
			variant="editor"
			number={1}
			title="Pick up clothes"
			hint="Hamper or drawers"
			points={5}
		/>
		<StageStep variant="editor" number={2} title="Make the bed" points={5} />
		<StageStep
			variant="editor"
			number={3}
			title="Vacuum the floor"
			points={10}
		/>
	</ul>
</Story>
