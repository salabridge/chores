<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './WorkspaceHeader.stories.svelte';
	import WorkspaceHeader from './WorkspaceHeader.svelte';

	const { Story } = defineMeta({
		title: 'Shell/WorkspaceHeader',
		component: WorkspaceHeader,
		tags: ['autodocs'],
		parameters: { layout: 'padded' },
		args: {
			title: 'Household Overview',
			subtitle:
				'Start here to manage chores, balance workload, and keep rotations moving.',
		},
	});
</script>

{#snippet actions()}
	<SecondaryButton href="#rotations">Manage Loops</SecondaryButton>
	<PrimaryButton href="#new" size="sm">New Chore Loop</PrimaryButton>
{/snippet}

<Story name="Title only" args={{ subtitle: undefined }} />

<Story name="With subtitle" />

<Story name="With actions" args={{ actions }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
