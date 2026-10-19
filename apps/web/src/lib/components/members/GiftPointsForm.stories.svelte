<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import { members } from './fixtures.ts';
	import * as thisFile from './GiftPointsForm.stories.svelte';
	import GiftPointsForm from './GiftPointsForm.svelte';

	// The members remote forms are mocked in .storybook/mocks, so giving does nothing.
	const { Story } = defineMeta({
		title: 'Members/GiftPointsForm',
		component: GiftPointsForm,
		tags: ['autodocs'],
		args: { member: members[2], onsaved: fn(), oncancel: fn() },
	});
</script>

<Story name="Default">
	{#snippet template(args)}
		<div class="max-w-[420px]"><GiftPointsForm {...args} /></div>
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
