<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './SocialSignIn.stories.svelte';
	import SocialSignIn from './SocialSignIn.svelte';

	const { Story } = defineMeta({
		title: 'UI/SocialSignIn',
		component: SocialSignIn,
		tags: ['autodocs'],
		args: { onchoose: fn() },
	});
</script>

<Story name="Default" />

<Story name="Custom divider" args={{ dividerText: 'or sign up with' }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
