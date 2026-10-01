<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import OptionCard from './OptionCard.svelte';
	import OptionCardGroup from './OptionCardGroup.svelte';

	const { Story } = defineMeta({
		title: 'UI/OptionCardGroup',
		component: OptionCardGroup,
		subcomponents: { OptionCard },
		tags: ['autodocs'],
		argTypes: {
			accent: { control: 'inline-radio', options: ['orange', 'blue'] },
		},
		args: { label: 'Chore type', value: 'personal', accent: 'orange' },
	});
</script>

{#snippet star()}
	<span aria-hidden="true">★</span>
{/snippet}

{#snippet loop()}
	<span aria-hidden="true">↻</span>
{/snippet}

<Story name="Orange">
	{#snippet template({ children: _children, ...args })}
		<OptionCardGroup {...args}>
			<OptionCard value="personal" label="Personal Chore" icon={star} />
			<OptionCard value="shared" label="Household Rotation" icon={loop} />
			<OptionCard value="other" label="Other" disabled />
		</OptionCardGroup>
	{/snippet}
</Story>

<Story name="Blue" args={{ accent: 'blue', value: 'shared' }}>
	{#snippet template({ children: _children, ...args })}
		<OptionCardGroup {...args}>
			<OptionCard value="personal" label="Personal Chore" icon={star} />
			<OptionCard value="shared" label="Household Rotation" icon={loop} />
		</OptionCardGroup>
	{/snippet}
</Story>

<Story name="Disabled group" args={{ disabled: true }}>
	{#snippet template({ children: _children, ...args })}
		<OptionCardGroup {...args}>
			<OptionCard value="personal" label="Personal Chore" />
			<OptionCard value="shared" label="Household Rotation" />
		</OptionCardGroup>
	{/snippet}
</Story>
