<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './SetPinForm.stories.svelte';
	import SetPinForm from './SetPinForm.svelte';

	// `savePin` is mocked in .storybook/mocks, so submitting does nothing.
	const { Story } = defineMeta({
		title: 'Profiles/SetPinForm',
		component: SetPinForm,
		tags: ['autodocs'],
		args: { requirePassword: false, onsaved: fn() },
	});
</script>

<Story name="First PIN">
	{#snippet template(args)}
		<div class="max-w-[360px]"><SetPinForm {...args} /></div>
	{/snippet}
</Story>

<Story name="Change PIN (needs password)" args={{ requirePassword: true }}>
	{#snippet template(args)}
		<div class="max-w-[360px]"><SetPinForm {...args} /></div>
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
