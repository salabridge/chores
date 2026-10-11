<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './ConfettiBurst.stories.svelte';
	import ConfettiBurst from './ConfettiBurst.svelte';

	const { Story } = defineMeta({
		title: 'UI/ConfettiBurst',
		component: ConfettiBurst,
		tags: ['autodocs'],
	});
</script>

<!-- The burst fills its parent, so give it the 140px square the celebration uses. -->
<Story name="Default">
	{#snippet template(args)}
		<div class="relative size-[140px] bg-background-orange">
			<ConfettiBurst {...args} />
		</div>
	{/snippet}
</Story>

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
