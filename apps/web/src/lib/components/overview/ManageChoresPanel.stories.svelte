<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import * as thisFile from './ManageChoresPanel.stories.svelte';
	import ManageChoresPanel from './ManageChoresPanel.svelte';

	const { Story } = defineMeta({
		title: 'Overview/ManageChoresPanel',
		component: ManageChoresPanel,
		tags: ['autodocs'],
		args: { createHref: '#create', rotationsHref: '#rotations', overviewHref: '#overview' },
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
