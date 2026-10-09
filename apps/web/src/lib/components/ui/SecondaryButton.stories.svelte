<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import SecondaryButton from './SecondaryButton.svelte';

	const { Story } = defineMeta({
		title: 'UI/SecondaryButton',
		component: SecondaryButton,
		tags: ['autodocs'],
		argTypes: {
			variant: {
				control: 'inline-radio',
				options: ['outline', 'icon', 'tinted'],
			},
			tone: { control: 'select', options: ['orange', 'blue', 'green', 'amber', 'neutral'] },
		},
		args: { onclick: fn(), variant: 'outline' },
	});
</script>

<Story name="Outline">Cancel</Story>

<Story name="Icon" args={{ variant: 'icon', 'aria-label': 'More options' }}
	>⋯</Story
>

<Story name="Tinted" args={{ variant: 'tinted', tone: 'orange' }}>Skip</Story>

<Story name="Tinted tones" asChild>
	<div class="flex flex-wrap gap-8">
		<SecondaryButton variant="tinted" tone="orange">Skip</SecondaryButton>
		<SecondaryButton variant="tinted" tone="blue">View Loop</SecondaryButton>
		<SecondaryButton variant="tinted" tone="green">Claim</SecondaryButton>
		<SecondaryButton variant="tinted" tone="amber">Remind</SecondaryButton>
		<SecondaryButton variant="tinted" tone="neutral">Reopen</SecondaryButton>
	</div>
</Story>

<Story name="Pending" args={{ pending: true }}>Saving…</Story>

<Story name="As link" args={{ href: '#' }}>Back to today</Story>
