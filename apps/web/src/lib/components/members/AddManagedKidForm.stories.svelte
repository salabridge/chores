<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { MAX_KIDS } from '#lib/setup.js';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './AddManagedKidForm.stories.svelte';
	import AddManagedKidForm from './AddManagedKidForm.svelte';

	// The members remote form is mocked in .storybook/mocks, so submitting does nothing.
	const { Story } = defineMeta({
		title: 'Members/AddManagedKidForm',
		component: AddManagedKidForm,
		tags: ['autodocs'],
		args: { kidCount: 2, onadded: fn() },
	});
</script>

<Story name="Default">
	{#snippet template(args)}
		<div class="max-w-[360px]"><AddManagedKidForm {...args} /></div>
	{/snippet}
</Story>

<Story name="Household full" args={{ kidCount: MAX_KIDS }}>
	{#snippet template(args)}
		<div class="max-w-[360px]"><AddManagedKidForm {...args} /></div>
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
