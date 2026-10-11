<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './AuthHeading.stories.svelte';
	import AuthHeading from './AuthHeading.svelte';

	const { Story } = defineMeta({
		title: 'Auth/AuthHeading',
		component: AuthHeading,
		tags: ['autodocs'],
		args: { title: 'Welcome back' },
	});
</script>

<Story name="Default">Sign in to see today's chores.</Story>

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
