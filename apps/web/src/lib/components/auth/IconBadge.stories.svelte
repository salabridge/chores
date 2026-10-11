<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import key from '#lib/assets/icons/key.svg';
	import shield from '#lib/assets/icons/shield.svg';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './IconBadge.stories.svelte';
	import IconBadge from './IconBadge.svelte';

	const { Story } = defineMeta({
		title: 'Auth/IconBadge',
		component: IconBadge,
		tags: ['autodocs'],
		args: { src: shield },
	});
</script>

<Story name="Shield" />

<Story name="Key" args={{ src: key }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
