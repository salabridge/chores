<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import RewardCard from './RewardCard.svelte';

	const { Story } = defineMeta({
		title: 'UI/RewardCard',
		component: RewardCard,
		tags: ['autodocs'],
		argTypes: {
			status: {
				control: 'inline-radio',
				options: ['claimable', 'claimed', 'locked'],
			},
		},
		args: {
			title: 'Movie night pick',
			description: 'Choose the film for Friday',
			cost: 100,
			status: 'claimable',
			onclaim: fn(),
		},
	});
</script>

<Story name="Claimable" />

<Story name="Claimed" args={{ status: 'claimed' }} />

<Story name="Locked" args={{ status: 'locked', cost: 500, title: 'Day trip' }} />

<Story name="No description" args={{ description: undefined }} />
