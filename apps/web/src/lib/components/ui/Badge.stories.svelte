<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Badge, { type BadgeTone, badgeTones } from './Badge.svelte';

	const tones = Object.keys(badgeTones) as BadgeTone[];

	const { Story } = defineMeta({
		title: 'UI/Badge',
		component: Badge,
		tags: ['autodocs'],
		argTypes: {
			tone: { control: 'select', options: tones },
		},
		args: { tone: 'in-progress' },
	});
</script>

<Story name="Default" />

<Story name="Custom label" args={{ tone: 'my-turn' }}>Your turn!</Story>

<Story name="All tones" asChild>
	<div class="flex flex-wrap gap-8">
		{#each tones as tone (tone)}
			<Badge {tone} />
		{/each}
	</div>
</Story>
