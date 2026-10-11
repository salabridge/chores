<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './StreakBanner.stories.svelte';
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

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
