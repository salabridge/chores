<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import StreakBanner from './StreakBanner.svelte';

	const { Story } = defineMeta({
		title: 'UI/StreakBanner',
		component: StreakBanner,
		tags: ['autodocs'],
		args: { title: '5-Day Active Streak!' },
	});
</script>

<Story name="Default">
	{#snippet template(args)}
		<StreakBanner {...args}>Mia is catching up!</StreakBanner>
	{/snippet}
</Story>

<Story name="Title only" />
