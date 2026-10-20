<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import { members } from './fixtures.ts';
	import * as thisFile from './RemoveMemberDialog.stories.svelte';
	import RemoveMemberDialog from './RemoveMemberDialog.svelte';

	// No autodocs: the docs page renders every story at once, and each open
	// story calls showModal(), which would stack the dialogs. The members remote
	// forms are mocked in .storybook/mocks, so removing does nothing.
	const { Story } = defineMeta({
		title: 'Members/RemoveMemberDialog',
		component: RemoveMemberDialog,
		parameters: { layout: 'fullscreen' },
		args: {
			open: true,
			member: members[2],
			moveTargets: [members[3]],
			onremoved: fn(),
		},
	});
</script>

<Story name="Managed kid (move points)" />

<Story
	name="Kid with own login"
	args={{ member: members[3], moveTargets: [members[2]] }}
/>

<Story name="Parent" args={{ member: members[1], moveTargets: [] }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
