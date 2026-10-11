<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './Logo.stories.svelte';
	import Logo from './Logo.svelte';

	const { Story } = defineMeta({
		title: 'UI/Logo',
		component: Logo,
		tags: ['autodocs'],
	});
</script>

<Story name="Linked" />

<Story name="Unlinked" args={{ href: null }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
