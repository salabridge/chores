<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './PinInput.stories.svelte';
	import PinInput from './PinInput.svelte';

	const { Story } = defineMeta({
		title: 'UI/PinInput',
		component: PinInput,
		tags: ['autodocs'],
		argTypes: {
			maxLength: { control: { type: 'number', min: 4, max: 6 } },
		},
		args: {
			label: 'Enter PIN',
			value: '',
			maxLength: 6,
			disabled: false,
		},
	});
</script>

<Story name="Empty">
	{#snippet template(args)}
		<div class="max-w-[320px]"><PinInput {...args} /></div>
	{/snippet}
</Story>

<Story name="Partly entered" args={{ value: '142' }}>
	{#snippet template(args)}
		<div class="max-w-[320px]"><PinInput {...args} /></div>
	{/snippet}
</Story>

<Story name="Four-digit max" args={{ maxLength: 4, value: '1234' }}>
	{#snippet template(args)}
		<div class="max-w-[320px]"><PinInput {...args} /></div>
	{/snippet}
</Story>

<Story name="Disabled" args={{ disabled: true, value: '12' }}>
	{#snippet template(args)}
		<div class="max-w-[320px]"><PinInput {...args} /></div>
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
