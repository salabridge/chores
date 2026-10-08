<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import type { ComponentProps } from 'svelte';
	import { emptyDraft, exampleDraft } from '#lib/chore-creator.js';
	import Host from './ChoreSetupForm.host.svelte';
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

<Story name="Saving" {template} args={{ draft: exampleDraft(), pending: true }} />
