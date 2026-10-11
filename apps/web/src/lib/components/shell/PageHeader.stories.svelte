<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './PageHeader.stories.svelte';
	import PageHeader from './PageHeader.svelte';

	const { Story } = defineMeta({
		title: 'Shell/PageHeader',
		component: PageHeader,
		tags: ['autodocs'],
		parameters: { layout: 'fullscreen' },
		args: { label: 'Personal Chore', backHref: '#today' },
	});
</script>

<Story name="Default" />

<Story name="Long label" args={{ label: 'Household Rotation Settings' }} />

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
