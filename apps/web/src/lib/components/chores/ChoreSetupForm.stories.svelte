<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import type { ComponentProps } from 'svelte';
	import { emptyDraft, exampleDraft } from '#lib/chore-creator.js';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import Host from './ChoreSetupForm.host.svelte';
	import * as thisFile from './ChoreSetupForm.stories.svelte';
	import ChoreSetupForm from './ChoreSetupForm.svelte';
	import { householdMembers } from './fixtures.ts';

	const { Story } = defineMeta({
		title: 'Chores/ChoreSetupForm',
		component: ChoreSetupForm,
		tags: ['autodocs'],
		parameters: { layout: 'padded' },
		args: {
			draft: emptyDraft(),
			members: householdMembers,
			onsubmit: fn(async () => {}),
			cancelHref: '#',
		},
	});
</script>

{#snippet template(args: ComponentProps<typeof ChoreSetupForm>)}
	<Host {...args} />
{/snippet}

<Story name="Empty" {template} />

<Story
	name="Personal with stages"
	{template}
	args={{
		draft: {
			...exampleDraft(),
			kind: 'personal',
			title: 'Run Dishwasher',
			assigneeId: 'leo',
		},
	}}
/>

<Story name="Household rotation" {template} args={{ draft: exampleDraft() }} />

<Story
	name="Weekly, any day"
	{template}
	args={{
		draft: {
			...emptyDraft(),
			title: 'Wash the car',
			frequency: 'weekly',
			assigneeId: 'leo',
		},
	}}
/>

<Story
	name="Weekly, due Thursday"
	{template}
	args={{
		draft: {
			...emptyDraft(),
			title: 'Take the bins out',
			frequency: 'weekly',
			dueWeekday: 4,
			assigneeId: 'leo',
		},
	}}
/>

<Story name="Saving" {template} args={{ draft: exampleDraft(), pending: true }} />

<Story
	name="Editing a personal chore"
	{template}
	args={{
		mode: 'edit',
		draft: {
			...exampleDraft(),
			kind: 'personal',
			title: 'Run Dishwasher',
			assigneeId: 'leo',
		},
	}}
/>

<Story
	name="Editing, done this period"
	{template}
	args={{
		mode: 'edit',
		frequencyLocked: true,
		draft: { ...exampleDraft(), kind: 'personal', title: 'Run Dishwasher', assigneeId: 'leo' },
	}}
/>

<Story name="Editing a rotation" {template} args={{ mode: 'edit', draft: exampleDraft() }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
