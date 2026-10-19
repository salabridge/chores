<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './FavourBanner.stories.svelte';
	import FavourBanner from './FavourBanner.svelte';

	const { Story } = defineMeta({
		title: 'Chores/FavourBanner',
		component: FavourBanner,
		tags: ['autodocs'],
		args: { ownerName: 'Leo', recording: false },
	});
</script>

<Story name="You get the points" />

<Story name="Parent records who did it" args={{ recording: true }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
