<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './ChoreListRow.stories.svelte';
	import ChoreListRow from './ChoreListRow.svelte';
	import { bedroom, listMembers, mistake, oldChore, toilet } from './choresListFixtures.ts';

	// ChoreListRow renders an <li>, so every story wraps it in a list.
	const { Story } = defineMeta({
		title: 'Chores/ChoreListRow',
		component: ChoreListRow,
		tags: ['autodocs'],
		args: {
			chore: bedroom,
			members: listMembers,
			onarchive: fn(),
			onrestore: fn(),
			ondelete: fn(),
		},
	});
</script>

<Story name="Personal chore">
	{#snippet template(args)}
		<ul class="flex flex-col gap-8"><ChoreListRow {...args} /></ul>
	{/snippet}
</Story>

<Story name="Rotation chore" args={{ chore: toilet }}>
	{#snippet template(args)}
		<ul class="flex flex-col gap-8"><ChoreListRow {...args} /></ul>
	{/snippet}
</Story>

<Story
	name="Their turn"
	args={{ chore: toilet, inRotation: true, theirTurn: true, showAssignee: false }}
>
	{#snippet template(args)}
		<ul class="flex flex-col gap-8"><ChoreListRow {...args} /></ul>
	{/snippet}
</Story>

<Story name="Busy" args={{ busy: true }}>
	{#snippet template(args)}
		<ul class="flex flex-col gap-8"><ChoreListRow {...args} /></ul>
	{/snippet}
</Story>

<Story name="Archived, completed" args={{ chore: oldChore }}>
	{#snippet template(args)}
		<ul class="flex flex-col gap-8"><ChoreListRow {...args} /></ul>
	{/snippet}
</Story>

<Story name="Archived, never completed" args={{ chore: mistake }}>
	{#snippet template(args)}
		<ul class="flex flex-col gap-8"><ChoreListRow {...args} /></ul>
	{/snippet}
</Story>

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
