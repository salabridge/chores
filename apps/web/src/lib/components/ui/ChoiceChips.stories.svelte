<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ChoiceChips from './ChoiceChips.svelte';

	const { Story } = defineMeta({
		title: 'UI/ChoiceChips',
		component: ChoiceChips,
		tags: ['autodocs'],
		args: {
			label: 'Frequency',
			options: [
				{ value: 'daily', label: 'Daily' },
				{ value: 'weekly', label: 'Weekly' },
				{ value: 'monthly', label: 'Monthly' },
			],
			value: 'weekly',
		},
	});
</script>

<Story name="Default" />

<Story
	name="Numeric options"
	args={{
		label: 'Points',
		options: [{ value: 5 }, { value: 10 }, { value: 15 }, { value: 20 }],
		value: 10,
	}}
/>

<Story name="Disabled" args={{ disabled: true }} />
