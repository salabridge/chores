<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './BackLink.stories.svelte';
	import BackLink from './BackLink.svelte';

	const { Story } = defineMeta({
		title: 'Auth/BackLink',
		component: BackLink,
		tags: ['autodocs'],
		args: { href: '#login', label: 'Back to sign in' },
	});
</script>

<Story name="Default" />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
