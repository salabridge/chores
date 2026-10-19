<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './DoneBySelect.stories.svelte';
	import DoneBySelect from './DoneBySelect.svelte';
	import { householdMembers } from './fixtures.ts';

	const { Story } = defineMeta({
		title: 'Chores/DoneBySelect',
		component: DoneBySelect,
		tags: ['autodocs'],
		args: { members: householdMembers, value: 'leo' },
	});
</script>

<Story name="Defaults to the assignee" />

<Story name="Someone else picked" args={{ value: 'mia' }} />

<Story name="Custom label" args={{ label: 'Who did this turn?' }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
