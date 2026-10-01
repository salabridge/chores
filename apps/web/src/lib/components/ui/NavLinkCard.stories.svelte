<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import NavLinkCard from './NavLinkCard.svelte';

	const { Story } = defineMeta({
		title: 'UI/NavLinkCard',
		component: NavLinkCard,
		tags: ['autodocs'],
		argTypes: {
			tone: { control: 'inline-radio', options: ['orange', 'blue', 'neutral'] },
		},
		args: {
			href: '#',
			title: 'Personal Chore',
			description: 'Just for you, on your own schedule',
			tone: 'neutral',
		},
	});
</script>

{#snippet icon()}
	<span aria-hidden="true">★</span>
{/snippet}

<Story name="Neutral" />

<Story name="Orange" args={{ tone: 'orange', icon }} />

<Story
	name="Blue"
	args={{
		tone: 'blue',
		title: 'Household Rotation',
		description: 'Shared and passed between members',
		icon,
	}}
/>

<Story name="Title only" args={{ description: undefined }} />
