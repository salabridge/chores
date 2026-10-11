<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './SocialButton.stories.svelte';
	import SocialButton from './SocialButton.svelte';

	const { Story } = defineMeta({
		title: 'UI/SocialButton',
		component: SocialButton,
		tags: ['autodocs'],
		argTypes: {
			provider: { control: 'inline-radio', options: ['google', 'apple'] },
		},
		args: { provider: 'google', onclick: fn() },
	});
</script>

<Story name="Google" />

<Story name="Apple" args={{ provider: 'apple' }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
