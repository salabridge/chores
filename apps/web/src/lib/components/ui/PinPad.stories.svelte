<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PinPad from './PinPad.svelte';

	const { Story } = defineMeta({
		title: 'UI/PinPad',
		component: PinPad,
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
		<div class="max-w-[320px]"><PinPad {...args} /></div>
	{/snippet}
</Story>

<Story name="Partly entered" args={{ value: '142' }}>
	{#snippet template(args)}
		<div class="max-w-[320px]"><PinPad {...args} /></div>
	{/snippet}
</Story>

<Story name="Four-digit max" args={{ maxLength: 4, value: '1234' }}>
	{#snippet template(args)}
		<div class="max-w-[320px]"><PinPad {...args} /></div>
	{/snippet}
</Story>

<Story name="Disabled" args={{ disabled: true, value: '12' }}>
	{#snippet template(args)}
		<div class="max-w-[320px]"><PinPad {...args} /></div>
	{/snippet}
</Story>
